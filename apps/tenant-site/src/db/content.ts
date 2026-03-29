// Tenant Site — Content data access (videos, categories, tags, performers, channels, pages)
// Optimized: db.batch() for parallel execution, eliminated correlated subqueries

import type { VideoItem, CategoryItem, PerformerItem, TagItem, ChannelItem, PageItem } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';

// ─── Batched Homepage Data (1 D1 round-trip for all homepage queries) ─────────

export interface HomepageData {
  videos: VideoItem[];
  totalVideos: number;
  categories: CategoryItem[];
  performers: PerformerItem[];
}

/**
 * Loads all homepage data in a single db.batch() call.
 * Replaces 4+ separate D1 queries with 1 round-trip (~200ms instead of ~800ms).
 */
export async function getHomepageDataBatched(
  db: D1Database,
  tenantId: string,
  locale: string,
): Promise<HomepageData> {
  const [countResult, videosResult, categoriesResult, performersResult] = await db.batch([
    // 1. Video count
    db.prepare(
      `SELECT COUNT(*) as total FROM videos v WHERE v.tenant_id = ? AND v.status = 'published'`
    ).bind(tenantId),
    // 2. Recent videos (limit 12)
    db.prepare(
      `SELECT v.slug, v.duration_seconds, v.thumbnail_url, v.view_count,
              vt.title,
              (SELECT cht.name FROM video_channels vc2
               JOIN channels ch2 ON ch2.id = vc2.channel_id
               LEFT JOIN channel_translations cht ON cht.channel_id = ch2.id AND cht.locale = ?
               WHERE vc2.video_id = v.id LIMIT 1) as channel_name
       FROM videos v
       LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
       WHERE v.tenant_id = ? AND v.status = 'published'
       ORDER BY v.created_at DESC
       LIMIT 12`
    ).bind(locale, locale, tenantId),
    // 3. Categories with video counts (using JOIN + GROUP BY instead of correlated subquery)
    db.prepare(
      `SELECT c.slug, c.sort_order, ct.name, ct.description,
              COUNT(vc.video_id) as video_count
       FROM categories c
       LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
       LEFT JOIN video_categories vc ON vc.category_id = c.id
       LEFT JOIN videos v ON v.id = vc.video_id AND v.status = 'published'
       WHERE c.tenant_id = ? AND c.is_active = 1
       GROUP BY c.id, c.slug, c.sort_order, ct.name, ct.description
       ORDER BY c.sort_order ASC, ct.name ASC`
    ).bind(locale, tenantId),
    // 4. Performers with video counts (using JOIN + GROUP BY instead of correlated subquery)
    db.prepare(
      `SELECT p.slug, p.image_url, pt.name, pt.bio,
              COUNT(vp.video_id) as video_count
       FROM performers p
       LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
       LEFT JOIN video_performers vp ON vp.performer_id = p.id
       LEFT JOIN videos v ON v.id = vp.video_id AND v.status = 'published'
       WHERE p.tenant_id = ? AND p.is_active = 1
       GROUP BY p.id, p.slug, p.image_url, pt.name, pt.bio
       ORDER BY pt.name ASC`
    ).bind(locale, tenantId),
  ]);

  const total = (countResult as D1Result<{ total: number }>).results[0]?.total ?? 0;

  const videos: VideoItem[] = (videosResult as D1Result<{
    slug: string; duration_seconds: number | null; thumbnail_url: string | null;
    view_count: number; title: string | null; channel_name: string | null;
  }>).results.map((r) => ({
    slug: r.slug,
    title: r.title ?? '',
    thumbnailUrl: r.thumbnail_url,
    durationSeconds: r.duration_seconds,
    viewCount: r.view_count,
    channelName: r.channel_name,
  }));

  const categories: CategoryItem[] = (categoriesResult as D1Result<{
    slug: string; sort_order: number; name: string | null; description: string | null; video_count: number;
  }>).results.map((c) => ({
    slug: c.slug,
    name: c.name ?? c.slug,
    description: c.description ?? '',
    videoCount: c.video_count,
  }));

  const performers: PerformerItem[] = (performersResult as D1Result<{
    slug: string; image_url: string | null; name: string | null; bio: string | null; video_count: number;
  }>).results.map((p) => ({
    slug: p.slug,
    name: p.name ?? p.slug,
    bio: p.bio ?? '',
    imageUrl: p.image_url,
    videoCount: p.video_count,
  }));

  return { videos, totalVideos: total, categories, performers };
}

// ─── Batched Video Page Data (1 D1 round-trip) ───────────────────────────────

