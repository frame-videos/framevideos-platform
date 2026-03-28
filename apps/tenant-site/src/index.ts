// Tenant Site Worker — Sprint 5
// SSR completo: resolve domínios → renderiza site do tenant com dados reais do D1
//
// Páginas: /, /videos, /video/:slug, /categories, /category/:slug,
//          /performers, /performer/:slug, /tags, /tag/:slug,
//          /channels, /channel/:slug, /pages/:slug

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
}

interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  domain: string;
  isPrimary: boolean;
}

interface SiteSettings {
  siteName: string;
  siteLogoUrl: string;
  siteFaviconUrl: string;
  colorPrimary: string;
  colorSecondary: string;
  googleAnalyticsId: string;
  customCss: string;
  customHeadScripts: string;
  customBodyScripts: string;
}

interface VideoItem {
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  channelName: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 300;
const VIDEOS_PER_PAGE = 24;
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'sites', 'mail', 'smtp', 'imap',
  'pop', 'ftp', 'cdn', 'static', 'assets', 'staging', 'dev', 'test',
]);

// ─── Domain Resolution ──────────────────────────────────────────────────────

async function resolveTenant(
  hostname: string,
  db: D1Database,
  cache: KVNamespace,
): Promise<TenantInfo | null> {
  const cacheKey = `tenant:${hostname}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    if (cached === '__404__') return null;
    try { return JSON.parse(cached) as TenantInfo; } catch { /* ignore */ }
  }

  let tenant: TenantInfo | null = null;

  if (hostname.endsWith('.framevideos.com')) {
    const slug = hostname.replace('.framevideos.com', '');
    if (RESERVED_SUBDOMAINS.has(slug) || slug === 'framevideos') {
      await cache.put(cacheKey, '__404__', { expirationTtl: CACHE_TTL_SECONDS });
      return null;
    }

    const result = await db
      .prepare(`SELECT t.id, t.name, t.slug FROM tenants t WHERE t.slug = ? AND t.status IN ('active', 'trial') LIMIT 1`)
      .bind(slug)
      .first<{ id: string; name: string; slug: string }>();

    if (result) {
      tenant = { tenantId: result.id, tenantName: result.name, tenantSlug: result.slug, domain: hostname, isPrimary: false };
    }
  } else {
    const result = await db
      .prepare(`SELECT d.tenant_id, d.domain, d.is_primary, t.name, t.slug FROM domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.domain = ? AND d.status = 'active' AND t.status IN ('active', 'trial') LIMIT 1`)
      .bind(hostname)
      .first<{ tenant_id: string; domain: string; is_primary: number; name: string; slug: string }>();

    if (result) {
      tenant = { tenantId: result.tenant_id, tenantName: result.name, tenantSlug: result.slug, domain: result.domain, isPrimary: result.is_primary === 1 };
    }
  }

  if (tenant) {
    await cache.put(cacheKey, JSON.stringify(tenant), { expirationTtl: CACHE_TTL_SECONDS });
  } else {
    await cache.put(cacheKey, '__404__', { expirationTtl: 60 });
  }

  return tenant;
}

// ─── Data Access Layer ───────────────────────────────────────────────────────

async function getSiteSettings(db: D1Database, tenantId: string, tenantName: string): Promise<SiteSettings> {
  const configs = await db.prepare('SELECT config_key, config_value FROM tenant_configs WHERE tenant_id = ?')
    .bind(tenantId).all<{ config_key: string; config_value: string }>();

  const s: Record<string, string> = {};
  for (const c of configs.results) s[c.config_key] = c.config_value;

  return {
    siteName: s['site_name'] || tenantName,
    siteLogoUrl: s['site_logo_url'] ?? '',
    siteFaviconUrl: s['site_favicon_url'] ?? '',
    colorPrimary: s['color_primary'] ?? '#8b5cf6',
    colorSecondary: s['color_secondary'] ?? '#6366f1',
    googleAnalyticsId: s['google_analytics_id'] ?? '',
    customCss: s['custom_css'] ?? '',
    customHeadScripts: s['custom_head_scripts'] ?? '',
    customBodyScripts: s['custom_body_scripts'] ?? '',
  };
}

async function getTenantLocale(db: D1Database, tenantId: string): Promise<string> {
  const t = await db.prepare('SELECT default_locale FROM tenants WHERE id = ?').bind(tenantId).first<{ default_locale: string }>();
  return t?.default_locale ?? 'pt_BR';
}

async function getVideos(
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

async function getVideoBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
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

async function getCategories(db: D1Database, tenantId: string, locale: string) {
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

async function getPerformers(db: D1Database, tenantId: string, locale: string) {
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

async function getPerformerBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const p = await db.prepare(
    `SELECT p.slug, p.image_url, pt.name, pt.bio
     FROM performers p
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ? AND p.slug = ? AND p.is_active = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; image_url: string | null; name: string | null; bio: string | null }>();
  if (!p) return null;
  return { slug: p.slug, name: p.name ?? p.slug, bio: p.bio ?? '', imageUrl: p.image_url };
}

