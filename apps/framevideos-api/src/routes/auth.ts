// Rotas de autenticação — Sprint 1
// signup, login, logout, refresh — implementação completa

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import {
  hashPassword,
  verifyPassword,
  createSession,
  refreshSession,
  invalidateSession,
  verifyToken,
} from '@frame-videos/auth';
import {
  generateUlid,
  slugify,
  validateEmail,
} from '@frame-videos/shared/utils';
import {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '@frame-videos/shared/errors';
import { SYSTEM_LIMITS } from '@frame-videos/shared/constants';
import { loginRateLimit, signupRateLimit } from '../middleware/rate-limit.js';
import { authMiddleware } from '@frame-videos/auth';
import { rateLimit } from '../middleware/rate-limit.js';

const auth = new Hono<AppContext>();

// ─── Schemas de validação ────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email('Invalid email format').max(254),
  password: z
    .string()
    .min(SYSTEM_LIMITS.MIN_PASSWORD_LENGTH, `Password must be at least ${SYSTEM_LIMITS.MIN_PASSWORD_LENGTH} characters`)
    .max(SYSTEM_LIMITS.MAX_PASSWORD_LENGTH, `Password must be at most ${SYSTEM_LIMITS.MAX_PASSWORD_LENGTH} characters`),
  name: z.string().min(1, 'Name is required').max(200),
  tenantName: z.string().min(1, 'Tenant name is required').max(200),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(SYSTEM_LIMITS.MIN_PASSWORD_LENGTH, `Password must be at least ${SYSTEM_LIMITS.MIN_PASSWORD_LENGTH} characters`)
    .max(SYSTEM_LIMITS.MAX_PASSWORD_LENGTH, `Password must be at most ${SYSTEM_LIMITS.MAX_PASSWORD_LENGTH} characters`),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(SYSTEM_LIMITS.MIN_PASSWORD_LENGTH, `Password must be at least ${SYSTEM_LIMITS.MIN_PASSWORD_LENGTH} characters`)
    .max(SYSTEM_LIMITS.MAX_PASSWORD_LENGTH, `Password must be at most ${SYSTEM_LIMITS.MAX_PASSWORD_LENGTH} characters`),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(254),
  password: z
    .string()
    .min(SYSTEM_LIMITS.MIN_PASSWORD_LENGTH, `Password must be at least ${SYSTEM_LIMITS.MIN_PASSWORD_LENGTH} characters`)
    .max(SYSTEM_LIMITS.MAX_PASSWORD_LENGTH, `Password must be at most ${SYSTEM_LIMITS.MAX_PASSWORD_LENGTH} characters`),
  name: z.string().min(1, 'Name is required').max(200),
  tenantId: z.string().optional(),
});

// ─── Rate limiters ───────────────────────────────────────────────────────────

const forgotPasswordRateLimit = rateLimit({
  limit: 3,
  windowSeconds: 300,
  prefix: 'auth:forgot-password',
  keyGenerator: (c) =>
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown',
});

const registerRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 60,
  prefix: 'auth:register',
  keyGenerator: (c) =>
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure random hex token (32 bytes = 64 chars) */
async function generateResetToken(): Promise<string> {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Send welcome email via SendGrid (best-effort, never breaks signup) */
async function sendWelcomeEmail(
  env: { SENDGRID_API_KEY?: string },
  to: string,
  name: string,
  slug: string,
): Promise<void> {
  const adminUrl = `https://${slug}.sites.framevideos.com/admin/login`;

  if (!env.SENDGRID_API_KEY) {
    console.log(`[auth/signup] Welcome email skipped (no SENDGRID_API_KEY): ${to} → ${adminUrl}`);
    return;
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'framevideos@castelodigital.net', name: 'Frame Videos' },
        subject: 'Bem-vindo ao Frame Videos! 🎬',
        content: [
          {
            type: 'text/plain',
            value: `Olá ${name}!\n\nBem-vindo ao Frame Videos! Seu site está pronto.\n\nAcesse o painel admin em: ${adminUrl}\nUse seu email e senha para entrar.\n\nQualquer dúvida, estamos aqui!\n\nEquipe Frame Videos`,
          },
          {
            type: 'text/html',
            value: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#8b5cf6;">Bem-vindo ao Frame Videos! 🎬</h1>
<p>Olá <strong>${name}</strong>,</p>
<p>Seu site está pronto! Acesse o painel admin para começar a gerenciar seu conteúdo:</p>
<a href="${adminUrl}" style="display:inline-block;padding:12px 24px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Acessar Painel Admin</a>
<p style="margin-top:16px;color:#666;">Use seu email (<strong>${to}</strong>) e a senha que você cadastrou.</p>
<p style="color:#666;font-size:12px;margin-top:24px;">Se você não criou esta conta, ignore este email.</p>
</div>`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[auth/signup] Welcome email failed: ${res.status} ${errText.slice(0, 300)}`);
    } else {
      console.log(`[auth/signup] Welcome email sent to ${to}`);
    }
  } catch (err) {
    console.error(`[auth/signup] Welcome email error:`, err);
  }
}

