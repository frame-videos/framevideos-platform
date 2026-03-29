// Tenant Site Worker — Entry point
// SSR: resolve domains → render tenant site with D1 data
// Optimized: Cache API first, db.batch(), unified tenant bundle, Server-Timing headers
//
// Performance architecture (cache-first, 3-layer):
// Layer 1: Cloudflare Cache API (per-datacenter, <1ms) — full HTML responses
// Layer 2: KV bundle cache (tenant + locale + settings) — avoids D1 for tenant resolution
// Layer 3: D1 batch queries — minimal round-trips when cache miss

import type { Env, TenantBundle } from './types.js';
import { resolveTenantBundle, detectLocaleFromHeader, checkRedirect } from './db/tenant.js';
import { matchRoute } from './router.js';
import { esc } from './helpers/html.js';
import { generateSitemapIndex, generateVideoSitemap, generateCategorySitemap, generatePageSitemap } from './sitemap/generators.js';
import { renderHomepage } from './renderers/home.js';
import { renderVideosPage, renderVideoPage } from './renderers/videos.js';
import { renderCategoriesPage, renderCategoryPage } from './renderers/categories.js';
import { renderPerformersPage, renderPerformerPage } from './renderers/performers.js';
import { renderTagsPage, renderTagPage } from './renderers/tags.js';
import { renderChannelsPage, renderChannelPage } from './renderers/channels.js';
import { renderStaticPage } from './renderers/pages.js';
import { renderSearchPage } from './renderers/search.js';
import { renderLoginPage, renderSignupPage, renderForgotPasswordPage, renderResetPasswordPage } from './renderers/auth.js';
import { render404Page } from './renderers/error.js';
import { renderAdvertiserLogin, renderAdvertiserDashboard, renderAdvertiserCampaigns, renderAdvertiserReports } from './renderers/advertiser.js';
import { handleAdminRequest } from './renderers/admin.js';
import { addSecurityHeaders } from './helpers/security.js';
import { getActivePlacements } from './helpers/ads.js';
import type { AdSlotConfig } from './templates/layout.js';

// ─── Timing helper ───────────────────────────────────────────────────────────

class ServerTiming {
  private entries: Array<{ name: string; dur: number; desc?: string }> = [];
  private marks = new Map<string, number>();

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, desc?: string): void {
    const start = this.marks.get(name);
    if (start !== undefined) {
      this.entries.push({ name, dur: Math.round((performance.now() - start) * 100) / 100, desc });
      this.marks.delete(name);
    }
  }

  add(name: string, dur: number, desc?: string): void {
    this.entries.push({ name, dur: Math.round(dur * 100) / 100, desc });
  }

  toString(): string {
    return this.entries
      .map((e) => {
        let s = e.name;
        if (e.desc) s += `;desc="${e.desc}"`;
        s += `;dur=${e.dur}`;
        return s;
      })
      .join(', ');
  }
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

/** Build a cache key URL for the Cloudflare Cache API */
function buildCacheKey(request: Request, locale: string): Request {
  const url = new URL(request.url);
  // Include locale in cache key to vary by locale
  url.searchParams.set('_locale', locale);
  // Remove any tracking params that shouldn't affect cache
  url.searchParams.delete('utm_source');
  url.searchParams.delete('utm_medium');
  url.searchParams.delete('utm_campaign');
  url.searchParams.delete('utm_content');
  url.searchParams.delete('utm_term');
  url.searchParams.delete('fbclid');
  url.searchParams.delete('gclid');
  return new Request(url.toString(), { method: 'GET' });
}

/** Pages that should be cached via Cache API */
function isCacheablePage(pathname: string, method: string): boolean {
  if (method !== 'GET') return false;
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/advertiser')) return false;
  if (pathname.startsWith('/api/')) return false;
  if (pathname === '/__health') return false;
  return true;
}

