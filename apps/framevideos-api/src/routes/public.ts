// Rotas públicas — Sprint 5
// Endpoints sem auth para o tenant-site consumir
// GET /api/v1/public/:tenantId/...

import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { NotFoundError } from '@frame-videos/shared/errors';

const publicRoutes = new Hono<AppContext>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginationParams(c: { req: { query: (k: string) => string | undefined } }, defaultLimit = 24) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? String(defaultLimit), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function getTenantLocale(db: D1Client, tenantId: string): Promise<string> {
  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ? AND status IN (\'active\', \'trial\')',
    [tenantId],
  );
  if (!tenant) throw new NotFoundError('Tenant', tenantId);
  return tenant.default_locale ?? 'pt_BR';
}

// ─── GET /public/:tenantId/videos ────────────────────────────────────────────

publicRoutes.get('/:tenantId/videos', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = new D1Client(c.env.DB);
  const locale = await getTenantLocale(db, tenantId);
  const { page, limit, offset } = paginationParams(c);

  const search = c.req.query('search');
  const categorySlug = c.req.query('category');
  const tagSlug = c.req.query('tag');
  const performerSlug = c.req.query('performer');
  const channelSlug = c.req.query('channel');

  let where = "v.tenant_id = ? AND v.status = 'published'";
  const params: unknown[] = [tenantId];

  if (search) {
    where += ' AND vt.title LIKE ?';
    params.push(`%${search}%`);
  }

  if (categorySlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_categories vc JOIN categories cat ON cat.id = vc.category_id WHERE vc.video_id = v.id AND cat.slug = ? AND cat.tenant_id = ?)';
    params.push(categorySlug, tenantId);
  }

  if (tagSlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_tags vtg JOIN tags tg ON tg.id = vtg.tag_id WHERE vtg.video_id = v.id AND tg.slug = ? AND tg.tenant_id = ?)';
    params.push(tagSlug, tenantId);
  }

  if (performerSlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_performers vp JOIN performers pf ON pf.id = vp.performer_id WHERE vp.video_id = v.id AND pf.slug = ? AND pf.tenant_id = ?)';
    params.push(performerSlug, tenantId);
  }

  if (channelSlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_channels vch JOIN channels chn ON chn.id = vch.channel_id WHERE vch.video_id = v.id AND chn.slug = ? AND chn.tenant_id = ?)';
    params.push(channelSlug, tenantId);
  }

  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE ${where}`,
    [locale, ...params],
  );
  const total = countResult?.total ?? 0;

  const videos = await db.query<{
    id: string; slug: string; duration_seconds: number | null;
    thumbnail_url: string | null; view_count: number; is_featured: number;
    published_at: string | null; created_at: string;
    title: string | null; description: string | null;
    channel_name: string | null;
  }>(
    `SELECT v.id, v.slug, v.duration_seconds, v.thumbnail_url, v.view_count,
            v.is_featured, v.published_at, v.created_at,
            vt.title, vt.description,
            (SELECT cht.name FROM video_channels vc2
             JOIN channels ch2 ON ch2.id = vc2.channel_id
             LEFT JOIN channel_translations cht ON cht.channel_id = ch2.id AND cht.locale = ?
             WHERE vc2.video_id = v.id LIMIT 1) as channel_name
     FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE ${where}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [locale, locale, ...params, limit, offset],
  );

  return c.json({
    data: videos.map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title ?? '',
      description: v.description ?? '',
      durationSeconds: v.duration_seconds,
      thumbnailUrl: v.thumbnail_url,
      viewCount: v.view_count,
      isFeatured: v.is_featured === 1,
      publishedAt: v.published_at,
      channelName: v.channel_name,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─── GET /public/:tenantId/video/:slug ───────────────────────────────────────

publicRoutes.get('/:tenantId/video/:slug', async (c) => {
  const tenantId = c.req.param('tenantId');
  const slug = c.req.param('slug');
  const db = new D1Client(c.env.DB);
  const locale = await getTenantLocale(db, tenantId);

  const video = await db.queryOne<{
    id: string; slug: string; duration_seconds: number | null;
    thumbnail_url: string | null; video_url: string | null; embed_url: string | null;
    view_count: number; like_count: number; is_featured: number;
    published_at: string | null; created_at: string;
    title: string | null; description: string | null;
    seo_title: string | null; seo_description: string | null;
  }>(
    `SELECT v.id, v.slug, v.duration_seconds, v.thumbnail_url, v.video_url,
            v.embed_url, v.view_count, v.like_count, v.is_featured,
            v.published_at, v.created_at,
            vt.title, vt.description, vt.seo_title, vt.seo_description
     FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE v.tenant_id = ? AND v.slug = ? AND v.status = 'published'`,
    [locale, tenantId, slug],
  );

  if (!video) throw new NotFoundError('Video', slug);

  // Increment view count (fire-and-forget)
  c.executionCtx.waitUntil(
    db.execute('UPDATE videos SET view_count = view_count + 1 WHERE id = ?', [video.id]),
  );

  // Fetch associations
  const categories = await db.query<{ slug: string; name: string | null }>(
    `SELECT c.slug, ct.name FROM video_categories vc
     JOIN categories c ON c.id = vc.category_id
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE vc.video_id = ?`,
    [locale, video.id],
  );

  const tags = await db.query<{ slug: string; name: string | null }>(
    `SELECT t.slug, tt.name FROM video_tags vt
     JOIN tags t ON t.id = vt.tag_id
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE vt.video_id = ?`,
    [locale, video.id],
  );

  const performers = await db.query<{ slug: string; name: string | null; image_url: string | null }>(
    `SELECT p.slug, pt.name, p.image_url FROM video_performers vp
     JOIN performers p ON p.id = vp.performer_id
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE vp.video_id = ?`,
    [locale, video.id],
  );

  const channels = await db.query<{ slug: string; name: string | null; logo_url: string | null }>(
    `SELECT ch.slug, cht.name, ch.logo_url FROM video_channels vc
     JOIN channels ch ON ch.id = vc.channel_id
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE vc.video_id = ?`,
    [locale, video.id],
  );

  // Related videos (same categories)
  const categoryIds = categories.map((c) => c.slug);
  let related: Array<{
    slug: string; title: string | null; thumbnail_url: string | null;
    duration_seconds: number | null; view_count: number; channel_name: string | null;
  }> = [];

  if (categoryIds.length > 0) {
    related = await db.query(
      `SELECT DISTINCT v2.slug, vt2.title, v2.thumbnail_url, v2.duration_seconds, v2.view_count,
              (SELECT cht2.name FROM video_channels vc3
               JOIN channels ch3 ON ch3.id = vc3.channel_id
               LEFT JOIN channel_translations cht2 ON cht2.channel_id = ch3.id AND cht2.locale = ?
               WHERE vc3.video_id = v2.id LIMIT 1) as channel_name
       FROM videos v2
       JOIN video_categories vc2 ON vc2.video_id = v2.id
       JOIN categories c2 ON c2.id = vc2.category_id
       LEFT JOIN video_translations vt2 ON vt2.video_id = v2.id AND vt2.locale = ?
       WHERE v2.tenant_id = ? AND v2.status = 'published' AND v2.id != ?
         AND c2.slug IN (${categoryIds.map(() => '?').join(',')})
       ORDER BY v2.view_count DESC
       LIMIT 12`,
      [locale, locale, tenantId, video.id, ...categoryIds],
    );
  }

  if (related.length < 12) {
    const moreRelated = await db.query<{
      slug: string; title: string | null; thumbnail_url: string | null;
      duration_seconds: number | null; view_count: number; channel_name: string | null;
    }>(
      `SELECT v2.slug, vt2.title, v2.thumbnail_url, v2.duration_seconds, v2.view_count,
              (SELECT cht2.name FROM video_channels vc3
               JOIN channels ch3 ON ch3.id = vc3.channel_id
               LEFT JOIN channel_translations cht2 ON cht2.channel_id = ch3.id AND cht2.locale = ?
               WHERE vc3.video_id = v2.id LIMIT 1) as channel_name
       FROM videos v2
       LEFT JOIN video_translations vt2 ON vt2.video_id = v2.id AND vt2.locale = ?
       WHERE v2.tenant_id = ? AND v2.status = 'published' AND v2.id != ?
       ORDER BY v2.created_at DESC
       LIMIT ?`,
      [locale, locale, tenantId, video.id, 12 - related.length],
    );
    const existingSlugs = new Set(related.map((r) => r.slug));
    for (const r of moreRelated) {
      if (!existingSlugs.has(r.slug)) related.push(r);
    }
  }

  return c.json({
    id: video.id,
    slug: video.slug,
    title: video.title ?? '',
    description: video.description ?? '',
    seoTitle: video.seo_title,
    seoDescription: video.seo_description,
    durationSeconds: video.duration_seconds,
    thumbnailUrl: video.thumbnail_url,
    videoUrl: video.video_url,
    embedUrl: video.embed_url,
    viewCount: video.view_count,
    likeCount: video.like_count,
    publishedAt: video.published_at,
    categories: categories.map((c) => ({ slug: c.slug, name: c.name ?? c.slug })),
    tags: tags.map((t) => ({ slug: t.slug, name: t.name ?? t.slug })),
    performers: performers.map((p) => ({ slug: p.slug, name: p.name ?? p.slug, imageUrl: p.image_url })),
    channel: channels[0] ? { slug: channels[0].slug, name: channels[0].name ?? channels[0].slug, logoUrl: channels[0].logo_url } : null,
    related: related.map((r) => ({
      slug: r.slug,
      title: r.title ?? '',
      thumbnailUrl: r.thumbnail_url,
      durationSeconds: r.duration_seconds,
      viewCount: r.view_count,
      channelName: r.channel_name,
    })),
  });
});

// ─── GET /public/:tenantId/categories ────────────────────────────────────────

publicRoutes.get('/:tenantId/categories', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = new D1Client(c.env.DB);
  const locale = await getTenantLocale(db, tenantId);

  const categories = await db.query<{
    id: string; slug: string; sort_order: number;
    name: string | null; description: string | null;
    video_count: number;
  }>(
    `SELECT c.id, c.slug, c.sort_order, ct.name, ct.description,
            (SELECT COUNT(*) FROM video_categories vc
             JOIN videos v ON v.id = vc.video_id AND v.status = 'published'
             WHERE vc.category_id = c.id) as video_count
     FROM categories c
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.tenant_id = ? AND c.is_active = 1
     ORDER BY c.sort_order ASC, ct.name ASC`,
    [locale, tenantId],
  );

  return c.json({
    data: categories.map((cat) => ({
      slug: cat.slug,
      name: cat.name ?? cat.slug,
      description: cat.description ?? '',
      videoCount: cat.video_count,
    })),
  });
});

// ─── GET /public/:tenantId/performers ────────────────────────────────────────

publicRoutes.get('/:tenantId/performers', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = new D1Client(c.env.DB);
  const locale = await getTenantLocale(db, tenantId);

  const performers = await db.query<{
    slug: string; image_url: string | null;
    name: string | null; bio: string | null;
    video_count: number;
  }>(
    `SELECT p.slug, p.image_url, pt.name, pt.bio,
            (SELECT COUNT(*) FROM video_performers vp
             JOIN videos v ON v.id = vp.video_id AND v.status = 'published'
             WHERE vp.performer_id = p.id) as video_count
     FROM performers p
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ? AND p.is_active = 1
     ORDER BY pt.name ASC`,
    [locale, tenantId],
  );

  return c.json({
    data: performers.map((p) => ({
      slug: p.slug,
      name: p.name ?? p.slug,
      bio: p.bio ?? '',
      imageUrl: p.image_url,
      videoCount: p.video_count,
    })),
  });
});