async function getTags(db: D1Database, tenantId: string, locale: string) {
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

async function getChannels(db: D1Database, tenantId: string, locale: string) {
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

async function getChannelBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const ch = await db.prepare(
    `SELECT ch.slug, ch.logo_url, cht.name, cht.description
     FROM channels ch
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE ch.tenant_id = ? AND ch.slug = ? AND ch.is_active = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; logo_url: string | null; name: string | null; description: string | null }>();
  if (!ch) return null;
  return { slug: ch.slug, name: ch.name ?? ch.slug, description: ch.description ?? '', logoUrl: ch.logo_url };
}

async function getCategoryBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const c = await db.prepare(
    `SELECT c.slug, ct.name, ct.description
     FROM categories c
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.tenant_id = ? AND c.slug = ? AND c.is_active = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; name: string | null; description: string | null }>();
  if (!c) return null;
  return { slug: c.slug, name: c.name ?? c.slug, description: c.description ?? '' };
}

async function getTagBySlug(db: D1Database, tenantId: string, locale: string, slug: string) {
  const t = await db.prepare(
    `SELECT t.slug, tt.name
     FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE t.tenant_id = ? AND t.slug = ?`
  ).bind(locale, tenantId, slug).first<{ slug: string; name: string | null }>();
  if (!t) return null;
  return { slug: t.slug, name: t.name ?? t.slug };
}

async function getPage(db: D1Database, tenantId: string, locale: string, slug: string) {
  const p = await db.prepare(
    `SELECT p.slug, pt.title, pt.content
     FROM pages p
     LEFT JOIN page_translations pt ON pt.page_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ? AND p.slug = ? AND p.is_published = 1`
  ).bind(locale, tenantId, slug).first<{ slug: string; title: string | null; content: string | null }>();
  if (!p) return null;
  return { slug: p.slug, title: p.title ?? slug, content: p.content ?? '' };
}

// ─── HTML Helpers ────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function videoCard(v: VideoItem): string {
  const dur = formatDuration(v.durationSeconds);
  const views = formatViews(v.viewCount);
  return `<a href="/video/${esc(v.slug)}" class="group block bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/50 transition-all">
  <div class="relative aspect-video bg-gray-800">
    ${v.thumbnailUrl
      ? `<img src="${esc(v.thumbnailUrl)}" alt="${esc(v.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />`
      : `<div class="w-full h-full flex items-center justify-center text-gray-600"><svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>`
    }
    ${dur ? `<span class="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">${dur}</span>` : ''}
  </div>
  <div class="p-3">
    <h3 class="text-sm font-medium text-gray-100 line-clamp-2 group-hover:text-purple-400 transition-colors">${esc(v.title || 'Sem título')}</h3>
    <p class="text-xs text-gray-500 mt-1">${v.channelName ? esc(v.channelName) + ' • ' : ''}${views} visualizações</p>
  </div>
</a>`;
}

function videoGrid(videos: VideoItem[]): string {
  if (videos.length === 0) {
    return `<div class="text-center py-16 text-gray-500">
      <svg class="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
      <p class="text-lg">Nenhum vídeo encontrado</p>
    </div>`;
  }
  return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">${videos.map(videoCard).join('')}</div>`;
}

function pagination(page: number, totalPages: number, baseUrl: string): string {
  if (totalPages <= 1) return '';
  const pages: string[] = [];
  const maxVisible = 7;

  let start = Math.max(1, page - 3);
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (page > 1) {
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page - 1}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">←</a>`);
  }

  if (start > 1) {
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=1" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">1</a>`);
    if (start > 2) pages.push(`<span class="px-2 py-2 text-gray-600">…</span>`);
  }

  for (let i = start; i <= end; i++) {
    if (i === page) {
      pages.push(`<span class="px-3 py-2 rounded bg-purple-600 text-white font-medium">${i}</span>`);
    } else {
      pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${i}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">${i}</a>`);
    }
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push(`<span class="px-2 py-2 text-gray-600">…</span>`);
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${totalPages}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">${totalPages}</a>`);
  }

  if (page < totalPages) {
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page + 1}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">→</a>`);
  }

  return `<nav class="flex items-center justify-center gap-1 mt-8">${pages.join('')}</nav>`;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