// ─── POST /signup ────────────────────────────────────────────────────────────

auth.post('/signup', signupRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid signup data', fieldErrors);
  }

  const { email, password, name, tenantName } = parsed.data;
  const db = new D1Client(c.env.DB);

  // Verificar se email já existe (global, não scoped por tenant)
  const existingUser = await db.queryOne<{ id: string }>(
    `SELECT id FROM users WHERE email = ?`,
    [email.toLowerCase()],
  );

  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }

  // Gerar IDs
  const tenantId = generateUlid();
  const userId = generateUlid();
  const walletId = generateUlid();
  const tenantSlug = slugify(tenantName) || `tenant-${tenantId.toLowerCase().slice(0, 8)}`;

  // Hash da senha
  const passwordHash = await hashPassword(password);

  // Buscar plano Free
  const freePlan = await db.queryOne<{ id: string }>(
    `SELECT id FROM plans WHERE slug = 'free'`,
    [],
  );

  if (!freePlan) {
    throw new Error('Free plan not found — run migrations first');
  }

  // Criar tudo em batch (transação atômica no D1)
  await db.batch([
    // 1. Criar tenant
    {
      sql: `INSERT INTO tenants (id, name, slug, status, plan_id, owner_user_id, default_locale)
            VALUES (?, ?, ?, 'trial', ?, ?, 'pt_BR')`,
      params: [tenantId, tenantName, tenantSlug, freePlan.id, userId],
    },
    // 2. Criar usuário (tenant_admin)
    {
      sql: `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
            VALUES (?, ?, ?, ?, ?, 'tenant_admin', 1)`,
      params: [userId, tenantId, email.toLowerCase(), passwordHash, name],
    },
    // 3. Criar LLM wallet com créditos iniciais do plano Free
    {
      sql: `INSERT INTO llm_wallets (id, tenant_id, balance, total_credited, total_debited)
            VALUES (?, ?, 50, 50, 0)`,
      params: [walletId, tenantId],
    },
    // 4. Criar subscription trial
    {
      sql: `INSERT INTO subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end)
            VALUES (?, ?, ?, 'trialing', datetime('now'), datetime('now', '+30 days'))`,
      params: [generateUlid(), tenantId, freePlan.id],
    },
    // 5. Audit log
    {
      sql: `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address)
            VALUES (?, ?, ?, 'signup', 'user', ?, ?)`,
      params: [
        generateUlid(),
        tenantId,
        userId,
        userId,
        c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
      ],
    },
  ]);

  // Criar sessão e gerar tokens
  const { accessToken, refreshToken } = await createSession(
    db,
    userId,
    tenantId,
    'tenant_admin',
    c.env.JWT_SECRET,
    c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For'),
    c.req.header('User-Agent'),
  );

  // Send welcome email (best-effort, non-blocking)
  c.executionCtx.waitUntil(
    sendWelcomeEmail(c.env, email.toLowerCase(), name, tenantSlug),
  );

  return c.json(
    {
      user: {
        id: userId,
        email: email.toLowerCase(),
        name,
        role: 'tenant_admin',
      },
      tenant: {
        id: tenantId,
        name: tenantName,
        slug: tenantSlug,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    },
    201,
  );
});

// ─── POST /login ─────────────────────────────────────────────────────────────