// ─── GET /public/:tenantId/channels ──────────────────────────────────────────

publicRoutes.get('/:tenantId/channels', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = new D1Client(c.env.DB);
  const locale = await getTenantLocale(db, tenantId);

  const channels = await db.query<{
    slug: string; logo_url: string | null;
    name: string | null; description: string | null;
    video_count: number;
  }>(
    `SELECT ch.slug, ch.logo_url, cht.name, cht.description,
            (SELECT COUNT(*) FROM video_channels vch
             JOIN videos v ON v.id = vch.video_id AND v.status = 'published'
             WHERE vch.channel_id = ch.id) as video_count
     FROM channels ch
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE ch.tenant_id = ? AND ch.is_active = 1
     ORDER BY cht.name ASC`,
    [locale, tenantId],
  );

  return c.json({
    data: channels.map((ch) => ({
      slug: ch.slug,
      name: ch.name ?? ch.slug,
      description: ch.description ?? '',
      logoUrl: ch.logo_url,
      videoCount: ch.video_count,
    })),
  });
});

// ─── GET /public/:tenantId/tags ──────────────────────────────────────────────

publicRoutes.get('/:tenantId/tags', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = new D1Client(c.env.DB);
  const locale = await getTenantLocale(db, tenantId);

  const tags = await db.query<{
    slug: string; name: string | null; video_count: number;
  }>(
    `SELECT t.slug, tt.name,
            (SELECT COUNT(*) FROM video_tags vt
             JOIN videos v ON v.id = vt.video_id AND v.status = 'published'
             WHERE vt.tag_id = t.id) as video_count
     FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE t.tenant_id = ?
     ORDER BY video_count DESC, tt.name ASC`,
    [locale, tenantId],
  );

  return c.json({
    data: tags.map((t) => ({
      slug: t.slug,
      name: t.name ?? t.slug,
      videoCount: t.video_count,
    })),
  });
});

