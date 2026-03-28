// Tenant Site Worker — Entry point
// SSR: resolve domains → render tenant site with D1 data
// Modularized from original 1800+ line monolith

import type { Env } from './types.js';
import { resolveTenant, getSiteSettings, getTenantLocaleConfig, detectLocaleFromHeader, checkRedirect } from './db/tenant.js';
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

      // ─── Analytics tracking proxy ────────────────────────────────────
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

          const trackFetch = fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trackPayload),
          }).catch(() => {});

          await trackFetch;
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

      // Load locale config + check redirects in parallel
      const [localeConfig, redirect] = await Promise.all([
        getTenantLocaleConfig(env.DB, tenant.tenantId),
        checkRedirect(env.DB, tenant.tenantId, pathname),
      ]);

      // Handle redirect
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

      // ─── Full-page KV cache (5 min for public pages) ───────────────
      const isPublicPage = !pathname.startsWith('/admin') && !pathname.startsWith('/advertiser') && request.method === 'GET';
      // Route matching + cache key
      const route = matchRoute(pathname);
      const cacheLocale = route.locale ?? 'default';
      const cacheKey = isPublicPage ? `page:${tenant.tenantId}:${cacheLocale}:${pathname}` : null;

      if (cacheKey) {
        const cachedHtml = await env.CACHE.get(cacheKey);
        if (cachedHtml) {
          const response = new Response(cachedHtml, {
            headers: {
              'Content-Type': 'text/html;charset=UTF-8',
              'Cache-Control': 'public, max-age=60, s-maxage=300',
              'Content-Language': cacheLocale === 'default' ? 'pt' : cacheLocale,
              'X-Tenant-Id': tenant.tenantId,
              'X-Cache': 'HIT',
            },
          });
          addSecurityHeaders(response.headers);
          return response;
        }
      }

      // Load settings + ad placements in parallel (not sequential)
      const [settings, adPlacements] = await Promise.all([
        getSiteSettings(env.DB, tenant.tenantId, tenant.tenantName),
        getActivePlacements(env.DB, tenant.tenantId).catch(() => ({ header: null, sidebar: null, inContent: null })),
      ]);

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

      // Write to KV cache (5 min TTL)
      if (cacheKey && html) {
        try { await env.CACHE.put(cacheKey, html, { expirationTtl: 300 }); } catch { /* ignore cache write errors */ }
      }

      return addSecurityHeaders(new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'X-Tenant-Id': tenant.tenantId,
          'X-Cache': 'MISS',
          'Content-Language': locale,
          'Vary': 'Accept-Language',
        },
      }));
    } catch (err) {
      console.error('[tenant-site] Error:', err);
      return new Response(render404Page(null, null), {
        status: 500,
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
      });
    }
  },
} satisfies ExportedHandler<Env>;