auth.post('/login', loginRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid login data', fieldErrors);
  }

  const { email, password } = parsed.data;
  const db = new D1Client(c.env.DB);

  // Buscar usuário por email
  const user = await db.queryOne<{
    id: string;
    tenant_id: string;
    email: string;
    password_hash: string;
    name: string;
    role: string;
    is_active: number;
    must_change_password: number;
  }>(
    `SELECT id, tenant_id, email, password_hash, name, role, is_active, must_change_password
     FROM users WHERE email = ?`,
    [email.toLowerCase()],
  );

  if (!user) {
    // Mensagem genérica pra não revelar se o email existe
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.is_active) {
    throw new UnauthorizedError('Account is deactivated');
  }

  // Verificar senha
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Verificar status do tenant
  const tenant = await db.queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM tenants WHERE id = ?`,
    [user.tenant_id],
  );

  if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled') {
    throw new UnauthorizedError('Tenant account is not active');
  }

  // Atualizar last_login_at
  await db.execute(
    `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
    [user.id],
  );

  // Criar sessão
  const { accessToken, refreshToken } = await createSession(
    db,
    user.id,
    user.tenant_id,
    user.role,
    c.env.JWT_SECRET,
    c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For'),
    c.req.header('User-Agent'),
  );

  // Audit log
  await db.execute(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address)
     VALUES (?, ?, ?, 'login', 'user', ?, ?)`,
    [
      generateUlid(),
      user.tenant_id,
      user.id,
      user.id,
      c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
    ],
  );

  const response: Record<string, unknown> = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant_id,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };

  if (user.must_change_password === 1) {
    response.mustChangePassword = true;
  }

  return c.json(response);
});

// ─── POST /logout ────────────────────────────────────────────────────────────

auth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing authentication token');
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const db = new D1Client(c.env.DB);

  // Buscar sessão do usuário (a mais recente)
  const session = await db.queryOne<{ id: string }>(
    `SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [payload.sub],
  );

  if (session) {
    await invalidateSession(db, session.id);
  }

  // Audit log
  await db.execute(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address)
     VALUES (?, ?, ?, 'logout', 'user', ?, ?)`,
    [
      generateUlid(),
      payload.tid,
      payload.sub,
      payload.sub,
      c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
    ],
  );

  return c.json({ success: true });
});

// ─── POST /refresh ───────────────────────────────────────────────────────────

auth.post('/refresh', async (c) => {
  const body = await c.req.json();
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Refresh token is required');
  }

  const db = new D1Client(c.env.DB);

  const { accessToken, refreshToken: newRefreshToken } = await refreshSession(
    db,
    parsed.data.refreshToken,
    c.env.JWT_SECRET,
  );

  return c.json({
    tokens: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

// ─── POST /forgot-password ───────────────────────────────────────────────────

auth.post('/forgot-password', forgotPasswordRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid request data', fieldErrors);
  }

  const { email } = parsed.data;
  const db = new D1Client(c.env.DB);

  // Always return success to not reveal if email exists (timing-safe)
  const user = await db.queryOne<{ id: string }>(
    `SELECT id FROM users WHERE email = ? AND is_active = 1`,
    [email.toLowerCase()],
  );

  if (user) {
    const token = await generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.execute(
      `UPDATE users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?`,
      [token, expiresAt, user.id],
    );

    // Send reset email via SendGrid (best-effort)
    if (c.env.SENDGRID_API_KEY) {
      const resetUrl = `${c.req.header('Origin') ?? 'https://framevideos.com'}/reset-password?token=${token}`;
      c.executionCtx.waitUntil(
        fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: email.toLowerCase() }] }],
            from: { email: 'framevideos@castelodigital.net', name: 'Frame Videos' },
            subject: 'Redefinir sua senha — Frame Videos',
            content: [
              {
                type: 'text/plain',
                value: `Você solicitou a redefinição de senha.\n\nAcesse: ${resetUrl}\n\nEste link expira em 1 hora.\n\nSe você não solicitou, ignore este email.`,
              },
              {
                type: 'text/html',
                value: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h1 style="color:#8b5cf6;">Redefinir senha</h1>
<p>Você solicitou a redefinição de senha da sua conta.</p>
<a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Redefinir senha</a>
<p style="color:#666;font-size:12px;margin-top:24px;">Este link expira em 1 hora. Se você não solicitou, ignore este email.</p>
</div>`,
              },
            ],
          }),
        }).catch((err) => console.error('[auth/forgot-password] Email error:', err)),
      );
    } else {
      console.log(`[auth/forgot-password] Reset token for ${email.toLowerCase()}: ${token} (no SendGrid configured)`);
    }
  }

  // Always return success (don't reveal if email exists)
  return c.json({ success: true, message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.' });
});

// ─── POST /reset-password ────────────────────────────────────────────────────

