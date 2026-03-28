// Admin routes — Sprint 9 fix + Polish CRUD
// Super admin only: tenants, users, plans, revenue, LLM config management

import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { ForbiddenError, NotFoundError, ValidationError } from '@frame-videos/shared/errors';
import { generateUlid } from '@frame-videos/shared/utils';

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

// ─── PUT /admin/plans/:id ────────────────────────────────────────────────────

admin.put('/plans/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM plans WHERE id = ?',
    [id],
  );
  if (!existing) throw new NotFoundError('Plan not found');

  const { name, price_cents, max_videos, max_domains, max_languages, llm_credits_monthly, features } = body;

  if (!name || typeof name !== 'string') {
    throw new ValidationError('Name is required');
  }

  await db.execute(
    `UPDATE plans SET
       name = ?,
       price_cents = ?,
       max_videos = ?,
       max_domains = ?,
       max_languages = ?,
       llm_credits_monthly = ?
     WHERE id = ?`,
    [
      name,
      price_cents ?? 0,
      max_videos ?? -1,
      max_domains ?? 1,
      max_languages ?? 1,
      llm_credits_monthly ?? 0,
      id,
    ],
  );

  return c.json({ success: true });
});

// ─── PATCH /admin/plans/:id/status ───────────────────────────────────────────

admin.patch('/plans/:id/status', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM plans WHERE id = ?',
    [id],
  );
  if (!existing) throw new NotFoundError('Plan not found');

  const isActive = body.is_active ? 1 : 0;
  await db.execute('UPDATE plans SET is_active = ? WHERE id = ?', [isActive, id]);

  return c.json({ success: true, is_active: isActive });
});

// ─── GET /admin/revenue ──────────────────────────────────────────────────────

