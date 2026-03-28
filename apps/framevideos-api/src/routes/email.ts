// Email service routes — Sprint 9
// Transactional email via SendGrid + template management

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';
import { ValidationError, NotFoundError } from '@frame-videos/shared/errors';

const email = new Hono<AppContext>();

// ─── Auth middleware (all routes) ────────────────────────────────────────────

email.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const VALID_TEMPLATE_TYPES = ['welcome', 'password_reset', 'payment_success', 'domain_verified'] as const;

const sendSchema = z.object({
  template_type: z.enum(VALID_TEMPLATE_TYPES),
  to: z.string().email('Invalid email'),
  variables: z.record(z.string()).optional().default({}),
});

const updateTemplateSchema = z.object({
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1).max(100000),
  body_text: z.string().max(50000).optional(),
  is_active: z.boolean().optional(),
});

// ─── Default templates ───────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<string, { subject: string; body_html: string; body_text: string }> = {
  welcome: {
    subject: 'Bem-vindo ao {{site_name}}!',
    body_html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#8b5cf6;">Bem-vindo, {{name}}!</h1>
<p>Sua conta no <strong>{{site_name}}</strong> foi criada com sucesso.</p>
<p>Comece a explorar agora:</p>
<a href="{{site_url}}" style="display:inline-block;padding:12px 24px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px;">Acessar o site</a>
<p style="color:#666;font-size:12px;margin-top:24px;">Se você não criou esta conta, ignore este email.</p>
</div>`,
    body_text: 'Bem-vindo, {{name}}! Sua conta no {{site_name}} foi criada com sucesso. Acesse: {{site_url}}',
  },
  password_reset: {
    subject: 'Redefinir senha — {{site_name}}',
    body_html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#8b5cf6;">Redefinir senha</h1>
<p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>{{site_name}}</strong>.</p>
<a href="{{reset_url}}" style="display:inline-block;padding:12px 24px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px;">Redefinir senha</a>
<p style="color:#666;font-size:12px;margin-top:24px;">Este link expira em 1 hora. Se você não solicitou, ignore este email.</p>
</div>`,
    body_text: 'Redefinir senha no {{site_name}}. Acesse: {{reset_url}} — Link expira em 1 hora.',
  },
  payment_success: {
    subject: 'Pagamento confirmado — {{site_name}}',
    body_html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#22c55e;">Pagamento confirmado! ✅</h1>
<p>Seu pagamento de <strong>{{amount}}</strong> para o plano <strong>{{plan_name}}</strong> no <strong>{{site_name}}</strong> foi processado com sucesso.</p>
<p style="color:#666;font-size:12px;margin-top:24px;">Obrigado por ser nosso cliente!</p>
</div>`,
    body_text: 'Pagamento de {{amount}} confirmado para o plano {{plan_name}} no {{site_name}}.',
  },
  domain_verified: {
    subject: 'Domínio verificado — {{site_name}}',
    body_html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#22c55e;">Domínio verificado! 🌐</h1>
<p>O domínio <strong>{{domain}}</strong> foi verificado e está ativo no <strong>{{site_name}}</strong>.</p>
<p>Seu site já está acessível em <a href="https://{{domain}}">https://{{domain}}</a>.</p>
</div>`,
    body_text: 'O domínio {{domain}} foi verificado e está ativo no {{site_name}}.',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

async function getOrCreateTemplate(
  db: D1Client,
  tenantId: string,
  templateType: string,
): Promise<{ subject: string; body_html: string; body_text: string; is_active: number }> {
  const existing = await db.queryOne<{
    subject: string;
    body_html: string;
    body_text: string;
    is_active: number;
  }>(
    `SELECT subject, body_html, body_text, is_active FROM email_templates WHERE tenant_id = ? AND template_type = ?`,
    [tenantId, templateType],
  );

  if (existing) return existing;

  // Create from default
  const defaults = DEFAULT_TEMPLATES[templateType];
  if (!defaults) {
    return { subject: templateType, body_html: '<p>{{content}}</p>', body_text: '{{content}}', is_active: 1 };
  }

  const id = generateUlid();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO email_templates (id, tenant_id, template_type, subject, body_html, body_text, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, tenantId, templateType, defaults.subject, defaults.body_html, defaults.body_text, now, now],
  );

  return { ...defaults, is_active: 1 };
}

// ─── POST /send — Send transactional email ──────────────────────────────────

