// Analytics routes — Sprint 9
// Pageview tracking (public) + dashboard aggregation (auth required)

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';

const analytics = new Hono<AppContext>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const trackSchema = z.object({
  path: z.string().min(1).max(2048),
  referrer: z.string().max(2048).optional().default(''),
  user_agent: z.string().max(512).optional().default(''),
  tenant_id: z.string().min(1),
  country: z.string().max(10).optional().default(''),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectDeviceType(ua: string): string {
  const lower = ua.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(lower)) return 'mobile';
  if (/tablet|ipad|kindle|silk|playbook/i.test(lower)) return 'tablet';
  return 'desktop';
}

// ─── POST /track — Public (no auth) ─────────────────────────────────────────

analytics.post('/track', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = trackSchema.safeParse(body);

    if (!parsed.success) {
      return c.body(null, 204);
    }

    const { path, referrer, user_agent, tenant_id, country } = parsed.data;
    const deviceType = detectDeviceType(user_agent);
    const id = generateUlid();
    const now = new Date().toISOString();

    const db = new D1Client(c.env.DB);
    await db.execute(
      `INSERT INTO page_views (id, tenant_id, path, referrer, user_agent, country, device_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenant_id, path, referrer, user_agent.slice(0, 512), country, deviceType, now],
    );

    return c.body(null, 204);
  } catch (err) {
    // Tracking should never break the user experience — silently fail
    console.error('[analytics/track] Error:', err);
    return c.body(null, 204);
  }
});

// ─── Auth middleware — applied to all routes BELOW ───────────────────────────

analytics.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// ─── GET /dashboard — Aggregated metrics (last 30 days) ─────────────────────

analytics.get('/dashboard', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Total pageviews
  const totalResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM page_views WHERE tenant_id = ? AND created_at >= ?`,
    [tenantId, thirtyDaysAgo],
  );

  // Pageviews per day (last 30 days)
  const dailyPageviews = await db.query<{ date: string; count: number }>(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM page_views
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY date DESC
     LIMIT 30`,
    [tenantId, thirtyDaysAgo],
  );

  // Top pages
  const topPages = await db.query<{ path: string; count: number }>(
    `SELECT path, COUNT(*) as count
     FROM page_views
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY path
     ORDER BY count DESC
     LIMIT 10`,
    [tenantId, thirtyDaysAgo],
  );

  // Top referrers
  const topReferrers = await db.query<{ referrer: string; count: number }>(
    `SELECT referrer, COUNT(*) as count
     FROM page_views
     WHERE tenant_id = ? AND created_at >= ? AND referrer != '' AND referrer IS NOT NULL
     GROUP BY referrer
     ORDER BY count DESC
     LIMIT 10`,
    [tenantId, thirtyDaysAgo],
  );

  // Device breakdown
  const devices = await db.query<{ device_type: string; count: number }>(
    `SELECT device_type, COUNT(*) as count
     FROM page_views
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY device_type
     ORDER BY count DESC`,
    [tenantId, thirtyDaysAgo],
  );

  // Country breakdown
  const countries = await db.query<{ country: string; count: number }>(
    `SELECT country, COUNT(*) as count
     FROM page_views
     WHERE tenant_id = ? AND created_at >= ? AND country != '' AND country IS NOT NULL
     GROUP BY country
     ORDER BY count DESC
     LIMIT 15`,
    [tenantId, thirtyDaysAgo],
  );

  // Today's pageviews
  const todayStart = new Date().toISOString().split('T')[0];
  const todayResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM page_views WHERE tenant_id = ? AND created_at >= ?`,
    [tenantId, `${todayStart}T00:00:00.000Z`],
  );

  return c.json({
    period: '30d',
    totalPageviews: totalResult?.total ?? 0,
    todayPageviews: todayResult?.total ?? 0,
    dailyPageviews: dailyPageviews ?? [],
    topPages: topPages ?? [],
    topReferrers: topReferrers ?? [],
    devices: devices ?? [],
    countries: countries ?? [],
  });
});

// ─── GET /daily — Daily stats (last 30 days) ────────────────────────────────

analytics.get('/daily', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const days = parseInt(c.req.query('days') ?? '30', 10);
  const limit = Math.min(Math.max(days, 1), 90);
  const since = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString();

  const daily = await db.query<{
    date: string;
    count: number;
    unique_paths: number;
  }>(
    `SELECT
       DATE(created_at) as date,
       COUNT(*) as count,
       COUNT(DISTINCT path) as unique_paths
     FROM page_views
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY date DESC
     LIMIT ?`,
    [tenantId, since, limit],
  );

  return c.json({
    days: limit,
    stats: daily ?? [],
  });
});

export { analytics };