auth.post('/reset-password', async (c) => {
  const body = await c.req.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid request data', fieldErrors);
  }

  const { token, password } = parsed.data;
  const db = new D1Client(c.env.DB);

  // Find user by reset token
  const user = await db.queryOne<{
    id: string;
    password_reset_expires_at: string;
  }>(
    `SELECT id, password_reset_expires_at FROM users WHERE password_reset_token = ? AND is_active = 1`,
    [token],
  );

  if (!user) {
    throw new UnauthorizedError('Token inválido ou expirado');
  }

  // Check expiration
  if (!user.password_reset_expires_at || new Date(user.password_reset_expires_at) < new Date()) {
    // Clear expired token
    await db.execute(
      `UPDATE users SET password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?`,
      [user.id],
    );
    throw new UnauthorizedError('Token expirado. Solicite uma nova redefinição de senha.');
  }

  // Hash new password and update
  const passwordHash = await hashPassword(password);
  await db.execute(
    `UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL, must_change_password = 0 WHERE id = ?`,
    [passwordHash, user.id],
  );

  // Audit log
  await db.execute(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address)
     VALUES (?, (SELECT tenant_id FROM users WHERE id = ?), ?, 'password_reset', 'user', ?, ?)`,
    [
      generateUlid(),
      user.id,
      user.id,
      user.id,
      c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
    ],
  );

  return c.json({ success: true, message: 'Senha redefinida com sucesso.' });
});

// ─── POST /change-password ───────────────────────────────────────────────────

auth.post('/change-password', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
}, async (c) => {
  const body = await c.req.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid request data', fieldErrors);
  }

  const { currentPassword, newPassword } = parsed.data;
  const userId = c.get('userId')!;
  const db = new D1Client(c.env.DB);

  // Get current password hash
  const user = await db.queryOne<{ password_hash: string; tenant_id: string }>(
    `SELECT password_hash, tenant_id FROM users WHERE id = ? AND is_active = 1`,
    [userId],
  );

  if (!user) {
    throw new NotFoundError('Usuário não encontrado');
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError('Senha atual incorreta');
  }

  // Hash and update new password
  const passwordHash = await hashPassword(newPassword);
  await db.execute(
    `UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`,
    [passwordHash, userId],
  );

  // Audit log
  await db.execute(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address)
     VALUES (?, ?, ?, 'password_change', 'user', ?, ?)`,
    [
      generateUlid(),
      user.tenant_id,
      userId,
      userId,
      c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
    ],
  );

  return c.json({ success: true, message: 'Senha alterada com sucesso.' });
});

// ─── POST /register — Visitor registration for tenant sites ──────────────────

auth.post('/register', registerRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid registration data', fieldErrors);
  }

  const { email, password, name } = parsed.data;
  // tenantId from body or X-Tenant-Id header
  const tenantId = parsed.data.tenantId ?? c.req.header('X-Tenant-Id');

  if (!tenantId) {
    throw new ValidationError('Tenant ID is required', [
      { field: 'tenantId', message: 'Tenant ID must be provided via body or X-Tenant-Id header' },
    ]);
  }

  const db = new D1Client(c.env.DB);

  // Verify tenant exists and is active
  const tenant = await db.queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM tenants WHERE id = ?`,
    [tenantId],
  );

  if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled') {
    throw new NotFoundError('Tenant not found or not active');
  }

  // Check if email already exists in this tenant
  const existingUser = await db.queryOne<{ id: string }>(
    `SELECT id FROM users WHERE tenant_id = ? AND email = ?`,
    [tenantId, email.toLowerCase()],
  );

  if (existingUser) {
    throw new ConflictError('Uma conta com este email já existe');
  }

  const userId = generateUlid();
  const passwordHash = await hashPassword(password);

  await db.batch([
    {
      sql: `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
            VALUES (?, ?, ?, ?, ?, 'tenant_user', 1)`,
      params: [userId, tenantId, email.toLowerCase(), passwordHash, name],
    },
    {
      sql: `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address)
            VALUES (?, ?, ?, 'register', 'user', ?, ?)`,
      params: [
        generateUlid(),
        tenantId,
        userId,
        userId,
        c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
      ],
    },
  ]);

  // Create session and generate tokens
  const { accessToken, refreshToken } = await createSession(
    db,
    userId,
    tenantId,
    'tenant_user',
    c.env.JWT_SECRET,
    c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For'),
    c.req.header('User-Agent'),
  );

  return c.json(
    {
      user: {
        id: userId,
        email: email.toLowerCase(),
        name,
        role: 'tenant_user',
        tenantId,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    },
    201,
  );
});

export { auth };