function layout(
  settings: SiteSettings,
  opts: {
    title: string;
    description?: string;
    canonical?: string;
    ogImage?: string;
    jsonLd?: string;
    content: string;
    activePath?: string;
  },
): string {
  const pageTitle = opts.title === settings.siteName ? settings.siteName : `${opts.title} — ${settings.siteName}`;
  const desc = opts.description ?? `${settings.siteName} — O melhor conteúdo em vídeo`;
  const active = opts.activePath ?? '/';

  const navLink = (href: string, label: string) => {
    const isActive = active === href || (href !== '/' && active.startsWith(href));
    return `<a href="${href}" class="px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-purple-400 bg-gray-800' : 'text-gray-300 hover:text-white hover:bg-gray-800'}">${label}</a>`;
  };

  return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow">
  ${opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : ''}
  ${settings.siteFaviconUrl ? `<link rel="icon" href="${esc(settings.siteFaviconUrl)}">` : ''}
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  ${opts.ogImage ? `<meta property="og:image" content="${esc(opts.ogImage)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: '${esc(settings.colorPrimary)}',
            secondary: '${esc(settings.colorSecondary)}',
          }
        }
      }
    }
  </script>
  <style>
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    body { background: #0a0a0f; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #1a1a2e; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #555; }
  </style>
  ${settings.customCss ? `<style>${settings.customCss}</style>` : ''}
  ${settings.customHeadScripts || ''}
  ${settings.googleAnalyticsId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(settings.googleAnalyticsId)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(settings.googleAnalyticsId)}');</script>` : ''}
  ${opts.jsonLd ? `<script type="application/ld+json">${opts.jsonLd}</script>` : ''}
</head>
<body class="bg-[#0a0a0f] text-gray-100 min-h-screen flex flex-col">
  <header class="sticky top-0 z-50 bg-[#0d0d14]/95 backdrop-blur-md border-b border-gray-800/50">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-6">
          <a href="/" class="flex items-center gap-2 shrink-0">
            ${settings.siteLogoUrl
              ? `<img src="${esc(settings.siteLogoUrl)}" alt="${esc(settings.siteName)}" class="h-8 w-auto" />`
              : `<span class="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">${esc(settings.siteName)}</span>`
            }
          </a>
          <nav class="hidden md:flex items-center gap-1">
            ${navLink('/', 'Início')}
            ${navLink('/categories', 'Categorias')}
            ${navLink('/performers', 'Modelos')}
            ${navLink('/channels', 'Canais')}
            ${navLink('/tags', 'Tags')}
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <form action="/search" method="GET" class="hidden sm:block">
            <div class="relative">
              <input type="text" name="q" placeholder="Buscar vídeos..." class="w-48 lg:w-64 pl-9 pr-3 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </form>
          <button id="mobile-menu-btn" class="md:hidden p-2 text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
      </div>
      <div id="mobile-menu" class="md:hidden hidden pb-4">
        <form action="/search" method="GET" class="mb-3 sm:hidden">
          <input type="text" name="q" placeholder="Buscar vídeos..." class="w-full pl-3 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
        </form>
        <nav class="flex flex-col gap-1">
          ${navLink('/', 'Início')}
          ${navLink('/categories', 'Categorias')}
          ${navLink('/performers', 'Modelos')}
          ${navLink('/channels', 'Canais')}
          ${navLink('/tags', 'Tags')}
        </nav>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
    ${opts.content}
  </main>

  <footer class="border-t border-gray-800/50 bg-[#0d0d14]/80 mt-auto">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <a href="/pages/about" class="hover:text-gray-300 transition-colors">Sobre</a>
          <a href="/pages/contact" class="hover:text-gray-300 transition-colors">Contato</a>
          <a href="/pages/terms" class="hover:text-gray-300 transition-colors">Termos</a>
          <a href="/pages/privacy" class="hover:text-gray-300 transition-colors">Privacidade</a>
          <a href="/pages/dmca" class="hover:text-gray-300 transition-colors">DMCA</a>
        </div>
        <p class="text-sm text-gray-600">© ${new Date().getFullYear()} ${esc(settings.siteName)}. Powered by <a href="https://framevideos.com" target="_blank" rel="noopener" class="text-purple-500 hover:text-purple-400">Frame Videos</a></p>
      </div>
    </div>
  </footer>

  <script>
    document.getElementById('mobile-menu-btn')?.addEventListener('click', function() {
      document.getElementById('mobile-menu')?.classList.toggle('hidden');
    });
  </script>
  ${settings.customBodyScripts || ''}
</body>
</html>`;
}

// ─── Page Renderers ──────────────────────────────────────────────────────────

async function renderHomepage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string): Promise<string> {
  const { videos: recentVideos } = await getVideos(db, tenant.tenantId, locale, { limit: 12 });
  const categories = await getCategories(db, tenant.tenantId, locale);
  const performers = await getPerformers(db, tenant.tenantId, locale);
  const featuredPerformers = performers.slice(0, 8);
  const topCategories = categories.filter((c) => c.videoCount > 0).slice(0, 12);

  let content = '';

  // Hero section
  content += `<section class="mb-8">
    <h1 class="text-2xl md:text-3xl font-bold mb-2">${esc(settings.siteName)}</h1>
    <p class="text-gray-400">Os melhores vídeos, atualizados diariamente</p>
  </section>`;

  // Recent videos
  content += `<section class="mb-10">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Vídeos Recentes</h2>
      <a href="/videos" class="text-sm text-purple-400 hover:text-purple-300">Ver todos →</a>
    </div>
    ${videoGrid(recentVideos)}
  </section>`;

  // Categories
  if (topCategories.length > 0) {
    content += `<section class="mb-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Categorias Populares</h2>
        <a href="/categories" class="text-sm text-purple-400 hover:text-purple-300">Ver todas →</a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        ${topCategories.map((c) => `<a href="/category/${esc(c.slug)}" class="bg-gray-900 rounded-lg p-4 text-center hover:bg-gray-800 hover:ring-1 hover:ring-purple-500/30 transition-all">
          <p class="font-medium text-gray-200 text-sm">${esc(c.name)}</p>
          <p class="text-xs text-gray-500 mt-1">${c.videoCount} vídeos</p>
        </a>`).join('')}
      </div>
    </section>`;
  }

  // Featured performers
  if (featuredPerformers.length > 0) {
    content += `<section class="mb-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Modelos em Destaque</h2>
        <a href="/performers" class="text-sm text-purple-400 hover:text-purple-300">Ver todos →</a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        ${featuredPerformers.map((p) => `<a href="/performer/${esc(p.slug)}" class="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/30 transition-all group">
          <div class="aspect-square bg-gray-800 flex items-center justify-center">
            ${p.imageUrl
              ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />`
              : `<svg class="w-16 h-16 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
            }
          </div>
          <div class="p-3">
            <p class="font-medium text-gray-200 text-sm truncate">${esc(p.name)}</p>
            <p class="text-xs text-gray-500">${p.videoCount} vídeos</p>
          </div>
        </a>`).join('')}
      </div>
    </section>`;
  }

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.siteName,
    url: `https://${tenant.domain}`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `https://${tenant.domain}/videos?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });

  return layout(settings, {
    title: settings.siteName,
    description: `${settings.siteName} — Os melhores vídeos, atualizados diariamente`,
    canonical: `https://${tenant.domain}/`,
    content,
    activePath: '/',
    jsonLd,
  });
}

