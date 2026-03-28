// Tenant Site — Content data access (videos, categories, tags, performers, channels, pages)

import type { VideoItem, CategoryItem, PerformerItem, TagItem, ChannelItem, PageItem } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';

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

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM videos v LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ? WHERE ${where}`
  ).bind(locale, ...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const rows = await db.prepare(
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
  ).bind(locale, locale, ...params, limit, offset).all<{
    slug: string; duration_seconds: number | null; thumbnail_url: string | null;
    view_count: number; title: string | null; channel_name: string | null;
  }>();

  return {
    total,
    videos: rows.results.map((r) => ({
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

  const categories = await db.prepare(
    `SELECT c.slug, ct.name FROM video_categories vc
     JOIN categories c ON c.id = vc.category_id
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE vc.video_id = ?`
  ).bind(locale, video.id).all<{ slug: string; name: string | null }>();

  const tags = await db.prepare(
    `SELECT t.slug, tt.name FROM video_tags vt
     JOIN tags t ON t.id = vt.tag_id
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE vt.video_id = ?`
  ).bind(locale, video.id).all<{ slug: string; name: string | null }>();

  const performers = await db.prepare(
    `SELECT p.slug, pt.name, p.image_url FROM video_performers vp
     JOIN performers p ON p.id = vp.performer_id
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE vp.video_id = ?`
  ).bind(locale, video.id).all<{ slug: string; name: string | null; image_url: string | null }>();

  const channels = await db.prepare(
    `SELECT ch.slug, cht.name, ch.logo_url FROM video_channels vc
     JOIN channels ch ON ch.id = vc.channel_id
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE vc.video_id = ?`
  ).bind(locale, video.id).all<{ slug: string; name: string | null; logo_url: string | null }>();

  // Related videos
  const related = await db.prepare(
    `SELECT v2.slug, vt2.title, v2.thumbnail_url, v2.duration_seconds, v2.view_count,
            (SELECT cht2.name FROM video_channels vc3
             JOIN channels ch3 ON ch3.id = vc3.channel_id
             LEFT JOIN channel_translations cht2 ON cht2.channel_id = ch3.id AND cht2.locale = ?
             WHERE vc3.video_id = v2.id LIMIT 1) as channel_name
     FROM videos v2
     LEFT JOIN video_translations vt2 ON vt2.video_id = v2.id AND vt2.locale = ?
     WHERE v2.tenant_id = ? AND v2.status = 'published' AND v2.id != ?
     ORDER BY v2.created_at DESC LIMIT 12`
  ).bind(locale, locale, tenantId, video.id).all<{
    slug: string; title: string | null; thumbnail_url: string | null;
    duration_seconds: number | null; view_count: number; channel_name: string | null;
  }>();

  return {
    ...video,
    title: video.title ?? '',
    description: video.description ?? '',
    categories: categories.results.map((c) => ({ slug: c.slug, name: c.name ?? c.slug })),
    tags: tags.results.map((t) => ({ slug: t.slug, name: t.name ?? t.slug })),
    performers: performers.results.map((p) => ({ slug: p.slug, name: p.name ?? p.slug, imageUrl: p.image_url })),
    channel: channels.results[0] ? { slug: channels.results[0].slug, name: channels.results[0].name ?? channels.results[0].slug, logoUrl: channels.results[0].logo_url } : null,
    related: related.results.map((r) => ({
      slug: r.slug, title: r.title ?? '', thumbnailUrl: r.thumbnail_url,
      durationSeconds: r.duration_seconds, viewCount: r.view_count, channelName: r.channel_name,
    })),
  };
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(db: D1Database, tenantId: string, locale: string): Promise<CategoryItem[]> {
  const rows = await db.prepare(
    `SELECT c.slug, c.sort_order, ct.name, ct.description,
            (SELECT COUNT(*) FROM video_categories vc JOIN videos v ON v.id = vc.video_id AND v.status = 'published' WHERE vc.category_id = c.id) as video_count
     FROM categories c
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.tenant_id = ? AND c.is_active = 1
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
  const rows = await db.prepare(
    `SELECT p.slug, p.image_url, pt.name, pt.bio,
            (SELECT COUNT(*) FROM video_performers vp JOIN videos v ON v.id = vp.video_id AND v.status = 'published' WHERE vp.performer_id = p.id) as video_count
     FROM performers p
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ? AND p.is_active = 1
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
  const rows = await db.prepare(
    `SELECT t.slug, tt.name,
            (SELECT COUNT(*) FROM video_tags vt JOIN videos v ON v.id = vt.video_id AND v.status = 'published' WHERE vt.tag_id = t.id) as video_count
     FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE t.tenant_id = ?
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
  const rows = await db.prepare(
    `SELECT ch.slug, ch.logo_url, cht.name, cht.description,
            (SELECT COUNT(*) FROM video_channels vch JOIN videos v ON v.id = vch.video_id AND v.status = 'published' WHERE vch.channel_id = ch.id) as video_count
     FROM channels ch
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE ch.tenant_id = ? AND ch.is_active = 1
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
