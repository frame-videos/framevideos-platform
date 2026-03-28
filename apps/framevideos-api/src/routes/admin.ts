// Admin routes — Sprint 9 fix
// Super admin only: tenants, users, plans management

import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { ForbiddenError } from '@frame-videos/shared/errors';

const admin = new Hono<AppContext>();

// Auth + super_admin check
admin.use('/*', authMiddleware());
admin.use('/*', async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'super_admin') {
    throw new ForbiddenError('Acesso restrito a super administradores.');
  }
  await next();
});

// ─── GET /admin/tenants ──────────────────────────────────────────────────────

admin.get('/tenants', async (c) => {
  const db = new D1Client(c.env.DB);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100);
  const offset = parseInt(c.req.query('offset') ?? '0', 10) || 0;

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM tenants',
    [],
  );
  const total = countResult?.total ?? 0;

  const tenants = await db.query<{
    id: string;
    name: string;
    slug: string;
    status: string;
    plan_id: string | null;
    created_at: string;
  }>(
    `SELECT t.id, t.name, t.slug, t.status, s.plan_id, t.created_at
     FROM tenants t
     LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing')
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  // Get plan names
  const plans = await db.query<{ id: string; name: string }>(
    'SELECT id, name FROM plans',
    [],
  );
  const planMap = new Map(plans.map((p) => [p.id, p.name]));

  return c.json({
    data: tenants.map((t) => ({
      ...t,
      plan_name: t.plan_id ? planMap.get(t.plan_id) ?? null : null,
    })),
    pagination: {
      total,
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── GET /admin/users ────────────────────────────────────────────────────────

admin.get('/users', async (c) => {
  const db = new D1Client(c.env.DB);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100);
  const offset = parseInt(c.req.query('offset') ?? '0', 10) || 0;

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM users',
    [],
  );
  const total = countResult?.total ?? 0;

  const users = await db.query<{
    id: string;
    name: string;
    email: string;
    role: string;
    tenant_id: string | null;
    created_at: string;
  }>(
    `SELECT id, name, email, role, tenant_id, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  // Get tenant names
  const tenantIds = [...new Set(users.filter((u) => u.tenant_id).map((u) => u.tenant_id!))];
  let tenantMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const tenants = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM tenants WHERE id IN (${tenantIds.map(() => '?').join(',')})`,
      tenantIds,
    );
    tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
  }

  return c.json({
    data: users.map((u) => ({
      ...u,
      tenant_name: u.tenant_id ? tenantMap.get(u.tenant_id) ?? null : null,
    })),
    pagination: {
      total,
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── GET /admin/plans ────────────────────────────────────────────────────────

admin.get('/plans', async (c) => {
  const db = new D1Client(c.env.DB);

  const plans = await db.query<{
    id: string;
    slug: string;
    name: string;
    price_cents: number;
    max_videos: number;
    max_domains: number;
    max_languages: number;
    llm_credits_monthly: number;
    is_active: number;
  }>(
    'SELECT id, slug, name, price_cents, max_videos, max_domains, max_languages, llm_credits_monthly, is_active FROM plans ORDER BY price_cents ASC',
    [],
  );

  return c.json({ data: plans });
});

export { admin };