async function renderVideosPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, url: URL): Promise<string> {
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const search = url.searchParams.get('search') ?? undefined;
  const offset = (page - 1) * VIDEOS_PER_PAGE;

  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, search });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <h1 class="text-2xl font-bold">${search ? `Resultados para "${esc(search)}"` : 'Todos os Vídeos'}</h1>
    <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}</p>
  </div>`;

  content += videoGrid(videos);
  content += pagination(page, totalPages, search ? `/videos?search=${encodeURIComponent(search)}` : '/videos');

  return layout(settings, {
    title: search ? `Busca: ${search}` : 'Vídeos',
    description: search ? `Resultados da busca por "${search}"` : `Todos os vídeos de ${settings.siteName}`,
    canonical: `https://${tenant.domain}/videos`,
    content,
    activePath: '/videos',
  });
}

async function renderVideoPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string): Promise<string | null> {
  const video = await getVideoBySlug(db, tenant.tenantId, locale, slug);
  if (!video) return null;

  // Increment view (fire-and-forget via raw db)
  db.prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').bind(video.id).run();

  const dur = formatDuration(video.duration_seconds);
  const views = formatViews(video.view_count);

  // Player — improved with responsive container and better embed handling
  let playerHtml = '';
  if (video.embed_url) {
    playerHtml = `<div class="relative aspect-video bg-black rounded-xl overflow-hidden mb-4 shadow-2xl shadow-black/50 ring-1 ring-gray-800">
      <iframe src="${esc(video.embed_url)}" class="absolute inset-0 w-full h-full" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture" frameborder="0" loading="lazy"></iframe>
    </div>`;
  } else if (video.video_url) {
    playerHtml = `<div class="relative aspect-video bg-black rounded-xl overflow-hidden mb-4 shadow-2xl shadow-black/50 ring-1 ring-gray-800">
      <video src="${esc(video.video_url)}" class="absolute inset-0 w-full h-full" controls playsinline preload="metadata" ${video.thumbnail_url ? `poster="${esc(video.thumbnail_url)}"` : ''}></video>
    </div>`;
  } else if (video.thumbnail_url) {
    playerHtml = `<div class="relative aspect-video bg-black rounded-xl overflow-hidden mb-4 shadow-2xl shadow-black/50 ring-1 ring-gray-800 flex items-center justify-center">
      <img src="${esc(video.thumbnail_url)}" alt="${esc(video.title)}" class="max-w-full max-h-full object-contain" />
      <div class="absolute inset-0 flex items-center justify-center bg-black/30">
        <div class="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
          <svg class="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </div>`;
  }

  let content = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2">
      ${playerHtml}
      <h1 class="text-xl md:text-2xl font-bold mb-2">${esc(video.title)}</h1>
      <div class="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-4">
        ${video.channel ? `<a href="/channel/${esc(video.channel.slug)}" class="hover:text-purple-400">${esc(video.channel.name)}</a><span>•</span>` : ''}
        <span>${views} visualizações</span>
        ${dur ? `<span>•</span><span>${dur}</span>` : ''}
        ${video.published_at ? `<span>•</span><span>${new Date(video.published_at).toLocaleDateString('pt-BR')}</span>` : ''}
      </div>

      ${video.description ? `<div class="bg-gray-900 rounded-lg p-4 mb-4">
        <p class="text-gray-300 text-sm whitespace-pre-line">${esc(video.description)}</p>
      </div>` : ''}

      ${video.performers.length > 0 ? `<div class="mb-4">
        <h3 class="text-sm font-medium text-gray-400 mb-2">Modelos</h3>
        <div class="flex flex-wrap gap-2">
          ${video.performers.map((p) => `<a href="/performer/${esc(p.slug)}" class="flex items-center gap-2 bg-gray-900 rounded-full px-3 py-1.5 text-sm hover:bg-gray-800 transition-colors">
            ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" class="w-6 h-6 rounded-full object-cover" />` : ''}
            <span>${esc(p.name)}</span>
          </a>`).join('')}
        </div>
      </div>` : ''}

      ${video.categories.length > 0 ? `<div class="mb-4">
        <h3 class="text-sm font-medium text-gray-400 mb-2">Categorias</h3>
        <div class="flex flex-wrap gap-2">
          ${video.categories.map((c) => `<a href="/category/${esc(c.slug)}" class="bg-purple-900/30 text-purple-300 text-xs px-3 py-1 rounded-full hover:bg-purple-900/50 transition-colors">${esc(c.name)}</a>`).join('')}
        </div>
      </div>` : ''}

      ${video.tags.length > 0 ? `<div class="mb-4">
        <h3 class="text-sm font-medium text-gray-400 mb-2">Tags</h3>
        <div class="flex flex-wrap gap-2">
          ${video.tags.map((t) => `<a href="/tag/${esc(t.slug)}" class="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded hover:bg-gray-700 hover:text-gray-200 transition-colors">#${esc(t.name)}</a>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <div>
      <h2 class="text-lg font-semibold mb-4">Vídeos Relacionados</h2>
      <div class="flex flex-col gap-3">
        ${video.related.map((r) => `<a href="/video/${esc(r.slug)}" class="flex gap-3 group">
          <div class="relative w-40 shrink-0 aspect-video bg-gray-800 rounded overflow-hidden">
            ${r.thumbnailUrl ? `<img src="${esc(r.thumbnailUrl)}" alt="${esc(r.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />` : ''}
            ${r.durationSeconds ? `<span class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded font-mono">${formatDuration(r.durationSeconds)}</span>` : ''}
          </div>
          <div class="min-w-0">
            <h3 class="text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-purple-400 transition-colors">${esc(r.title)}</h3>
            <p class="text-xs text-gray-500 mt-1">${r.channelName ? esc(r.channelName) : ''}</p>
            <p class="text-xs text-gray-500">${formatViews(r.viewCount)} visualizações</p>
          </div>
        </a>`).join('')}
        ${video.related.length === 0 ? '<p class="text-gray-600 text-sm">Nenhum vídeo relacionado</p>' : ''}
      </div>
    </div>
  </div>`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description || video.title,
    thumbnailUrl: video.thumbnail_url,
    uploadDate: video.published_at || video.created_at,
    duration: video.duration_seconds ? `PT${Math.floor(video.duration_seconds / 60)}M${video.duration_seconds % 60}S` : undefined,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/WatchAction',
      userInteractionCount: video.view_count,
    },
  });

  return layout(settings, {
    title: video.title,
    description: video.description || video.title,
    canonical: `https://${tenant.domain}/video/${slug}`,
    ogImage: video.thumbnail_url ?? undefined,
    content,
    activePath: '/videos',
    jsonLd,
  });
}