email.post('/send', async (c) => {
  const tenantId = c.get('tenantId')!;

  if (!c.env.SENDGRID_API_KEY) {
    return c.json(
      { error: { code: 'EMAIL_NOT_CONFIGURED', message: 'SendGrid API key not configured. Contact support.' } },
      503,
    );
  }

  const body = await c.req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new ValidationError('Invalid email request', fields);
  }

  const { template_type, to, variables } = parsed.data;
  const db = new D1Client(c.env.DB);

  const template = await getOrCreateTemplate(db, tenantId, template_type);
  if (!template.is_active) {
    return c.json(
      { error: { code: 'TEMPLATE_DISABLED', message: `Template '${template_type}' is disabled` } },
      400,
    );
  }

  const subject = replaceVariables(template.subject, variables);
  const htmlContent = replaceVariables(template.body_html, variables);
  const textContent = template.body_text ? replaceVariables(template.body_text, variables) : undefined;

  const logId = generateUlid();
  const now = new Date().toISOString();
  let status = 'sent';
  let sendgridId: string | null = null;
  let error: string | null = null;

  try {
    const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: `framevideos@castelodigital.net`, name: 'Frame Videos' },
        subject,
        content: [
          ...(textContent ? [{ type: 'text/plain', value: textContent }] : []),
          { type: 'text/html', value: htmlContent },
        ],
      }),
    });

    if (!sgResponse.ok) {
      const errBody = await sgResponse.text();
      status = 'failed';
      error = `SendGrid ${sgResponse.status}: ${errBody.slice(0, 500)}`;
      console.error(`[email/send] SendGrid error:`, error);
    } else {
      sendgridId = sgResponse.headers.get('x-message-id') ?? null;
    }
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : 'Unknown send error';
    console.error(`[email/send] Fetch error:`, error);
  }

  // Log the attempt
  await db.execute(
    `INSERT INTO email_log (id, tenant_id, template_type, to_email, subject, status, sendgrid_id, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [logId, tenantId, template_type, to, subject, status, sendgridId, error, now],
  );

  if (status === 'failed') {
    return c.json(
      { error: { code: 'EMAIL_SEND_FAILED', message: error ?? 'Failed to send email' } },
      502,
    );
  }

  return c.json({ success: true, logId, status });
});

// ─── GET /templates — List tenant templates ──────────────────────────────────

email.get('/templates', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const templates = await db.query<{
    id: string;
    template_type: string;
    subject: string;
    is_active: number;
    updated_at: string;
  }>(
    `SELECT id, template_type, subject, is_active, updated_at FROM email_templates WHERE tenant_id = ? ORDER BY template_type`,
    [tenantId],
  );

  // Include defaults that haven't been customized yet
  const existingTypes = new Set((templates ?? []).map((t) => t.template_type));
  const allTemplates = [...(templates ?? [])];

  for (const type of VALID_TEMPLATE_TYPES) {
    if (!existingTypes.has(type)) {
      const defaults = DEFAULT_TEMPLATES[type];
      if (defaults) {
        allTemplates.push({
          id: '',
          template_type: type,
          subject: defaults.subject,
          is_active: 1,
          updated_at: '',
        });
      }
    }
  }

  return c.json({ templates: allTemplates });
});

// ─── PUT /templates/:type — Update template ─────────────────────────────────

email.put('/templates/:type', async (c) => {
  const tenantId = c.get('tenantId')!;
  const templateType = c.req.param('type');

  if (!VALID_TEMPLATE_TYPES.includes(templateType as (typeof VALID_TEMPLATE_TYPES)[number])) {
    throw new NotFoundError(`Template type '${templateType}' not found`);
  }

  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new ValidationError('Invalid template data', fields);
  }

  const db = new D1Client(c.env.DB);
  const now = new Date().toISOString();
  const { subject, body_html, body_text, is_active } = parsed.data;

  const existing = await db.queryOne<{ id: string }>(
    `SELECT id FROM email_templates WHERE tenant_id = ? AND template_type = ?`,
    [tenantId, templateType],
  );

  if (existing) {
    await db.execute(
      `UPDATE email_templates SET subject = ?, body_html = ?, body_text = ?, is_active = COALESCE(?, is_active), updated_at = ?
       WHERE id = ?`,
      [subject, body_html, body_text ?? null, is_active !== undefined ? (is_active ? 1 : 0) : null, now, existing.id],
    );
  } else {
    const id = generateUlid();
    await db.execute(
      `INSERT INTO email_templates (id, tenant_id, template_type, subject, body_html, body_text, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, templateType, subject, body_html, body_text ?? '', is_active !== false ? 1 : 0, now, now],
    );
  }

  return c.json({ success: true, templateType });
});

// ─── GET /log — Email send history (paginated) ──────────────────────────────

email.get('/log', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const page = Math.max(parseInt(c.req.query('page') ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '25', 10), 1), 100);
  const offset = (page - 1) * limit;

  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM email_log WHERE tenant_id = ?`,
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const logs = await db.query<{
    id: string;
    template_type: string;
    to_email: string;
    subject: string;
    status: string;
    error: string | null;
    created_at: string;
  }>(
    `SELECT id, template_type, to_email, subject, status, error, created_at
     FROM email_log
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, limit, offset],
  );

  return c.json({
    logs: logs ?? [],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export { email };