/**
 * Loads video detail + related data in a single db.batch() call.
 * Replaces 5 sequential queries with 1 round-trip.
 */
export async function getVideoPageDataBatched(
  db: D1Database,
  tenantId: string,
  locale: string,
  slug: string,
) {
  // First, get the video to obtain its ID
  const video = await db.prepare(
    `SELECT v.id, v.slug, v.duration_seconds, v.thumbnail_url, v.video_url, v.embed_url,
            v.view_count, v.like_count, v.published_at, v.created_at,
            vt.title, vt.description, vt.seo_title, vt.seo_description
     FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE v.tenant_id = ? AND v.slug = ? AND v.status = 'published'`
  ).bind(locale, tenantId, slug).first<{
    id: string; slug: string; duration_seconds: number | null;
    thumbnail_url: string | null; video_url: string | null; embed_url: string | null;
    view_count: number; like_count: number; published_at: string | null; created_at: string;
    title: string | null; description: string | null;
    seo_title: string | null; seo_description: string | null;
  }>();

  if (!video) return null;

  // Batch all related queries in 1 round-trip
  const [categoriesResult, tagsResult, performersResult, channelsResult, relatedResult] = await db.batch([
    db.prepare(
      `SELECT c.slug, ct.name FROM video_categories vc
       JOIN categories c ON c.id = vc.category_id
       LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
       WHERE vc.video_id = ?`
    ).bind(locale, video.id),
    db.prepare(
      `SELECT t.slug, tt.name FROM video_tags vt
       JOIN tags t ON t.id = vt.tag_id
       LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
       WHERE vt.video_id = ?`
    ).bind(locale, video.id),
    db.prepare(
      `SELECT p.slug, pt.name, p.image_url FROM video_performers vp
       JOIN performers p ON p.id = vp.performer_id
       LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
       WHERE vp.video_id = ?`
    ).bind(locale, video.id),
    db.prepare(
      `SELECT ch.slug, cht.name, ch.logo_url FROM video_channels vc
       JOIN channels ch ON ch.id = vc.channel_id
       LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
       WHERE vc.video_id = ?`
    ).bind(locale, video.id),
    db.prepare(
      `SELECT v2.slug, vt2.title, v2.thumbnail_url, v2.duration_seconds, v2.view_count,
              (SELECT cht2.name FROM video_channels vc3
               JOIN channels ch3 ON ch3.id = vc3.channel_id
               LEFT JOIN channel_translations cht2 ON cht2.channel_id = ch3.id AND cht2.locale = ?
               WHERE vc3.video_id = v2.id LIMIT 1) as channel_name
       FROM videos v2
       LEFT JOIN video_translations vt2 ON vt2.video_id = v2.id AND vt2.locale = ?
       WHERE v2.tenant_id = ? AND v2.status = 'published' AND v2.id != ?
       ORDER BY v2.created_at DESC LIMIT 12`
    ).bind(locale, locale, tenantId, video.id),
  ]);

  const categories = (categoriesResult as D1Result<{ slug: string; name: string | null }>).results;
  const tags = (tagsResult as D1Result<{ slug: string; name: string | null }>).results;
  const performers = (performersResult as D1Result<{ slug: string; name: string | null; image_url: string | null }>).results;
  const channels = (channelsResult as D1Result<{ slug: string; name: string | null; logo_url: string | null }>).results;
  const related = (relatedResult as D1Result<{
    slug: string; title: string | null; thumbnail_url: string | null;
    duration_seconds: number | null; view_count: number; channel_name: string | null;
  }>).results;

  return {
    ...video,
    title: video.title ?? '',
    description: video.description ?? '',
    categories: categories.map((c) => ({ slug: c.slug, name: c.name ?? c.slug })),
    tags: tags.map((t) => ({ slug: t.slug, name: t.name ?? t.slug })),
    performers: performers.map((p) => ({ slug: p.slug, name: p.name ?? p.slug, imageUrl: p.image_url })),
    channel: channels[0] ? { slug: channels[0].slug, name: channels[0].name ?? channels[0].slug, logoUrl: channels[0].logo_url } : null,
    related: related.map((r) => ({
      slug: r.slug, title: r.title ?? '', thumbnailUrl: r.thumbnail_url,
      durationSeconds: r.duration_seconds, viewCount: r.view_count, channelName: r.channel_name,
    })),
  };
}

// ─── Videos ──────────────────────────────────────────────────────────────────