async function renderCategoriesPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string): Promise<string> {
  const categories = await getCategories(db, tenant.tenantId, locale);

  let content = `<h1 class="text-2xl font-bold mb-6">Categorias</h1>`;

  if (categories.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhuma categoria disponível</p>`;
  } else {
    content += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${categories.map((c) => `<a href="/category/${esc(c.slug)}" class="bg-gray-900 rounded-lg p-5 text-center hover:bg-gray-800 hover:ring-1 hover:ring-purple-500/30 transition-all group">
        <p class="font-medium text-gray-200 group-hover:text-purple-400 transition-colors">${esc(c.name)}</p>
        <p class="text-sm text-gray-500 mt-1">${c.videoCount} vídeo${c.videoCount !== 1 ? 's' : ''}</p>
        ${c.description ? `<p class="text-xs text-gray-600 mt-2 line-clamp-2">${esc(c.description)}</p>` : ''}
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    title: 'Categorias',
    description: `Categorias de vídeos em ${settings.siteName}`,
    canonical: `https://${tenant.domain}/categories`,
    content,
    activePath: '/categories',
  });
}

async function renderCategoryPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL): Promise<string | null> {
  const category = await getCategoryBySlug(db, tenant.tenantId, locale, slug);
  if (!category) return null;

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, categorySlug: slug });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="/categories" class="hover:text-gray-300">Categorias</a> <span class="mx-1">›</span> <span class="text-gray-300">${esc(category.name)}</span></nav>
    <h1 class="text-2xl font-bold">${esc(category.name)}</h1>
    ${category.description ? `<p class="text-gray-400 text-sm mt-1">${esc(category.description)}</p>` : ''}
    <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
  </div>`;
  content += videoGrid(videos);
  content += pagination(page, totalPages, `/category/${slug}`);

  return layout(settings, {
    title: category.name,
    description: category.description || `Vídeos da categoria ${category.name}`,
    canonical: `https://${tenant.domain}/category/${slug}`,
    content,
    activePath: '/categories',
  });
}