// ─── Main fetch handler ─────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const timing = new ServerTiming();
    const totalStart = performance.now();

    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // ── Fast paths (no D1, no cache) ──
    if (pathname === '/__health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'tenant-site' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    try {
      // ══════════════════════════════════════════════════════════════════
      // LAYER 1: Cloudflare Cache API check (per-datacenter, <1ms)
      // This runs BEFORE any D1 queries or KV reads.
      // The Cache API key is the full URL + locale, so we need to detect
      // locale from the URL path first (no D1 needed for that).
      // ══════════════════════════════════════════════════════════════════

      const route = matchRoute(pathname);
      const routeLocale = route.locale ?? 'default';
      const cacheable = isCacheablePage(pathname, request.method);

      if (cacheable) {
        timing.mark('cache-api');
        const cache = caches.default;
        const cacheRequest = buildCacheKey(request, routeLocale);

        const cachedResponse = await cache.match(cacheRequest);
        timing.measure('cache-api', 'Cache API lookup');

        if (cachedResponse) {
          // Cache HIT — return immediately, 0 D1 queries!
          const headers = new Headers(cachedResponse.headers);
          headers.set('X-Cache', 'HIT');
          headers.set('Server-Timing', `cache-api;desc="Cache API HIT";dur=0, total;dur=${Math.round(performance.now() - totalStart)}`);

          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            headers,
          });
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // LAYER 2: Resolve tenant bundle (KV cached: tenant + locale + settings)
      // Single KV read replaces 3-5 D1 queries on cache hit.
      // On KV miss: 1 D1 query (tenant) + 1 db.batch (configs) = 2 round-trips.
      // ══════════════════════════════════════════════════════════════════

      timing.mark('tenant');
      const bundle = await resolveTenantBundle(hostname, env.DB, env.CACHE);
      timing.measure('tenant', 'Tenant resolution');

      if (!bundle) {
        return new Response(render404Page(null, null), {
          status: 404,
          headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=60' },
        });
      }

      const { tenant, localeConfig, settings } = bundle;

      // ── Analytics tracking proxy ────────────────────────────────────
      if (pathname === '/api/track' && request.method === 'POST') {
        try {
          const body = await request.json() as { path?: string; referrer?: string };
          const userAgent = request.headers.get('user-agent') ?? '';
          const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? '';

          const trackPayload = {
            path: body.path ?? '/',
            referrer: body.referrer ?? '',
            user_agent: userAgent,
            tenant_id: tenant.tenantId,
            country,
          };

          const apiUrl = env.ENVIRONMENT === 'production'
            ? 'https://api.framevideos.com/api/v1/analytics/track'
            : 'https://api-staging.framevideos.com/api/v1/analytics/track';

          // Fire and forget — don't block response
          ctx.waitUntil(
            fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(trackPayload),
            }).catch(() => {})
          );
        } catch {
          // Never break on tracking errors
        }
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Cache-Control': 'no-store',
          },
        });
      }

      // CORS preflight for /api/track
      if (pathname === '/api/track' && request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // ── Check redirects (1 D1 query, only for non-cached requests) ──
      timing.mark('redirect');
      const redirect = await checkRedirect(env.DB, tenant.tenantId, pathname);
      timing.measure('redirect', 'Redirect check');

      if (redirect) {
        return new Response(null, {
          status: redirect.statusCode,
          headers: { 'Location': redirect.toPath },
        });
      }

      // Robots.txt
      if (pathname === '/robots.txt') {
        const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: https://${hostname}/sitemap.xml`;
        return new Response(robotsTxt, {
          headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' },
        });
      }

      // Sitemap endpoints
      if (pathname === '/sitemap.xml') {
        const xml = await generateSitemapIndex(hostname);
        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
        });
      }

      if (pathname === '/sitemap-videos.xml' || pathname.match(/^\/sitemap-videos-(\d+)\.xml$/)) {
        const pageMatch = pathname.match(/^\/sitemap-videos-(\d+)\.xml$/);
        const pageNum = pageMatch ? parseInt(pageMatch[1]!, 10) : 1;
        const xml = await generateVideoSitemap(env.DB, tenant.tenantId, hostname, localeConfig, pageNum);
        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
        });
      }

      if (pathname === '/sitemap-categories.xml') {
        const xml = await generateCategorySitemap(env.DB, tenant.tenantId, hostname, localeConfig);
        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
        });
      }

      if (pathname === '/sitemap-pages.xml') {
        const xml = await generatePageSitemap(env.DB, tenant.tenantId, hostname, localeConfig);
        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
        });
      }

      // Admin SPA
      if (pathname.startsWith('/admin')) {
        return handleAdminRequest(pathname, env, tenant);
      }

      // ══════════════════════════════════════════════════════════════════
      // LAYER 3: Render page (D1 queries via db.batch())
      // At this point we have tenant + locale + settings from KV bundle.
      // Only content queries remain (batched).
      // ══════════════════════════════════════════════════════════════════

      // Load ad placements (1 D1 query — can run in parallel with render)
      timing.mark('ads');
      const adPlacements = await getActivePlacements(env.DB, tenant.tenantId).catch(() => ({ header: null, sidebar: null, inContent: null }));
      timing.measure('ads', 'Ad placements');

      let adSlots: AdSlotConfig | undefined;
      const apiBaseUrl = env.ENVIRONMENT === 'production'
        ? 'https://api.framevideos.com'
        : 'https://api-staging.framevideos.com';

      if (adPlacements.header || adPlacements.sidebar || adPlacements.inContent) {
        adSlots = {
          tenantId: tenant.tenantId,
          apiBaseUrl,
          headerPlacementId: adPlacements.header?.id,
          sidebarPlacementId: adPlacements.sidebar?.id,
          inContentPlacementId: adPlacements.inContent?.id,
        };
      }

      // Determine locale: route locale > Accept-Language > default
      let locale = localeConfig.defaultLocale;
      if (route.locale && localeConfig.enabledLocales.includes(route.locale)) {
        locale = route.locale;
      } else if (!route.locale && route.handler === 'home') {
        const detected = detectLocaleFromHeader(request.headers.get('Accept-Language'), localeConfig);
        if (detected && detected !== localeConfig.defaultLocale && localeConfig.enabledLocales.length > 1) {
          return new Response(null, {
            status: 302,
            headers: { 'Location': `/${detected}/`, 'Vary': 'Accept-Language' },
          });
        }
      }

      timing.mark('render');
      let html: string | null = null;

      switch (route.handler) {
        case 'home':
          html = await renderHomepage(env.DB, tenant, settings, locale, localeConfig);
          break;
        case 'videos':
          html = await renderVideosPage(env.DB, tenant, settings, locale, url, localeConfig);
          break;
        case 'search':
          html = await renderSearchPage(env.DB, tenant, settings, locale, url, localeConfig);
          break;
        case 'video':
          html = await renderVideoPage(env.DB, tenant, settings, locale, route.params['slug']!, localeConfig);
          break;
        case 'categories':
          html = await renderCategoriesPage(env.DB, tenant, settings, locale, localeConfig);
          break;
        case 'category':
          html = await renderCategoryPage(env.DB, tenant, settings, locale, route.params['slug']!, url, localeConfig);
          break;
        case 'performers':
          html = await renderPerformersPage(env.DB, tenant, settings, locale, localeConfig);
          break;
        case 'performer':
          html = await renderPerformerPage(env.DB, tenant, settings, locale, route.params['slug']!, url, localeConfig);
          break;
        case 'tags':
          html = await renderTagsPage(env.DB, tenant, settings, locale, localeConfig);
          break;
        case 'tag':
          html = await renderTagPage(env.DB, tenant, settings, locale, route.params['slug']!, url, localeConfig);
          break;
        case 'channels':
          html = await renderChannelsPage(env.DB, tenant, settings, locale, localeConfig);
          break;
        case 'channel':
          html = await renderChannelPage(env.DB, tenant, settings, locale, route.params['slug']!, url, localeConfig);
          break;
        case 'page':
          html = await renderStaticPage(env.DB, tenant, settings, locale, route.params['slug']!, localeConfig);
          break;
        case 'advertiser-login':
          html = renderAdvertiserLogin(settings, tenant);
          break;
        case 'advertiser-dashboard':
          html = renderAdvertiserDashboard(settings, tenant);
          break;
        case 'advertiser-campaigns':
          html = renderAdvertiserCampaigns(settings, tenant);
          break;
        case 'advertiser-reports':
          html = renderAdvertiserReports(settings, tenant);
          break;
        case 'auth-login':
          html = renderLoginPage(settings, tenant);
          break;
        case 'auth-signup':
          html = renderSignupPage(settings, tenant);
          break;
        case 'auth-forgot':
          html = renderForgotPasswordPage(settings, tenant);
          break;
        case 'auth-reset': {
          const resetToken = url.searchParams.get('token') ?? '';
          html = renderResetPasswordPage(settings, tenant, resetToken);
          break;
        }
      }

      timing.measure('render', 'Page render');

      if (!html) {
        return addSecurityHeaders(new Response(render404Page(settings, tenant), {
          status: 404,
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=60',
            'X-Tenant-Id': tenant.tenantId,
          },
        }));
      }

      // ── Build response ──
      const totalDur = Math.round((performance.now() - totalStart) * 100) / 100;
      timing.add('total', totalDur, 'Total');

      const responseHeaders: Record<string, string> = {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'X-Tenant-Id': tenant.tenantId,
        'X-Cache': 'MISS',
        'Content-Language': locale,
        'Vary': 'Accept-Language',
        'Server-Timing': timing.toString(),
      };

      const response = addSecurityHeaders(new Response(html, {
        status: 200,
        headers: responseHeaders,
      }));

      // ── Write to caches (non-blocking via waitUntil) ──
      if (cacheable && html) {
        ctx.waitUntil(writeToCaches(request, routeLocale, html, locale, tenant.tenantId, env.CACHE));
      }

      return response;
    } catch (err) {
      console.error('[tenant-site] Error:', err);
      return new Response(render404Page(null, null), {
        status: 500,
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
      });
    }
  },
} satisfies ExportedHandler<Env>;

// ─── Background cache write (non-blocking) ──────────────────────────────────

async function writeToCaches(
  request: Request,
  routeLocale: string,
  html: string,
  locale: string,
  tenantId: string,
  kvCache: KVNamespace,
): Promise<void> {
  try {
    // Write to Cloudflare Cache API (per-datacenter, instant on next request)
    const cache = caches.default;
    const cacheRequest = buildCacheKey(request, routeLocale);
    const cacheResponse = new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'X-Tenant-Id': tenantId,
        'X-Cache': 'HIT',
        'Content-Language': locale,
        'Vary': 'Accept-Language',
      },
    });
    await cache.put(cacheRequest, cacheResponse);
  } catch {
    // Cache write failures are non-critical
  }

  try {
    // Also write to KV for cross-datacenter cache warming
    const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    const kvKey = `page:${tenantId}:${routeLocale}:${pathname}`;
    await kvCache.put(kvKey, html, { expirationTtl: 300 });
  } catch {
    // KV write failures are non-critical
  }
}
