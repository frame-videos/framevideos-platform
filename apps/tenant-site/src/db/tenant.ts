// Tenant Site — Domain resolution & tenant data access

import type { TenantInfo, SiteSettings, LocaleConfig } from '../types.js';
import { CACHE_TTL_SECONDS, RESERVED_SUBDOMAINS } from '../constants.js';

// ─── Domain Resolution ──────────────────────────────────────────────────────

export async function resolveTenant(
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
      const planSlug = await getTenantPlanSlug(db, result.id);
      tenant = { tenantId: result.id, tenantName: result.name, tenantSlug: result.slug, domain: hostname, isPrimary: false, planSlug, isWhiteLabel: planSlug === 'enterprise' };
    }
  } else {
    const result = await db
      .prepare(`SELECT d.tenant_id, d.domain, d.is_primary, t.name, t.slug FROM domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.domain = ? AND d.status = 'active' AND t.status IN ('active', 'trial') LIMIT 1`)
      .bind(hostname)
      .first<{ tenant_id: string; domain: string; is_primary: number; name: string; slug: string }>();

    if (result) {
      const planSlug = await getTenantPlanSlug(db, result.tenant_id);
      tenant = { tenantId: result.tenant_id, tenantName: result.name, tenantSlug: result.slug, domain: result.domain, isPrimary: result.is_primary === 1, planSlug, isWhiteLabel: planSlug === 'enterprise' };
    }
  }

  if (tenant) {
    await cache.put(cacheKey, JSON.stringify(tenant), { expirationTtl: CACHE_TTL_SECONDS });
  } else {
    await cache.put(cacheKey, '__404__', { expirationTtl: 60 });
  }

  return tenant;
}

// ─── Plan helper ─────────────────────────────────────────────────────────────

export async function getTenantPlanSlug(db: D1Database, tenantId: string): Promise<string> {
  try {
    const row = await db
      .prepare("SELECT p.slug FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.tenant_id = ? AND s.status IN ('active', 'trialing') LIMIT 1")
      .bind(tenantId)
      .first<{ slug: string }>();
    return row?.slug ?? 'free';
  } catch {
    return 'free';
  }
}

// ─── Site Settings ───────────────────────────────────────────────────────────

export async function getSiteSettings(db: D1Database, tenantId: string, tenantName: string): Promise<SiteSettings> {
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

// ─── Locale ──────────────────────────────────────────────────────────────────

export async function getTenantLocale(db: D1Database, tenantId: string): Promise<string> {
  const config = await getTenantLocaleConfig(db, tenantId);
  return config.defaultLocale;
}

export async function getTenantLocaleConfig(db: D1Database, tenantId: string): Promise<LocaleConfig> {
  const configs = await db.prepare(
    "SELECT config_key, config_value FROM tenant_configs WHERE tenant_id = ? AND config_key IN ('default_locale', 'enabled_locales')"
  ).bind(tenantId).all<{ config_key: string; config_value: string }>();

  let defaultLocale = 'pt';
  let enabledLocales = ['pt'];

  for (const cfg of configs.results) {
    if (cfg.config_key === 'default_locale') defaultLocale = cfg.config_value;
    if (cfg.config_key === 'enabled_locales') {
      try { enabledLocales = JSON.parse(cfg.config_value); } catch { /* ignore */ }
    }
  }

  if (enabledLocales.length === 0) enabledLocales = [defaultLocale];

  return { defaultLocale, enabledLocales };
}

/** Parse Accept-Language header to find best matching locale */
export function detectLocaleFromHeader(acceptLang: string | null, config: LocaleConfig): string | null {
  if (!acceptLang) return null;

  const parts = acceptLang.split(',').map((part) => {
    const [lang, qPart] = part.trim().split(';');
    const q = qPart ? parseFloat(qPart.replace('q=', '')) : 1.0;
    return { lang: lang!.trim().split('-')[0]!.toLowerCase(), q };
  }).sort((a, b) => b.q - a.q);

  for (const { lang } of parts) {
    if (config.enabledLocales.includes(lang)) return lang;
  }
  return null;
}

/** Check redirects table for a matching path */
export async function checkRedirect(db: D1Database, tenantId: string, path: string): Promise<{ toPath: string; statusCode: number } | null> {
  const redirect = await db.prepare(
    'SELECT to_path, status_code FROM redirects WHERE tenant_id = ? AND from_path = ? LIMIT 1'
  ).bind(tenantId, path).first<{ to_path: string; status_code: number }>();

  if (!redirect) return null;
  return { toPath: redirect.to_path, statusCode: redirect.status_code };
}