async function renderPerformersPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string): Promise<string> {
  const performers = await getPerformers(db, tenant.tenantId, locale);

  let content = `<h1 class="text-2xl font-bold mb-6">Modelos</h1>`;

  if (performers.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhum modelo disponível</p>`;
  } else {
    content += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${performers.map((p) => `<a href="/performer/${esc(p.slug)}" class="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/30 transition-all group">
        <div class="aspect-square bg-gray-800 flex items-center justify-center">
          ${p.imageUrl
            ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />`
            : `<svg class="w-16 h-16 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
          }
        </div>
        <div class="p-3">
          <p class="font-medium text-gray-200 text-sm truncate group-hover:text-purple-400 transition-colors">${esc(p.name)}</p>
          <p class="text-xs text-gray-500">${p.videoCount} vídeo${p.videoCount !== 1 ? 's' : ''}</p>
        </div>
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    title: 'Modelos',
    description: `Modelos e performers em ${settings.siteName}`,
    canonical: `https://${tenant.domain}/performers`,
    content,
    activePath: '/performers',
  });
}

async function renderPerformerPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL): Promise<string | null> {
  const performer = await getPerformerBySlug(db, tenant.tenantId, locale, slug);
  if (!performer) return null;

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, performerSlug: slug });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="/performers" class="hover:text-gray-300">Modelos</a> <span class="mx-1">›</span> <span class="text-gray-300">${esc(performer.name)}</span></nav>
    <div class="flex items-start gap-4">
      ${performer.imageUrl ? `<img src="${esc(performer.imageUrl)}" alt="${esc(performer.name)}" class="w-20 h-20 rounded-full object-cover shrink-0" />` : ''}
      <div>
        <h1 class="text-2xl font-bold">${esc(performer.name)}</h1>
        ${performer.bio ? `<p class="text-gray-400 text-sm mt-1">${esc(performer.bio)}</p>` : ''}
        <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
      </div>
    </div>
  </div>`;
  content += videoGrid(videos);
  content += pagination(page, totalPages, `/performer/${slug}`);

  return layout(settings, {
    title: performer.name,
    description: performer.bio || `Vídeos de ${performer.name}`,
    canonical: `https://${tenant.domain}/performer/${slug}`,
    ogImage: performer.imageUrl ?? undefined,
    content,
    activePath: '/performers',
  });
}

async function renderTagsPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string): Promise<string> {
  const tags = await getTags(db, tenant.tenantId, locale);

  let content = `<h1 class="text-2xl font-bold mb-6">Tags</h1>`;

  if (tags.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhuma tag disponível</p>`;
  } else {
    content += `<div class="flex flex-wrap gap-2">
      ${tags.map((t) => `<a href="/tag/${esc(t.slug)}" class="bg-gray-900 px-4 py-2 rounded-lg text-sm hover:bg-gray-800 hover:text-purple-400 transition-colors">
        <span class="text-gray-400">#</span>${esc(t.name)}
        <span class="text-xs text-gray-600 ml-1">(${t.videoCount})</span>
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    title: 'Tags',
    description: `Tags de vídeos em ${settings.siteName}`,
    canonical: `https://${tenant.domain}/tags`,
    content,
    activePath: '/tags',
  });
}

async function renderTagPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL): Promise<string | null> {
  const tag = await getTagBySlug(db, tenant.tenantId, locale, slug);
  if (!tag) return null;

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, tagSlug: slug });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="/tags" class="hover:text-gray-300">Tags</a> <span class="mx-1">›</span> <span class="text-gray-300">#${esc(tag.name)}</span></nav>
    <h1 class="text-2xl font-bold">#${esc(tag.name)}</h1>
    <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
  </div>`;
  content += videoGrid(videos);
  content += pagination(page, totalPages, `/tag/${slug}`);

  return layout(settings, {
    title: `#${tag.name}`,
    description: `Vídeos com a tag ${tag.name}`,
    canonical: `https://${tenant.domain}/tag/${slug}`,
    content,
    activePath: '/tags',
  });
}

async function renderChannelsPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string): Promise<string> {
  const channels = await getChannels(db, tenant.tenantId, locale);

  let content = `<h1 class="text-2xl font-bold mb-6">Canais</h1>`;

  if (channels.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhum canal disponível</p>`;
  } else {
    content += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${channels.map((ch) => `<a href="/channel/${esc(ch.slug)}" class="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/30 transition-all group">
        <div class="aspect-video bg-gray-800 flex items-center justify-center">
          ${ch.logoUrl
            ? `<img src="${esc(ch.logoUrl)}" alt="${esc(ch.name)}" loading="lazy" class="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />`
            : `<svg class="w-12 h-12 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12zM9 10v8l7-4z"/></svg>`
          }
        </div>
        <div class="p-3">
          <p class="font-medium text-gray-200 text-sm truncate group-hover:text-purple-400 transition-colors">${esc(ch.name)}</p>
          <p class="text-xs text-gray-500">${ch.videoCount} vídeo${ch.videoCount !== 1 ? 's' : ''}</p>
        </div>
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    title: 'Canais',
    description: `Canais de vídeos em ${settings.siteName}`,
    canonical: `https://${tenant.domain}/channels`,
    content,
    activePath: '/channels',
  });
}

