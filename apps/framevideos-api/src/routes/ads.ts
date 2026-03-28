// Rotas do sistema de anúncios — Sprint 10b
// CRUD campanhas, criativos, placements, serving, tracking, revenue share

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@frame-videos/shared/errors';

const ads = new Hono<AppContext>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginationParams(c: { req: { query: (k: string) => string | undefined } }, defaultLimit = 24) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? String(defaultLimit), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/** SHA-256 hash of IP for privacy */
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const STORAGE_PUBLIC_URL = 'https://storage.framevideos.com';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  budgetCents: z.number().int().min(100, 'Orçamento mínimo: R$ 1,00'),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  budgetCents: z.number().int().min(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
});

const statusTransitionSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled']),
});

const createCreativeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  creativeType: z.enum(['image', 'video', 'html']),
  contentUrl: z.string().url('URL do criativo é obrigatória'),
  targetUrl: z.string().url('URL de destino é obrigatória'),
});

const updateCreativeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contentUrl: z.string().url().optional(),
  targetUrl: z.string().url().optional(),
});

const creativeStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'active', 'paused']),
});

const createPlacementSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  position: z.enum(['header', 'sidebar', 'in_content', 'footer', 'overlay']),
  width: z.number().int().min(1).max(2000),
  height: z.number().int().min(1).max(2000),
});

const updatePlacementSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  position: z.enum(['header', 'sidebar', 'in_content', 'footer', 'overlay']).optional(),
  width: z.number().int().min(1).max(2000).optional(),
  height: z.number().int().min(1).max(2000).optional(),
  isActive: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /serve — Ad serving endpoint (weighted random by remaining budget)
ads.get('/serve', async (c) => {
  const placementId = c.req.query('placement');
  const tenantId = c.req.query('tenant');

  if (!placementId || !tenantId) {
    return c.json({ error: 'placement and tenant are required' }, 400);
  }

  const db = new D1Client(c.env.DB);

  // Verify placement exists and is active
  const placement = await db.queryOne<{
    id: string; name: string; position: string; width: number; height: number; is_active: number;
  }>(
    'SELECT id, name, position, width, height, is_active FROM ad_placements WHERE id = ? AND tenant_id = ? AND is_active = 1',
    [placementId, tenantId],
  );

  if (!placement) {
    return c.body('', 204);
  }

  // Fetch active creatives for this tenant with remaining budget
  const creatives = await db.query<{
    id: string; content_url: string; target_url: string; creative_type: string;
    campaign_id: string; budget_cents: number; spent_cents: number;
  }>(
    `SELECT ac.id, ac.content_url, ac.target_url, ac.creative_type,
            ac.campaign_id, camp.budget_cents, camp.spent_cents
     FROM ad_creatives ac
     JOIN ad_campaigns camp ON camp.id = ac.campaign_id
     WHERE ac.tenant_id = ?
       AND ac.status = 'active'
       AND camp.status = 'active'
       AND camp.budget_cents > camp.spent_cents
       AND camp.start_date <= date('now')
       AND (camp.end_date IS NULL OR camp.end_date >= date('now'))
     ORDER BY (camp.budget_cents - camp.spent_cents) DESC`,
    [tenantId],
  );

  if (creatives.length === 0) {
    return c.body('', 204);
  }

  // Rate limit check via KV (1 impression per IP/creative/5min)
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '0.0.0.0';
  const ipHash = await hashIp(ip);

  // Weighted random selection by remaining budget
  const totalWeight = creatives.reduce((sum, cr) => sum + (cr.budget_cents - cr.spent_cents), 0);
  let random = Math.random() * totalWeight;
  let selected = creatives[0]!;

  for (const cr of creatives) {
    random -= (cr.budget_cents - cr.spent_cents);
    if (random <= 0) {
      selected = cr;
      break;
    }
  }

  // Check rate limit via KV
  const rateLimitKey = `ad:imp:${selected.id}:${ipHash}`;
  const existing = await c.env.CACHE.get(rateLimitKey);
  if (existing) {
    // Already served to this IP recently, still show the ad but don't count impression
    const html = buildAdHtml(selected, placementId, placement, false);
    return c.html(html);
  }

  // Set rate limit (5 min TTL)
  await c.env.CACHE.put(rateLimitKey, '1', { expirationTtl: 300 });

  const html = buildAdHtml(selected, placementId, placement, true);
  return c.html(html);
});