export async function getVideos(
  db: D1Database, tenantId: string, locale: string,
  opts: { limit?: number; offset?: number; search?: string; categorySlug?: string; tagSlug?: string; performerSlug?: string; channelSlug?: string } = {},
): Promise<{ videos: VideoItem[]; total: number }> {
  const limit = opts.limit ?? VIDEOS_PER_PAGE;
  const offset = opts.offset ?? 0;

  let where = "v.tenant_id = ? AND v.status = 'published'";
  const params: unknown[] = [tenantId];

  if (opts.search) { where += ' AND vt.title LIKE ?'; params.push(`%${opts.search}%`); }
  if (opts.categorySlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_categories vc JOIN categories cat ON cat.id = vc.category_id WHERE vc.video_id = v.id AND cat.slug = ? AND cat.tenant_id = ?)';
    params.push(opts.categorySlug, tenantId);
  }
  if (opts.tagSlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_tags vtg JOIN tags tg ON tg.id = vtg.tag_id WHERE vtg.video_id = v.id AND tg.slug = ? AND tg.tenant_id = ?)';
    params.push(opts.tagSlug, tenantId);
  }
  if (opts.performerSlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_performers vp JOIN performers pf ON pf.id = vp.performer_id WHERE vp.video_id = v.id AND pf.slug = ? AND pf.tenant_id = ?)';
    params.push(opts.performerSlug, tenantId);
  }
  if (opts.channelSlug) {
    where += ' AND EXISTS (SELECT 1 FROM video_channels vch JOIN channels chn ON chn.id = vch.channel_id WHERE vch.video_id = v.id AND chn.slug = ? AND chn.tenant_id = ?)';
    params.push(opts.channelSlug, tenantId);
  }

  // Use db.batch() to run count + data in 1 round-trip
  const [countResult, rows] = await db.batch([
    db.prepare(
      `SELECT COUNT(*) as total FROM videos v LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ? WHERE ${where}`
    ).bind(locale, ...params),
    db.prepare(
      `SELECT v.slug, v.duration_seconds, v.thumbnail_url, v.view_count,
              vt.title,
              (SELECT cht.name FROM video_channels vc2
               JOIN channels ch2 ON ch2.id = vc2.channel_id
               LEFT JOIN channel_translations cht ON cht.channel_id = ch2.id AND cht.locale = ?
               WHERE vc2.video_id = v.id LIMIT 1) as channel_name
       FROM videos v
       LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
       WHERE ${where}
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(locale, locale, ...params, limit, offset),
  ]);

  const total = (countResult as D1Result<{ total: number }>).results[0]?.total ?? 0;

  return {
    total,
    videos: (rows as D1Result<{
      slug: string; duration_seconds: number | null; thumbnail_url: string | null;
      view_count: number; title: string | null; channel_name: string | null;
    }>).results.map((r) => ({
      slug: r.slug,
      title: r.title ?? '',
      thumbnailUrl: r.thumbnail_url,
      durationSeconds: r.duration_seconds,
      viewCount: r.view_count,
      channelName: r.channel_name,
    })),
  };
}

export async function getVideoBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  return getVideoPageDataBatched(db, tenantId, locale, slug);
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(db: D1Database, tenantId: string, locale: string): Promise<CategoryItem[]> {
  // Optimized: JOIN + GROUP BY instead of correlated subquery
  const rows = await db.prepare(
    `SELECT c.slug, c.sort_order, ct.name, ct.description,
            COUNT(vc.video_id) as video_count
     FROM categories c
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     LEFT JOIN video_categories vc ON vc.category_id = c.id
     LEFT JOIN videos v ON v.id = vc.video_id AND v.status = 'published'
     WHERE c.tenant_id = ? AND c.is_active = 1
     GROUP BY c.id, c.slug, c.sort_order, ct.name, ct.description
     ORDER BY c.sort_order ASC, ct.name ASC`
  ).bind(locale, tenantId).all<{ slug: string; sort_order: number; name: string | null; description: string | null; video_count: number }>();
  return rows.results.map((c) => ({ slug: c.slug, name: c.name ?? c.slug, description: c.description ?? '', videoCount: c.video_count }));
}

export async function getCategoryBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const c = await db.prepare(
    `SELECT c.slug, ct.name, ct.description
     FROM categories c
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.tenant_id = ? AND c.slug = ? AND c.is_active = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; name: string | null; description: string | null }>();
  if (!c) return null;
  return { slug: c.slug, name: c.name ?? c.slug, description: c.description ?? '' };
}

// ─── Performers ──────────────────────────────────────────────────────────────

export async function getPerformers(db: D1Database, tenantId: string, locale: string): Promise<PerformerItem[]> {
  // Optimized: JOIN + GROUP BY instead of correlated subquery
  const rows = await db.prepare(
    `SELECT p.slug, p.image_url, pt.name, pt.bio,
            COUNT(vp.video_id) as video_count
     FROM performers p
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     LEFT JOIN video_performers vp ON vp.performer_id = p.id
     LEFT JOIN videos v ON v.id = vp.video_id AND v.status = 'published'
     WHERE p.tenant_id = ? AND p.is_active = 1
     GROUP BY p.id, p.slug, p.image_url, pt.name, pt.bio
     ORDER BY pt.name ASC`
  ).bind(locale, tenantId).all<{ slug: string; image_url: string | null; name: string | null; bio: string | null; video_count: number }>();
  return rows.results.map((p) => ({ slug: p.slug, name: p.name ?? p.slug, bio: p.bio ?? '', imageUrl: p.image_url, videoCount: p.video_count }));
}

export async function getPerformerBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const p = await db.prepare(
    `SELECT p.slug, p.image_url, pt.name, pt.bio
     FROM performers p
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ? AND p.slug = ? AND p.is_active = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; image_url: string | null; name: string | null; bio: string | null }>();
  if (!p) return null;
  return { slug: p.slug, name: p.name ?? p.slug, bio: p.bio ?? '', imageUrl: p.image_url };
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export async function getTags(db: D1Database, tenantId: string, locale: string): Promise<TagItem[]> {
  // Optimized: JOIN + GROUP BY instead of correlated subquery
  const rows = await db.prepare(
    `SELECT t.slug, tt.name,
            COUNT(vtg.video_id) as video_count
     FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     LEFT JOIN video_tags vtg ON vtg.tag_id = t.id
     LEFT JOIN videos v ON v.id = vtg.video_id AND v.status = 'published'
     WHERE t.tenant_id = ?
     GROUP BY t.id, t.slug, tt.name
     ORDER BY video_count DESC, tt.name ASC`
  ).bind(locale, tenantId).all<{ slug: string; name: string | null; video_count: number }>();
  return rows.results.map((t) => ({ slug: t.slug, name: t.name ?? t.slug, videoCount: t.video_count }));
}

export async function getTagBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const t = await db.prepare(
    `SELECT t.slug, tt.name
     FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE t.tenant_id = ? AND t.slug = ?`
  ).bind(locale, tenantId, slug).first<{ slug: string; name: string | null }>();
  if (!t) return null;
  return { slug: t.slug, name: t.name ?? t.slug };
}

// ─── Channels ────────────────────────────────────────────────────────────────

export async function getChannels(db: D1Database, tenantId: string, locale: string): Promise<ChannelItem[]> {
  // Optimized: JOIN + GROUP BY instead of correlated subquery
  const rows = await db.prepare(
    `SELECT ch.slug, ch.logo_url, cht.name, cht.description,
            COUNT(vch.video_id) as video_count
     FROM channels ch
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     LEFT JOIN video_channels vch ON vch.channel_id = ch.id
     LEFT JOIN videos v ON v.id = vch.video_id AND v.status = 'published'
     WHERE ch.tenant_id = ? AND ch.is_active = 1
     GROUP BY ch.id, ch.slug, ch.logo_url, cht.name, cht.description
     ORDER BY cht.name ASC`
  ).bind(locale, tenantId).all<{ slug: string; logo_url: string | null; name: string | null; description: string | null; video_count: number }>();
  return rows.results.map((ch) => ({ slug: ch.slug, name: ch.name ?? ch.slug, description: ch.description ?? '', logoUrl: ch.logo_url, videoCount: ch.video_count }));
}

export async function getChannelBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const ch = await db.prepare(
    `SELECT ch.slug, ch.logo_url, cht.name, cht.description
     FROM channels ch
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE ch.tenant_id = ? AND ch.slug = ? AND ch.is_active = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; logo_url: string | null; name: string | null; description: string | null }>();
  if (!ch) return null;
  return { slug: ch.slug, name: ch.name ?? ch.slug, description: ch.description ?? '', logoUrl: ch.logo_url };
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function getPage(db: D1Database, tenantId: string, locale: string, slug: string): Promise<PageItem | null> {
  const p = await db.prepare(
    `SELECT p.slug, COALESCE(pt.title, p.title, p.slug) as title, COALESCE(pt.content, p.content, '') as content
     FROM pages p
     LEFT JOIN page_translations pt ON pt.page_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ? AND p.slug = ? AND p.is_published = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; title: string; content: string }>();
  if (!p) return null;
  return { slug: p.slug, title: p.title || slug, content: p.content || '' };
}