async function renderChannelPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL): Promise<string | null> {
  const channel = await getChannelBySlug(db, tenant.tenantId, locale, slug);
  if (!channel) return null;

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, channelSlug: slug });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="/channels" class="hover:text-gray-300">Canais</a> <span class="mx-1">›</span> <span class="text-gray-300">${esc(channel.name)}</span></nav>
    <div class="flex items-start gap-4">
      ${channel.logoUrl ? `<img src="${esc(channel.logoUrl)}" alt="${esc(channel.name)}" class="w-16 h-16 rounded-lg object-contain bg-gray-800 p-2 shrink-0" />` : ''}
      <div>
        <h1 class="text-2xl font-bold">${esc(channel.name)}</h1>
        ${channel.description ? `<p class="text-gray-400 text-sm mt-1">${esc(channel.description)}</p>` : ''}
        <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
      </div>
    </div>
  </div>`;
  content += videoGrid(videos);
  content += pagination(page, totalPages, `/channel/${slug}`);

  return layout(settings, {
    title: channel.name,
    description: channel.description || `Vídeos do canal ${channel.name}`,
    canonical: `https://${tenant.domain}/channel/${slug}`,
    content,
    activePath: '/channels',
  });
}

async function renderStaticPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string): Promise<string | null> {
  const page = await getPage(db, tenant.tenantId, locale, slug);
  if (!page) return null;

  // Simple markdown-ish rendering (paragraphs, bold, italic, links, headers)
  let html = esc(page.content)
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-purple-400 hover:underline">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-300 leading-relaxed">')
    .replace(/\n/g, '<br>');
  html = `<p class="mb-4 text-gray-300 leading-relaxed">${html}</p>`;

  const content = `<article class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">${esc(page.title)}</h1>
    <div class="prose prose-invert max-w-none">${html}</div>
  </article>`;

  return layout(settings, {
    title: page.title,
    description: page.content.slice(0, 160),
    canonical: `https://${tenant.domain}/pages/${slug}`,
    content,
  });
}

// ─── Search Page ─────────────────────────────────────────────────────────────

async function renderSearchPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, url: URL): Promise<string> {
  const query = url.searchParams.get('q') ?? url.searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;

  let content = '';

  // Search form hero
  content += `<section class="mb-8">
    <h1 class="text-2xl font-bold mb-4">${query ? `Resultados para "${esc(query)}"` : 'Buscar Vídeos'}</h1>
    <form action="/search" method="GET" class="max-w-2xl">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <input type="text" name="q" value="${esc(query)}" placeholder="Digite sua busca..." autofocus
            class="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <button type="submit" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors">
          Buscar
        </button>
      </div>
    </form>
  </section>`;

  if (query) {
    const { videos, total } = await getVideos(db, tenant.tenantId, locale, {
      limit: VIDEOS_PER_PAGE,
      offset,
      search: query,
    });
    const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

    content += `<p class="text-gray-500 text-sm mb-4">${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}</p>`;
    content += videoGrid(videos);
    content += pagination(page, totalPages, `/search?q=${encodeURIComponent(query)}`);
  } else {
    // Show popular tags as search suggestions
    const tags = await getTags(db, tenant.tenantId, locale);
    const topTags = tags.slice(0, 30);

    if (topTags.length > 0) {
      content += `<section class="mt-8">
        <h2 class="text-lg font-semibold mb-4 text-gray-300">Tags Populares</h2>
        <div class="flex flex-wrap gap-2">
          ${topTags.map((t) => `<a href="/search?q=${encodeURIComponent(t.name)}" class="bg-gray-900 px-4 py-2 rounded-lg text-sm hover:bg-gray-800 hover:text-purple-400 transition-colors">
            <span class="text-gray-400">#</span>${esc(t.name)}
            <span class="text-xs text-gray-600 ml-1">(${t.videoCount})</span>
          </a>`).join('')}
        </div>
      </section>`;
    }
  }

  return layout(settings, {
    title: query ? `Busca: ${query}` : 'Buscar',
    description: query ? `Resultados da busca por "${query}"` : `Buscar vídeos em ${settings.siteName}`,
    canonical: `https://${tenant.domain}/search`,
    content,
    activePath: '/search',
  });
}

// ─── 404 Page ────────────────────────────────────────────────────────────────

