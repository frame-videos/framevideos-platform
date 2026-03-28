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
  }>(
    `SELECT id, tenant_id, email, password_hash, name, role, is_active
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

  return c.json({
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
  });
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

export { auth };