function buildAdHtml(
  creative: { id: string; content_url: string; target_url: string; creative_type: string },
  placementId: string,
  placement: { width: number; height: number },
  trackImpression: boolean,
): string {
  const clickUrl = `/api/v1/ads/track/click?c=${encodeURIComponent(creative.id)}&p=${encodeURIComponent(placementId)}`;
  const impressionUrl = `/api/v1/ads/track/impression?c=${encodeURIComponent(creative.id)}&p=${encodeURIComponent(placementId)}`;

  let contentHtml = '';
  if (creative.creative_type === 'image') {
    contentHtml = `<img src="${escHtml(creative.content_url)}" alt="ad" width="${placement.width}" height="${placement.height}" style="display:block;max-width:100%;height:auto;" />`;
  } else if (creative.creative_type === 'video') {
    contentHtml = `<video src="${escHtml(creative.content_url)}" width="${placement.width}" height="${placement.height}" autoplay muted loop playsinline style="display:block;max-width:100%;height:auto;"></video>`;
  } else {
    // HTML creative — render as-is (sanitized at upload time)
    contentHtml = `<iframe src="${escHtml(creative.content_url)}" width="${placement.width}" height="${placement.height}" frameborder="0" scrolling="no" style="display:block;max-width:100%;"></iframe>`;
  }

  const trackingPixel = trackImpression
    ? `<img src="${impressionUrl}" width="1" height="1" alt="" style="position:absolute;left:-9999px;" />`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{margin:0;padding:0;overflow:hidden;background:transparent;}
a{display:block;text-decoration:none;}
</style></head><body>
<a href="${escHtml(clickUrl)}" target="_blank" rel="noopener nofollow">${contentHtml}</a>
${trackingPixel}
</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// POST /track/impression — Register ad impression (returns 204)
ads.post('/track/impression', async (c) => {
  const creativeId = c.req.query('c');
  const placementId = c.req.query('p');

  if (!creativeId || !placementId) {
    return c.body('', 204);
  }

  try {
    const db = new D1Client(c.env.DB);
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '0.0.0.0';
    const ipHash = await hashIp(ip);
    const userAgent = c.req.header('user-agent') ?? '';
    const pageUrl = c.req.header('referer') ?? '';

    // Get tenant_id from creative
    const creative = await db.queryOne<{ tenant_id: string; campaign_id: string }>(
      'SELECT tenant_id, campaign_id FROM ad_creatives WHERE id = ?',
      [creativeId],
    );

    if (!creative) return c.body('', 204);

    const impressionId = generateUlid();
    const today = new Date().toISOString().slice(0, 10);
    const dailyStatsId = generateUlid();

    // Calculate CPM cost (fixed $1 CPM = 0.1 cents per impression)
    const costPerImpression = 1; // 0.01 dollar = 1 cent per 1000 impressions -> 0.1 cents per impression
    // Actually let's do a simpler model: $2 CPM = 0.2 cents per impression
    const cpmCostCents = 0; // For now impressions are free, cost on click (CPC model)

    await db.batch([
      {
        sql: `INSERT INTO ad_impressions (id, creative_id, tenant_id, placement_id, ip_hash, user_agent, page_url)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [impressionId, creativeId, creative.tenant_id, placementId, ipHash, userAgent, pageUrl],
      },
      {
        sql: `UPDATE ad_creatives SET impressions = impressions + 1, updated_at = datetime('now') WHERE id = ?`,
        params: [creativeId],
      },
      {
        sql: `INSERT INTO ad_daily_stats (id, creative_id, tenant_id, date, impressions, clicks, spent_cents)
              VALUES (?, ?, ?, ?, 1, 0, 0)
              ON CONFLICT(creative_id, tenant_id, date) DO UPDATE SET impressions = impressions + 1`,
        params: [dailyStatsId, creativeId, creative.tenant_id, today],
      },
    ]);
  } catch {
    // Never break on tracking errors
  }

  return c.body('', 204);
});

// POST /track/click — Register ad click (returns 302 redirect)
ads.post('/track/click', async (c) => {
  const creativeId = c.req.query('c');
  const placementId = c.req.query('p');

  if (!creativeId || !placementId) {
    return c.redirect('/', 302);
  }

  const db = new D1Client(c.env.DB);

  const creative = await db.queryOne<{ tenant_id: string; target_url: string; campaign_id: string }>(
    'SELECT tenant_id, target_url, campaign_id FROM ad_creatives WHERE id = ?',
    [creativeId],
  );

  if (!creative) {
    return c.redirect('/', 302);
  }

  try {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '0.0.0.0';
    const ipHash = await hashIp(ip);
    const userAgent = c.req.header('user-agent') ?? '';
    const referrer = c.req.header('referer') ?? '';

    const clickId = generateUlid();
    const today = new Date().toISOString().slice(0, 10);
    const dailyStatsId = generateUlid();

    // CPC model: charge per click (e.g., 10 cents per click)
    const cpcCostCents = 10;

    await db.batch([
      {
        sql: `INSERT INTO ad_clicks (id, creative_id, tenant_id, placement_id, ip_hash, user_agent, referrer)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [clickId, creativeId, creative.tenant_id, placementId, ipHash, userAgent, referrer],
      },
      {
        sql: `UPDATE ad_creatives SET clicks = clicks + 1, updated_at = datetime('now') WHERE id = ?`,
        params: [creativeId],
      },
      {
        sql: `UPDATE ad_campaigns SET spent_cents = spent_cents + ?, updated_at = datetime('now') WHERE id = ?`,
        params: [cpcCostCents, creative.campaign_id],
      },
      {
        sql: `INSERT INTO ad_daily_stats (id, creative_id, tenant_id, date, impressions, clicks, spent_cents)
              VALUES (?, ?, ?, ?, 0, 1, ?)
              ON CONFLICT(creative_id, tenant_id, date) DO UPDATE SET clicks = clicks + 1, spent_cents = spent_cents + ?`,
        params: [dailyStatsId, creativeId, creative.tenant_id, today, cpcCostCents, cpcCostCents],
      },
    ]);
  } catch {
    // Never break on tracking errors
  }

  return c.redirect(creative.target_url, 302);
});

// Also support GET for click tracking (from <a> tags)
ads.get('/track/click', async (c) => {
  const creativeId = c.req.query('c');
  const placementId = c.req.query('p');

  if (!creativeId || !placementId) {
    return c.redirect('/', 302);
  }

  const db = new D1Client(c.env.DB);

  const creative = await db.queryOne<{ tenant_id: string; target_url: string; campaign_id: string }>(
    'SELECT tenant_id, target_url, campaign_id FROM ad_creatives WHERE id = ?',
    [creativeId],
  );

  if (!creative) {
    return c.redirect('/', 302);
  }

  try {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '0.0.0.0';
    const ipHash = await hashIp(ip);
    const userAgent = c.req.header('user-agent') ?? '';
    const referrer = c.req.header('referer') ?? '';

    const clickId = generateUlid();
    const today = new Date().toISOString().slice(0, 10);
    const dailyStatsId = generateUlid();
    const cpcCostCents = 10;

    await db.batch([
      {
        sql: `INSERT INTO ad_clicks (id, creative_id, tenant_id, placement_id, ip_hash, user_agent, referrer)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [clickId, creativeId, creative.tenant_id, placementId, ipHash, userAgent, referrer],
      },
      {
        sql: `UPDATE ad_creatives SET clicks = clicks + 1, updated_at = datetime('now') WHERE id = ?`,
        params: [creativeId],
      },
      {
        sql: `UPDATE ad_campaigns SET spent_cents = spent_cents + ?, updated_at = datetime('now') WHERE id = ?`,
        params: [cpcCostCents, creative.campaign_id],
      },
      {
        sql: `INSERT INTO ad_daily_stats (id, creative_id, tenant_id, date, impressions, clicks, spent_cents)
              VALUES (?, ?, ?, ?, 0, 1, ?)
              ON CONFLICT(creative_id, tenant_id, date) DO UPDATE SET clicks = clicks + 1, spent_cents = spent_cents + ?`,
        params: [dailyStatsId, creativeId, creative.tenant_id, today, cpcCostCents, cpcCostCents],
      },
    ]);
  } catch {
    // Never break on tracking errors
  }

  return c.redirect(creative.target_url, 302);
});

// Also support GET for impression tracking (from <img> pixel)
ads.get('/track/impression', async (c) => {
  const creativeId = c.req.query('c');
  const placementId = c.req.query('p');

  if (!creativeId || !placementId) {
    // Return 1x1 transparent GIF
    return new Response(new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,1,68,0,59]), {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const db = new D1Client(c.env.DB);
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '0.0.0.0';
    const ipHash = await hashIp(ip);
    const userAgent = c.req.header('user-agent') ?? '';
    const pageUrl = c.req.header('referer') ?? '';

    const creative = await db.queryOne<{ tenant_id: string; campaign_id: string }>(
      'SELECT tenant_id, campaign_id FROM ad_creatives WHERE id = ?',
      [creativeId],
    );

    if (creative) {
      const impressionId = generateUlid();
      const today = new Date().toISOString().slice(0, 10);
      const dailyStatsId = generateUlid();

      await db.batch([
        {
          sql: `INSERT INTO ad_impressions (id, creative_id, tenant_id, placement_id, ip_hash, user_agent, page_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [impressionId, creativeId, creative.tenant_id, placementId, ipHash, userAgent, pageUrl],
        },
        {
          sql: `UPDATE ad_creatives SET impressions = impressions + 1, updated_at = datetime('now') WHERE id = ?`,
          params: [creativeId],
        },
        {
          sql: `INSERT INTO ad_daily_stats (id, creative_id, tenant_id, date, impressions, clicks, spent_cents)
                VALUES (?, ?, ?, ?, 1, 0, 0)
                ON CONFLICT(creative_id, tenant_id, date) DO UPDATE SET impressions = impressions + 1`,
          params: [dailyStatsId, creativeId, creative.tenant_id, today],
        },
      ]);
    }
  } catch {
    // Never break on tracking errors
  }

  // Return 1x1 transparent GIF
  return new Response(new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,1,68,0,59]), {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Auth middleware for all routes below
ads.use('/campaigns/*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
ads.use('/campaigns', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
ads.use('/creatives/*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
ads.use('/placements/*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
ads.use('/placements', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
ads.use('/reports/*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
ads.use('/revenue/*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
ads.use('/revenue', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// Role guard: advertiser, tenant_admin, super_admin
function requireAdRole(c: { get: (key: string) => string | undefined }) {
  const role = c.get('userRole');
  if (role !== 'advertiser' && role !== 'tenant_admin' && role !== 'super_admin') {
    throw new ForbiddenError('Apenas anunciantes e administradores podem gerenciar anúncios');
  }
}

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────

// GET /campaigns — List campaigns
ads.get('/campaigns', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId')!;
  const role = c.get('userRole')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c);
  const status = c.req.query('status');

  let where = 'tenant_id = ?';
  const params: unknown[] = [tenantId];

  // Advertisers can only see their own campaigns
  if (role === 'advertiser') {
    where += ' AND advertiser_id = ?';
    params.push(userId);
  }

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM ad_campaigns WHERE ${where}`,
    params,
  );
  const total = countResult?.total ?? 0;

  const campaigns = await db.query<{
    id: string; name: string; status: string; budget_cents: number; spent_cents: number;
    start_date: string; end_date: string | null; advertiser_id: string;
    created_at: string; updated_at: string;
  }>(
    `SELECT id, name, status, budget_cents, spent_cents, start_date, end_date,
            advertiser_id, created_at, updated_at
     FROM ad_campaigns
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return c.json({
    data: campaigns.map((camp) => ({
      id: camp.id,
      name: camp.name,
      status: camp.status,
      budgetCents: camp.budget_cents,
      spentCents: camp.spent_cents,
      startDate: camp.start_date,
      endDate: camp.end_date,
      advertiserId: camp.advertiser_id,
      createdAt: camp.created_at,
      updatedAt: camp.updated_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /campaigns — Create campaign
ads.post('/campaigns', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId')!;
  const body = await c.req.json();
  const parsed = createCampaignSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);
  const campaignId = generateUlid();

  await db.execute(
    `INSERT INTO ad_campaigns (id, tenant_id, advertiser_id, name, status, budget_cents, start_date, end_date)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`,
    [campaignId, tenantId, userId, data.name, data.budgetCents, data.startDate, data.endDate ?? null],
  );

  return c.json({ id: campaignId }, 201);
});

// GET /campaigns/:id — Campaign detail
ads.get('/campaigns/:id', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId')!;
  const role = c.get('userRole')!;
  const campaignId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const campaign = await db.queryOne<{
    id: string; name: string; status: string; budget_cents: number; spent_cents: number;
    start_date: string; end_date: string | null; advertiser_id: string;
    created_at: string; updated_at: string;
  }>(
    'SELECT * FROM ad_campaigns WHERE id = ? AND tenant_id = ?',
    [campaignId, tenantId],
  );

  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  // Advertisers can only see their own
  if (role === 'advertiser' && campaign.advertiser_id !== userId) {
    throw new ForbiddenError('Acesso negado a esta campanha');
  }

  // Count creatives
  const creativeCount = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM ad_creatives WHERE campaign_id = ?',
    [campaignId],
  );

  return c.json({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    budgetCents: campaign.budget_cents,
    spentCents: campaign.spent_cents,
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    advertiserId: campaign.advertiser_id,
    creativeCount: creativeCount?.total ?? 0,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  });
});

// PUT /campaigns/:id — Update campaign
ads.put('/campaigns/:id', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId')!;
  const role = c.get('userRole')!;
  const campaignId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateCampaignSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const campaign = await db.queryOne<{ id: string; advertiser_id: string; status: string }>(
    'SELECT id, advertiser_id, status FROM ad_campaigns WHERE id = ? AND tenant_id = ?',
    [campaignId, tenantId],
  );

  if (!campaign) throw new NotFoundError('Campaign', campaignId);
  if (role === 'advertiser' && campaign.advertiser_id !== userId) {
    throw new ForbiddenError('Acesso negado a esta campanha');
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.budgetCents !== undefined) { updates.push('budget_cents = ?'); params.push(data.budgetCents); }
  if (data.startDate !== undefined) { updates.push('start_date = ?'); params.push(data.startDate); }
  if (data.endDate !== undefined) { updates.push('end_date = ?'); params.push(data.endDate); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(campaignId);
    await db.execute(
      `UPDATE ad_campaigns SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );
  }

  return c.json({ success: true });
});

// PATCH /campaigns/:id/status — Change campaign status
ads.patch('/campaigns/:id/status', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId')!;
  const role = c.get('userRole')!;
  const campaignId = c.req.param('id');
  const body = await c.req.json();
  const parsed = statusTransitionSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Status inválido', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const { status } = parsed.data;
  const db = new D1Client(c.env.DB);

  const campaign = await db.queryOne<{ id: string; advertiser_id: string; status: string }>(
    'SELECT id, advertiser_id, status FROM ad_campaigns WHERE id = ? AND tenant_id = ?',
    [campaignId, tenantId],
  );

  if (!campaign) throw new NotFoundError('Campaign', campaignId);
  if (role === 'advertiser' && campaign.advertiser_id !== userId) {
    throw new ForbiddenError('Acesso negado a esta campanha');
  }

  // Validate state transitions
  const validTransitions: Record<string, string[]> = {
    draft: ['active', 'cancelled'],
    active: ['paused', 'cancelled'],
    paused: ['active', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  const allowed = validTransitions[campaign.status] ?? [];
  if (!allowed.includes(status)) {
    throw new ValidationError(`Transição inválida: ${campaign.status} → ${status}`);
  }

  await db.execute(
    "UPDATE ad_campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, campaignId],
  );

  return c.json({ success: true, status });
});

// ─── CREATIVES ───────────────────────────────────────────────────────────────

// GET /campaigns/:id/creatives — List creatives for a campaign
ads.get('/campaigns/:id/creatives', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const campaignId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  // Verify campaign belongs to tenant
  const campaign = await db.queryOne<{ id: string }>(
    'SELECT id FROM ad_campaigns WHERE id = ? AND tenant_id = ?',
    [campaignId, tenantId],
  );
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  const creatives = await db.query<{
    id: string; name: string; status: string; creative_type: string;
    content_url: string; target_url: string; impressions: number; clicks: number;
    created_at: string; updated_at: string;
  }>(
    `SELECT id, name, status, creative_type, content_url, target_url,
            impressions, clicks, created_at, updated_at
     FROM ad_creatives
     WHERE campaign_id = ? AND tenant_id = ?
     ORDER BY created_at DESC`,
    [campaignId, tenantId],
  );

  return c.json({
    data: creatives.map((cr) => ({
      id: cr.id,
      name: cr.name,
      status: cr.status,
      creativeType: cr.creative_type,
      contentUrl: cr.content_url,
      targetUrl: cr.target_url,
      impressions: cr.impressions,
      clicks: cr.clicks,
      ctr: cr.impressions > 0 ? ((cr.clicks / cr.impressions) * 100).toFixed(2) : '0.00',
      createdAt: cr.created_at,
      updatedAt: cr.updated_at,
    })),
  });
});

// POST /campaigns/:id/creatives — Create creative
ads.post('/campaigns/:id/creatives', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId')!;
  const role = c.get('userRole')!;
  const campaignId = c.req.param('id');
  const body = await c.req.json();
  const parsed = createCreativeSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const campaign = await db.queryOne<{ id: string; advertiser_id: string }>(
    'SELECT id, advertiser_id FROM ad_campaigns WHERE id = ? AND tenant_id = ?',
    [campaignId, tenantId],
  );
  if (!campaign) throw new NotFoundError('Campaign', campaignId);
  if (role === 'advertiser' && campaign.advertiser_id !== userId) {
    throw new ForbiddenError('Acesso negado a esta campanha');
  }

  const creativeId = generateUlid();

  await db.execute(
    `INSERT INTO ad_creatives (id, campaign_id, tenant_id, name, status, creative_type, content_url, target_url)
     VALUES (?, ?, ?, ?, 'pending_review', ?, ?, ?)`,
    [creativeId, campaignId, tenantId, data.name, data.creativeType, data.contentUrl, data.targetUrl],
  );

  return c.json({ id: creativeId }, 201);
});

// PUT /creatives/:id — Update creative
ads.put('/creatives/:id', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const creativeId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateCreativeSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const creative = await db.queryOne<{ id: string }>(
    'SELECT id FROM ad_creatives WHERE id = ? AND tenant_id = ?',
    [creativeId, tenantId],
  );
  if (!creative) throw new NotFoundError('Creative', creativeId);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.contentUrl !== undefined) { updates.push('content_url = ?'); params.push(data.contentUrl); }
  if (data.targetUrl !== undefined) { updates.push('target_url = ?'); params.push(data.targetUrl); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(creativeId);
    await db.execute(
      `UPDATE ad_creatives SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );
  }

  return c.json({ success: true });
});

// PATCH /creatives/:id/status — Approve/reject/activate/pause creative
ads.patch('/creatives/:id/status', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const role = c.get('userRole')!;
  const creativeId = c.req.param('id');
  const body = await c.req.json();
  const parsed = creativeStatusSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Status inválido', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const { status } = parsed.data;
  const db = new D1Client(c.env.DB);

  const creative = await db.queryOne<{ id: string; status: string }>(
    'SELECT id, status FROM ad_creatives WHERE id = ? AND tenant_id = ?',
    [creativeId, tenantId],
  );
  if (!creative) throw new NotFoundError('Creative', creativeId);

  // Only admins can approve/reject
  if ((status === 'approved' || status === 'rejected') && role === 'advertiser') {
    throw new ForbiddenError('Apenas administradores podem aprovar/rejeitar criativos');
  }

  // Validate transitions
  const validTransitions: Record<string, string[]> = {
    pending_review: ['approved', 'rejected'],
    approved: ['active', 'rejected'],
    rejected: ['pending_review'],
    active: ['paused'],
    paused: ['active'],
  };

  const allowed = validTransitions[creative.status] ?? [];
  if (!allowed.includes(status)) {
    throw new ValidationError(`Transição inválida: ${creative.status} → ${status}`);
  }

  await db.execute(
    "UPDATE ad_creatives SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, creativeId],
  );

  return c.json({ success: true, status });
});

// POST /creatives/:id/upload — Upload creative media to R2
ads.post('/creatives/:id/upload', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const creativeId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const creative = await db.queryOne<{ id: string }>(
    'SELECT id FROM ad_creatives WHERE id = ? AND tenant_id = ?',
    [creativeId, tenantId],
  );
  if (!creative) throw new NotFoundError('Creative', creativeId);

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw new ValidationError('Content-Type deve ser multipart/form-data');
  }

  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
    throw new ValidationError('Campo "file" é obrigatório');
  }

  const uploadFile = file as unknown as { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

  // Validate MIME type and size
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const ALLOWED_VIDEO_TYPES = new Set(['video/mp4']);
  const isImage = ALLOWED_IMAGE_TYPES.has(uploadFile.type);
  const isVideo = ALLOWED_VIDEO_TYPES.has(uploadFile.type);

  if (!isImage && !isVideo) {
    throw new ValidationError(
      `Tipo de arquivo não permitido: ${uploadFile.type}. Aceitos: jpg, png, gif, webp, mp4`,
    );
  }

  const maxSize = isImage ? 2 * 1024 * 1024 : 10 * 1024 * 1024; // 2MB images, 10MB videos
  if (uploadFile.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    throw new ValidationError(`Arquivo muito grande (${(uploadFile.size / 1024 / 1024).toFixed(1)}MB). Máximo: ${maxMB}MB`);
  }

  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'video/mp4': 'mp4',
  };

  const ext = MIME_TO_EXT[uploadFile.type] ?? 'bin';
  const fileId = generateUlid();
  const r2Key = `tenants/${tenantId}/ads/${creativeId}/${fileId}.${ext}`;

  const arrayBuffer = await uploadFile.arrayBuffer();
  await c.env.STORAGE.put(r2Key, arrayBuffer, {
    httpMetadata: {
      contentType: uploadFile.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      tenantId,
      creativeId,
      originalName: uploadFile.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  const publicUrl = `${STORAGE_PUBLIC_URL}/${r2Key}`;

  // Update creative content_url
  await db.execute(
    "UPDATE ad_creatives SET content_url = ?, updated_at = datetime('now') WHERE id = ?",
    [publicUrl, creativeId],
  );

  return c.json({
    key: r2Key,
    url: publicUrl,
    size: uploadFile.size,
    contentType: uploadFile.type,
  }, 201);
});

// ─── PLACEMENTS ──────────────────────────────────────────────────────────────

// GET /placements — List placements for tenant
ads.get('/placements', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const placements = await db.query<{
    id: string; name: string; position: string; width: number; height: number;
    is_active: number; created_at: string;
  }>(
    'SELECT id, name, position, width, height, is_active, created_at FROM ad_placements WHERE tenant_id = ? ORDER BY created_at ASC',
    [tenantId],
  );

  return c.json({
    data: placements.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      width: p.width,
      height: p.height,
      isActive: p.is_active === 1,
      createdAt: p.created_at,
    })),
  });
});

// POST /placements — Create placement
ads.post('/placements', async (c) => {
  const role = c.get('userRole');
  if (role !== 'tenant_admin' && role !== 'super_admin') {
    throw new ForbiddenError('Apenas administradores podem gerenciar placements');
  }

  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createPlacementSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);
  const placementId = generateUlid();

  await db.execute(
    `INSERT INTO ad_placements (id, tenant_id, name, position, width, height)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [placementId, tenantId, data.name, data.position, data.width, data.height],
  );

  return c.json({ id: placementId }, 201);
});

// PUT /placements/:id — Update placement
ads.put('/placements/:id', async (c) => {
  const role = c.get('userRole');
  if (role !== 'tenant_admin' && role !== 'super_admin') {
    throw new ForbiddenError('Apenas administradores podem gerenciar placements');
  }

  const tenantId = c.get('tenantId')!;
  const placementId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updatePlacementSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM ad_placements WHERE id = ? AND tenant_id = ?',
    [placementId, tenantId],
  );
  if (!existing) throw new NotFoundError('Placement', placementId);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.position !== undefined) { updates.push('position = ?'); params.push(data.position); }
  if (data.width !== undefined) { updates.push('width = ?'); params.push(data.width); }
  if (data.height !== undefined) { updates.push('height = ?'); params.push(data.height); }
  if (data.isActive !== undefined) { updates.push('is_active = ?'); params.push(data.isActive ? 1 : 0); }

  if (updates.length > 0) {
    params.push(placementId);
    await db.execute(
      `UPDATE ad_placements SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );
  }

  return c.json({ success: true });
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────

// GET /reports/campaign/:id — Daily stats for a campaign
ads.get('/reports/campaign/:id', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const campaignId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  // Verify campaign
  const campaign = await db.queryOne<{ id: string }>(
    'SELECT id FROM ad_campaigns WHERE id = ? AND tenant_id = ?',
    [campaignId, tenantId],
  );
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  const days = parseInt(c.req.query('days') ?? '30', 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().slice(0, 10);

  const stats = await db.query<{
    date: string; impressions: number; clicks: number; spent_cents: number;
  }>(
    `SELECT ds.date, SUM(ds.impressions) as impressions, SUM(ds.clicks) as clicks, SUM(ds.spent_cents) as spent_cents
     FROM ad_daily_stats ds
     JOIN ad_creatives ac ON ac.id = ds.creative_id
     WHERE ac.campaign_id = ? AND ds.tenant_id = ? AND ds.date >= ?
     GROUP BY ds.date
     ORDER BY ds.date ASC`,
    [campaignId, tenantId, fromDateStr],
  );

  return c.json({
    data: stats.map((s) => ({
      date: s.date,
      impressions: s.impressions,
      clicks: s.clicks,
      spentCents: s.spent_cents,
      ctr: s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0.00',
    })),
  });
});

// GET /reports/summary — Overall summary for tenant
ads.get('/reports/summary', async (c) => {
  requireAdRole(c);
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const summary = await db.queryOne<{
    total_impressions: number; total_clicks: number; total_spent: number;
  }>(
    `SELECT COALESCE(SUM(impressions), 0) as total_impressions,
            COALESCE(SUM(clicks), 0) as total_clicks,
            COALESCE(SUM(spent_cents), 0) as total_spent
     FROM ad_daily_stats WHERE tenant_id = ?`,
    [tenantId],
  );

  const activeCampaigns = await db.queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM ad_campaigns WHERE tenant_id = ? AND status = 'active'",
    [tenantId],
  );

  const totalImpressions = summary?.total_impressions ?? 0;
  const totalClicks = summary?.total_clicks ?? 0;

  return c.json({
    totalImpressions,
    totalClicks,
    totalSpentCents: summary?.total_spent ?? 0,
    ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00',
    activeCampaigns: activeCampaigns?.total ?? 0,
  });
});

// ─── REVENUE SHARE ───────────────────────────────────────────────────────────

// GET /revenue — Revenue share report for tenant
ads.get('/revenue', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const records = await db.query<{
    id: string; month: string; total_revenue_cents: number;
    tenant_share_cents: number; platform_share_cents: number; created_at: string;
  }>(
    'SELECT id, month, total_revenue_cents, tenant_share_cents, platform_share_cents, created_at FROM ad_revenue_share WHERE tenant_id = ? ORDER BY month DESC LIMIT 24',
    [tenantId],
  );

  return c.json({
    data: records.map((r) => ({
      id: r.id,
      month: r.month,
      totalRevenueCents: r.total_revenue_cents,
      tenantShareCents: r.tenant_share_cents,
      platformShareCents: r.platform_share_cents,
      createdAt: r.created_at,
    })),
  });
});

// POST /revenue/calculate — Calculate revenue share for a month (super_admin only)
ads.post('/revenue/calculate', async (c) => {
  const role = c.get('userRole');
  if (role !== 'super_admin') {
    throw new ForbiddenError('Apenas super administradores podem calcular revenue share');
  }

  const body = await c.req.json();
  const month = (body as { month?: string }).month;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ValidationError('Formato de mês inválido. Use YYYY-MM');
  }

  const db = new D1Client(c.env.DB);

  // Get all tenants with ad revenue this month
  const tenantRevenues = await db.query<{ tenant_id: string; total_spent: number }>(
    `SELECT tenant_id, SUM(spent_cents) as total_spent
     FROM ad_daily_stats
     WHERE date >= ? AND date < ?
     GROUP BY tenant_id
     HAVING total_spent > 0`,
    [`${month}-01`, `${month}-32`], // D1 handles date comparison correctly
  );

  const results: Array<{ tenantId: string; totalRevenueCents: number; tenantShareCents: number; platformShareCents: number }> = [];

  for (const tr of tenantRevenues) {
    // Get tenant-specific revenue share config (default 70% tenant, 30% platform)
    const configRow = await db.queryOne<{ config_value: string }>(
      "SELECT config_value FROM tenant_configs WHERE tenant_id = ? AND config_key = 'ad_revenue_share_percent'",
      [tr.tenant_id],
    );

    const tenantSharePercent = configRow ? parseInt(configRow.config_value, 10) : 70;
    const totalRevenue = tr.total_spent;
    const tenantShare = Math.round(totalRevenue * tenantSharePercent / 100);
    const platformShare = totalRevenue - tenantShare;

    const revenueId = generateUlid();

    await db.execute(
      `INSERT INTO ad_revenue_share (id, tenant_id, month, total_revenue_cents, tenant_share_cents, platform_share_cents)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, month) DO UPDATE SET
         total_revenue_cents = excluded.total_revenue_cents,
         tenant_share_cents = excluded.tenant_share_cents,
         platform_share_cents = excluded.platform_share_cents`,
      [revenueId, tr.tenant_id, month, totalRevenue, tenantShare, platformShare],
    );

    results.push({
      tenantId: tr.tenant_id,
      totalRevenueCents: totalRevenue,
      tenantShareCents: tenantShare,
      platformShareCents: platformShare,
    });
  }

  return c.json({ month, processed: results.length, results });
});

export { ads };