function render404Page(settings: SiteSettings | null, tenant: TenantInfo | null): string {
  if (!settings || !tenant) {
    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Site não encontrado — Frame Videos</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{text-align:center;padding:2rem}h1{font-size:4rem;margin-bottom:1rem;color:#475569}p{color:#64748b;font-size:1.1rem;margin-bottom:2rem}a{color:#8b5cf6;text-decoration:none;font-weight:500}a:hover{text-decoration:underline}</style>
</head><body><div class="c"><h1>404</h1><p>Este site não foi encontrado ou ainda não está configurado.</p><a href="https://framevideos.com">Criar seu site com Frame Videos →</a></div></body></html>`;
  }

  const content = `<div class="text-center py-20">
    <p class="text-6xl font-bold text-gray-700 mb-4">404</p>
    <h1 class="text-2xl font-bold mb-2">Página não encontrada</h1>
    <p class="text-gray-500 mb-6">A página que você procura não existe ou foi removida.</p>
    <a href="/" class="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
      ← Voltar ao início
    </a>
  </div>`;

  return layout(settings, { title: 'Página não encontrada', content });
}

// ─── Router ──────────────────────────────────────────────────────────────────

function matchRoute(pathname: string): { handler: string; params: Record<string, string> } {
  // Exact matches
  if (pathname === '/' || pathname === '') return { handler: 'home', params: {} };
  if (pathname === '/videos') return { handler: 'videos', params: {} };
  if (pathname === '/search') return { handler: 'search', params: {} };
  if (pathname === '/categories') return { handler: 'categories', params: {} };
  if (pathname === '/performers') return { handler: 'performers', params: {} };
  if (pathname === '/tags') return { handler: 'tags', params: {} };
  if (pathname === '/channels') return { handler: 'channels', params: {} };

  // Parameterized routes
  const videoMatch = pathname.match(/^\/video\/([^/]+)$/);
  if (videoMatch) return { handler: 'video', params: { slug: videoMatch[1]! } };

  const categoryMatch = pathname.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) return { handler: 'category', params: { slug: categoryMatch[1]! } };

  const performerMatch = pathname.match(/^\/performer\/([^/]+)$/);
  if (performerMatch) return { handler: 'performer', params: { slug: performerMatch[1]! } };

  const tagMatch = pathname.match(/^\/tag\/([^/]+)$/);
  if (tagMatch) return { handler: 'tag', params: { slug: tagMatch[1]! } };

  const channelMatch = pathname.match(/^\/channel\/([^/]+)$/);
  if (channelMatch) return { handler: 'channel', params: { slug: channelMatch[1]! } };

  const pageMatch = pathname.match(/^\/pages\/([^/]+)$/);
  if (pageMatch) return { handler: 'page', params: { slug: pageMatch[1]! } };

  return { handler: '404', params: {} };
}

// ─── Worker Entry Point ─────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // Health check
    if (pathname === '/__health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'tenant-site' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Robots.txt
    if (pathname === '/robots.txt') {
      return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://${hostname}/sitemap.xml`, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Favicon fallback
    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    try {
      // Resolve tenant
      const tenant = await resolveTenant(hostname, env.DB, env.CACHE);

      if (!tenant) {
        return new Response(render404Page(null, null), {
          status: 404,
          headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=60' },
        });
      }

      // Admin path → serve admin SPA (handled by separate worker or redirect)
      if (pathname.startsWith('/admin')) {
        // For now, redirect to admin placeholder. In production, this would be handled by the tenant-admin worker.
        return new Response(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Painel Admin — ${esc(tenant.tenantName)}</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="bg-[#0a0a0f] text-gray-100 min-h-screen flex items-center justify-center">
<div class="text-center"><p class="text-4xl mb-4">⚙️</p><h1 class="text-2xl font-bold mb-2">Painel Admin</h1>
<p class="text-gray-500 mb-4">${esc(tenant.tenantName)}</p>
<p class="text-gray-600 text-sm">O painel de administração será servido como SPA separado.</p>
<a href="/" class="inline-block mt-4 text-purple-400 hover:text-purple-300">← Voltar ao site</a></div>
</body></html>`, {
          status: 200,
          headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      // Load settings and locale
      const [settings, locale] = await Promise.all([
        getSiteSettings(env.DB, tenant.tenantId, tenant.tenantName),
        getTenantLocale(env.DB, tenant.tenantId),
      ]);

      // Route
      const route = matchRoute(pathname);
      let html: string | null = null;

      switch (route.handler) {
        case 'home':
          html = await renderHomepage(env.DB, tenant, settings, locale);
          break;
        case 'videos':
          html = await renderVideosPage(env.DB, tenant, settings, locale, url);
          break;
        case 'search':
          html = await renderSearchPage(env.DB, tenant, settings, locale, url);
          break;
        case 'video':
          html = await renderVideoPage(env.DB, tenant, settings, locale, route.params.slug!);
          break;
        case 'categories':
          html = await renderCategoriesPage(env.DB, tenant, settings, locale);
          break;
        case 'category':
          html = await renderCategoryPage(env.DB, tenant, settings, locale, route.params.slug!, url);
          break;
        case 'performers':
          html = await renderPerformersPage(env.DB, tenant, settings, locale);
          break;
        case 'performer':
          html = await renderPerformerPage(env.DB, tenant, settings, locale, route.params.slug!, url);
          break;
        case 'tags':
          html = await renderTagsPage(env.DB, tenant, settings, locale);
          break;
        case 'tag':
          html = await renderTagPage(env.DB, tenant, settings, locale, route.params.slug!, url);
          break;
        case 'channels':
          html = await renderChannelsPage(env.DB, tenant, settings, locale);
          break;
        case 'channel':
          html = await renderChannelPage(env.DB, tenant, settings, locale, route.params.slug!, url);
          break;
        case 'page':
          html = await renderStaticPage(env.DB, tenant, settings, locale, route.params.slug!);
          break;
      }

      if (!html) {
        return new Response(render404Page(settings, tenant), {
          status: 404,
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=60',
            'X-Tenant-Id': tenant.tenantId,
          },
        });
      }

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'X-Tenant-Id': tenant.tenantId,
          'X-Frame-Options': 'SAMEORIGIN',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      });
    } catch (err) {
      console.error('[tenant-site] Error:', err);
      return new Response(render404Page(null, null), {
        status: 500,
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
      });
    }
  },
} satisfies ExportedHandler<Env>;
