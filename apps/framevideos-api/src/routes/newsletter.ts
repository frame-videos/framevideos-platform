// Newsletter routes — Sprint 9
// Subscribe (public), confirm (public), unsubscribe (public), manage (auth)

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';
import { ValidationError, NotFoundError, ConflictError } from '@frame-videos/shared/errors';
import { subscribeRateLimit } from '../middleware/rate-limit.js';

const newsletter = new Hono<AppContext>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const subscribeSchema = z.object({
  email: z.string().email('Email inválido').max(254),
  tenant_id: z.string().min(1, 'tenant_id is required'),
});

const unsubscribeSchema = z.object({
  email: z.string().email('Email inválido').max(254),
  tenant_id: z.string().min(1, 'tenant_id is required'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    token += chars[b % chars.length];
  }
  return token;
}

// ─── POST /subscribe — Public (no auth) ──────────────────────────────────────

newsletter.post('/subscribe', subscribeRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new ValidationError('Dados inválidos', fields);
  }

  const { email: emailAddr, tenant_id } = parsed.data;
  const normalizedEmail = emailAddr.toLowerCase().trim();
  const db = new D1Client(c.env.DB);

  // Check if already subscribed
  const existing = await db.queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM newsletter_subscribers WHERE tenant_id = ? AND email = ?`,
    [tenant_id, normalizedEmail],
  );

  if (existing) {
    if (existing.status === 'confirmed') {
      return c.json({ success: true, message: 'Você já está inscrito na newsletter.' });
    }
    // Re-send confirmation (update token)
    const token = generateToken();
    await db.execute(
      `UPDATE newsletter_subscribers SET confirm_token = ?, status = 'pending' WHERE id = ?`,
      [token, existing.id],
    );
    return c.json({ success: true, message: 'Um email de confirmação será enviado.' });
  }

  const id = generateUlid();
  const token = generateToken();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO newsletter_subscribers (id, tenant_id, email, status, confirm_token, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [id, tenant_id, normalizedEmail, token, now],
  );

  return c.json({ success: true, message: 'Um email de confirmação será enviado.', confirmToken: token });
});

// ─── GET /confirm/:token — Public (no auth) ─────────────────────────────────

newsletter.get('/confirm/:token', async (c) => {
  const token = c.req.param('token');
  const db = new D1Client(c.env.DB);

  const subscriber = await db.queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM newsletter_subscribers WHERE confirm_token = ?`,
    [token],
  );

  if (!subscriber) {
    throw new NotFoundError('Token de confirmação inválido ou expirado.');
  }

  if (subscriber.status === 'confirmed') {
    return c.json({ success: true, message: 'Inscrição já confirmada.' });
  }

  const now = new Date().toISOString();
  await db.execute(
    `UPDATE newsletter_subscribers SET status = 'confirmed', confirm_token = NULL, subscribed_at = ? WHERE id = ?`,
    [now, subscriber.id],
  );

  return c.json({ success: true, message: 'Inscrição confirmada com sucesso!' });
});

// ─── POST /unsubscribe — Public (no auth) ────────────────────────────────────

newsletter.post('/unsubscribe', async (c) => {
  const body = await c.req.json();
  const parsed = unsubscribeSchema.safeParse(body);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new ValidationError('Dados inválidos', fields);
  }

  const { email: emailAddr, tenant_id } = parsed.data;
  const normalizedEmail = emailAddr.toLowerCase().trim();
  const db = new D1Client(c.env.DB);

  const subscriber = await db.queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM newsletter_subscribers WHERE tenant_id = ? AND email = ?`,
    [tenant_id, normalizedEmail],
  );

  if (!subscriber) {
    // Don't reveal whether email exists
    return c.json({ success: true, message: 'Se inscrito, você foi removido da newsletter.' });
  }

  if (subscriber.status === 'unsubscribed') {
    return c.json({ success: true, message: 'Você já está desinscrito.' });
  }

  const now = new Date().toISOString();
  await db.execute(
    `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE id = ?`,
    [now, subscriber.id],
  );

  return c.json({ success: true, message: 'Inscrição cancelada com sucesso.' });
});

// ─── Auth middleware — applied to management routes BELOW ────────────────────

newsletter.use('/subscribers', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// ─── GET /subscribers — List subscribers (auth, paginated) ───────────────────

newsletter.get('/subscribers', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const page = Math.max(parseInt(c.req.query('page') ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '25', 10), 1), 100);
  const offset = (page - 1) * limit;
  const status = c.req.query('status'); // optional filter: pending, confirmed, unsubscribed

  let countSql = `SELECT COUNT(*) as total FROM newsletter_subscribers WHERE tenant_id = ?`;
  let listSql = `SELECT id, email, status, subscribed_at, unsubscribed_at, created_at FROM newsletter_subscribers WHERE tenant_id = ?`;
  const params: unknown[] = [tenantId];

  if (status && ['pending', 'confirmed', 'unsubscribed'].includes(status)) {
    countSql += ` AND status = ?`;
    listSql += ` AND status = ?`;
    params.push(status);
  }

  const countResult = await db.queryOne<{ total: number }>(countSql, params);
  const total = countResult?.total ?? 0;

  listSql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const subscribers = await db.query<{
    id: string;
    email: string;
    status: string;
    subscribed_at: string | null;
    unsubscribed_at: string | null;
    created_at: string;
  }>(listSql, [...params, limit, offset]);

  return c.json({
    subscribers: subscribers ?? [],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export { newsletter };