// ─── GET /public/:tenantId/pages/:slug ───────────────────────────────────────

publicRoutes.get('/:tenantId/pages/:slug', async (c) => {
  const tenantId = c.req.param('tenantId');
  const slug = c.req.param('slug');
  const db = new D1Client(c.env.DB);
  const locale = await getTenantLocale(db, tenantId);

  const page = await db.queryOne<{
    slug: string; title: string | null; content: string | null;
    seo_title: string | null; seo_description: string | null;
  }>(
    `SELECT p.slug, pt.title, pt.content, pt.seo_title, pt.seo_description
     FROM pages p
     LEFT JOIN page_translations pt ON pt.page_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ? AND p.slug = ? AND p.is_published = 1`,
    [locale, tenantId, slug],
  );

  if (!page) throw new NotFoundError('Page', slug);

  return c.json({
    slug: page.slug,
    title: page.title ?? '',
    content: page.content ?? '',
    seoTitle: page.seo_title,
    seoDescription: page.seo_description,
  });
});

// ─── GET /public/:tenantId/settings ──────────────────────────────────────────

publicRoutes.get('/:tenantId/settings', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = new D1Client(c.env.DB);

  // Verify tenant exists and is active
  const tenant = await db.queryOne<{ name: string; slug: string }>(
    "SELECT name, slug FROM tenants WHERE id = ? AND status IN ('active', 'trial')",
    [tenantId],
  );
  if (!tenant) throw new NotFoundError('Tenant', tenantId);

  const configs = await db.query<{ config_key: string; config_value: string }>(
    'SELECT config_key, config_value FROM tenant_configs WHERE tenant_id = ?',
    [tenantId],
  );

  const settings: Record<string, string> = {};
  for (const cfg of configs) {
    settings[cfg.config_key] = cfg.config_value;
  }

  return c.json({
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    siteName: settings['site_name'] || tenant.name,
    siteLogoUrl: settings['site_logo_url'] ?? '',
    siteFaviconUrl: settings['site_favicon_url'] ?? '',
    colorPrimary: settings['color_primary'] ?? '#8b5cf6',
    colorSecondary: settings['color_secondary'] ?? '#6366f1',
    googleAnalyticsId: settings['google_analytics_id'] ?? '',
    customCss: settings['custom_css'] ?? '',
    customHeadScripts: settings['custom_head_scripts'] ?? '',
    customBodyScripts: settings['custom_body_scripts'] ?? '',
  });
});

// ─── GET /public/:tenantId/stats ─────────────────────────────────────────────

publicRoutes.get('/:tenantId/stats', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = new D1Client(c.env.DB);

  const videoCount = await db.queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM videos WHERE tenant_id = ? AND status = 'published'",
    [tenantId],
  );

  const categoryCount = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM categories WHERE tenant_id = ? AND is_active = 1',
    [tenantId],
  );

  const totalViews = await db.queryOne<{ total: number }>(
    "SELECT COALESCE(SUM(view_count), 0) as total FROM videos WHERE tenant_id = ? AND status = 'published'",
    [tenantId],
  );

  return c.json({
    totalVideos: videoCount?.total ?? 0,
    totalCategories: categoryCount?.total ?? 0,
    totalViews: totalViews?.total ?? 0,
  });
});

export { publicRoutes };