admin.get('/revenue', async (c) => {
  const db = new D1Client(c.env.DB);

  // MRR by plan (active/trialing subscriptions)
  const mrrByPlan = await db.query<{
    plan_id: string;
    plan_name: string;
    subscriber_count: number;
    mrr_cents: number;
  }>(
    `SELECT
       p.id as plan_id,
       p.name as plan_name,
       COUNT(s.id) as subscriber_count,
       COALESCE(SUM(p.price_cents), 0) as mrr_cents
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.status IN ('active', 'trialing')
     GROUP BY p.id, p.name
     ORDER BY mrr_cents DESC`,
    [],
  );

  const totalMrrCents = mrrByPlan.reduce((sum, r) => sum + r.mrr_cents, 0);

  // Credits purchased (LLM transactions of type 'purchase')
  const creditsPurchased = await db.queryOne<{ total_cents: number; total_credits: number }>(
    `SELECT
       COALESCE(SUM(amount_cents), 0) as total_cents,
       COALESCE(SUM(credits), 0) as total_credits
     FROM llm_transactions
     WHERE type = 'purchase'`,
    [],
  );

  // LLM cost (transactions of type 'usage')
  const llmCost = await db.queryOne<{ total_cost_cents: number }>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total_cost_cents
     FROM llm_transactions
     WHERE type = 'usage'`,
    [],
  );

  // Ad revenue (platform share)
  const adRevenue = await db.queryOne<{ platform_share_cents: number }>(
    `SELECT COALESCE(SUM(platform_share_cents), 0) as platform_share_cents
     FROM ad_revenue_share`,
    [],
  ).catch(() => ({ platform_share_cents: 0 }));

  const creditsRevenueCents = creditsPurchased?.total_cents ?? 0;
  const llmCostCents = llmCost?.total_cost_cents ?? 0;
  const adRevenueCents = adRevenue?.platform_share_cents ?? 0;

  return c.json({
    data: {
      mrr: {
        totalCents: totalMrrCents,
        byPlan: mrrByPlan,
      },
      credits: {
        revenueCents: creditsRevenueCents,
        totalCreditsSold: creditsPurchased?.total_credits ?? 0,
      },
      llmCost: {
        totalCostCents: llmCostCents,
      },
      adRevenue: {
        platformShareCents: adRevenueCents,
      },
      margin: {
        totalRevenueCents: totalMrrCents + creditsRevenueCents + adRevenueCents,
        totalCostCents: llmCostCents,
        marginCents: totalMrrCents + creditsRevenueCents + adRevenueCents - llmCostCents,
      },
    },
  });
});

// ─── GET /admin/llm-packages ─────────────────────────────────────────────────

admin.get('/llm-packages', async (c) => {
  const db = new D1Client(c.env.DB);

  const packages = await db.query<{
    id: string;
    credits: number;
    price_cents: number;
    cost_cents: number;
    is_active: number;
    created_at: string;
  }>(
    'SELECT id, credits, price_cents, cost_cents, is_active, created_at FROM llm_packages ORDER BY credits ASC',
    [],
  ).catch(() => []);

  return c.json({ data: packages });
});

// ─── PUT /admin/llm-packages/:id ────────────────────────────────────────────

admin.put('/llm-packages/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_packages WHERE id = ?',
    [id],
  ).catch(() => null);

  if (!existing) throw new NotFoundError('LLM package not found');

  const { credits, price_cents, cost_cents, is_active } = body;

  await db.execute(
    `UPDATE llm_packages SET credits = ?, price_cents = ?, cost_cents = ?, is_active = ? WHERE id = ?`,
    [credits, price_cents, cost_cents ?? 0, is_active ? 1 : 0, id],
  );

  return c.json({ success: true });
});

// ─── GET /admin/llm-config ───────────────────────────────────────────────────

admin.get('/llm-config', async (c) => {
  const db = new D1Client(c.env.DB);

  const config = await db.queryOne<{
    id: string;
    markup_percent: number;
    provider: string;
    model: string;
  }>(
    'SELECT id, markup_percent, provider, model FROM llm_config LIMIT 1',
    [],
  ).catch(() => null);

  return c.json({
    data: config ?? {
      id: null,
      markup_percent: 150,
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
  });
});

// ─── PUT /admin/llm-config ───────────────────────────────────────────────────

admin.put('/llm-config', async (c) => {
  const body = await c.req.json();
  const db = new D1Client(c.env.DB);
  const { markup_percent, provider, model } = body;

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_config LIMIT 1',
    [],
  ).catch(() => null);

  if (existing) {
    await db.execute(
      'UPDATE llm_config SET markup_percent = ?, provider = ?, model = ? WHERE id = ?',
      [markup_percent ?? 150, provider ?? 'openai', model ?? 'gpt-4o-mini', existing.id],
    );
  } else {
    const configId = generateUlid();
    await db.execute(
      'INSERT INTO llm_config (id, markup_percent, provider, model) VALUES (?, ?, ?, ?)',
      [configId, markup_percent ?? 150, provider ?? 'openai', model ?? 'gpt-4o-mini'],
    );
  }

  return c.json({ success: true });
});

// ─── GET /admin/stats ────────────────────────────────────────────────────────

admin.get('/stats', async (c) => {
  const db = new D1Client(c.env.DB);

  const [tenantCount, userCount, videoCount, revenueData] = await Promise.all([
    db.queryOne<{ total: number }>('SELECT COUNT(*) as total FROM tenants', []),
    db.queryOne<{ total: number }>('SELECT COUNT(*) as total FROM users', []),
    db.queryOne<{ total: number }>('SELECT COUNT(*) as total FROM videos', []).catch(() => ({ total: 0 })),
    db.queryOne<{ total_cents: number }>(
      `SELECT COALESCE(SUM(p.price_cents), 0) as total_cents
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.status IN ('active', 'trialing')`,
      [],
    ).catch(() => ({ total_cents: 0 })),
  ]);

  return c.json({
    data: {
      totalTenants: tenantCount?.total ?? 0,
      totalUsers: userCount?.total ?? 0,
      totalVideos: videoCount?.total ?? 0,
      mrrCents: revenueData?.total_cents ?? 0,
    },
  });
});

export { admin };
