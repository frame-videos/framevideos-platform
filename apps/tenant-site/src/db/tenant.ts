// Tenant Site — Domain resolution & tenant data access
// Optimized: combined queries, unified KV cache bundle, batch operations

import type { TenantInfo, SiteSettings, LocaleConfig, TenantBundle } from '../types.js';
import { CACHE_TTL_SECONDS, RESERVED_SUBDOMAINS } from '../constants.js';

// ─── Unified Tenant Bundle (tenant + locale + settings in 1 KV entry) ────────

/**
 * Resolves tenant AND loads locale config + site settings in minimal D1 round-trips.
 * 
 * Cache layers:
 * 1. KV bundle cache (tenant + locale + settings) — 1 read, 0 D1
 * 2. D1 batch (resolve + configs in 1 round-trip) — 1 batch call
 * 
 * Returns null if tenant not found.
 */
export async function resolveTenantBundle(
  hostname: string,
  db: D1Database,
  cache: KVNamespace,
): Promise<TenantBundle | null> {
  const bundleKey = `bundle:${hostname}`;

  // ── Layer 1: KV bundle cache ──
  const cachedBundle = await cache.get(bundleKey);
  if (cachedBundle) {
    if (cachedBundle === '__404__') return null;
    try {
      return JSON.parse(cachedBundle) as TenantBundle;
    } catch { /* fall through */ }
  }

  // ── Layer 2: D1 — resolve tenant with plan in 1 query ──
  const tenant = await resolveTenantFromD1(hostname, db);

  if (!tenant) {
    // Cache negative result for 60s
    await cache.put(bundleKey, '__404__', { expirationTtl: 60 }).catch(() => {});
    return null;
  }

  // ── Load locale config + site settings in 1 batch (1 round-trip) ──
  const [localeConfig, settings] = await getTenantConfigsBatched(db, tenant.tenantId, tenant.tenantName);

  const bundle: TenantBundle = {
    tenant,
    localeConfig,
    settings,
    cachedAt: Date.now(),
  };

  // Write bundle to KV (non-blocking if called from waitUntil context)
  await cache.put(bundleKey, JSON.stringify(bundle), { expirationTtl: CACHE_TTL_SECONDS }).catch(() => {});

  return bundle;
}

// ─── D1 Tenant Resolution (optimized: 1 query with JOIN) ────────────────────

async function resolveTenantFromD1(
  hostname: string,
  db: D1Database,
): Promise<TenantInfo | null> {
  if (hostname.endsWith('.framevideos.com')) {
    const slug = hostname.replace('.framevideos.com', '');
    if (RESERVED_SUBDOMAINS.has(slug) || slug === 'framevideos') {
      return null;
    }

    // Single query: tenant + plan via LEFT JOIN (was 2 sequential queries)
    const result = await db
      .prepare(
        `SELECT t.id, t.name, t.slug,
                COALESCE(p.slug, 'free') as plan_slug
         FROM tenants t
         LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing')
         LEFT JOIN plans p ON p.id = s.plan_id
         WHERE t.slug = ? AND t.status IN ('active', 'trial')
         LIMIT 1`
      )
      .bind(slug)
      .first<{ id: string; name: string; slug: string; plan_slug: string }>();

    if (!result) return null;

    return {
      tenantId: result.id,
      tenantName: result.name,
      tenantSlug: result.slug,
      domain: hostname,
      isPrimary: false,
      planSlug: result.plan_slug,
      isWhiteLabel: result.plan_slug === 'enterprise',
    };
  }

  // Custom domain: single query with JOIN (was 2 sequential queries)
  const result = await db
    .prepare(
      `SELECT d.tenant_id, d.domain, d.is_primary, t.name, t.slug,
              COALESCE(p.slug, 'free') as plan_slug
       FROM domains d
       JOIN tenants t ON t.id = d.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing')
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE d.domain = ? AND d.status = 'active' AND t.status IN ('active', 'trial')
       LIMIT 1`
    )
    .bind(hostname)
    .first<{ tenant_id: string; domain: string; is_primary: number; name: string; slug: string; plan_slug: string }>();

  if (!result) return null;

  return {
    tenantId: result.tenant_id,
    tenantName: result.name,
    tenantSlug: result.slug,
    domain: result.domain,
    isPrimary: result.is_primary === 1,
    planSlug: result.plan_slug,
    isWhiteLabel: result.plan_slug === 'enterprise',
  };
}

// ─── Batched Config Loading (locale + settings in 1 D1 batch) ────────────────

async function getTenantConfigsBatched(
  db: D1Database,
  tenantId: string,
  tenantName: string,
): Promise<[LocaleConfig, SiteSettings]> {
  // Use db.batch() to run both queries in a single round-trip
  const [configsResult, tenantFallbackResult] = await db.batch([
    db.prepare('SELECT config_key, config_value FROM tenant_configs WHERE tenant_id = ?').bind(tenantId),
    db.prepare('SELECT default_locale FROM tenants WHERE id = ?').bind(tenantId),
  ]);

  const configs = (configsResult as D1Result<{ config_key: string; config_value: string }>).results;
  const tenantRow = (tenantFallbackResult as D1Result<{ default_locale: string }>).results[0];

  // Parse all configs into a map
  const s: Record<string, string> = {};
  for (const c of configs) {
    s[c.config_key] = c.config_value;
  }

  // ── Build LocaleConfig ──
  let defaultLocale = s['default_locale'] ?? tenantRow?.default_locale ?? 'pt';
  let enabledLocales: string[] = [];
  if (s['enabled_locales']) {
    try { enabledLocales = JSON.parse(s['enabled_locales']); } catch { /* ignore */ }
  }
  if (enabledLocales.length === 0) enabledLocales = [defaultLocale];

  const localeConfig: LocaleConfig = { defaultLocale, enabledLocales };

  // ── Build SiteSettings ──
  const settings: SiteSettings = {
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

  return [localeConfig, settings];
}

// ─── Legacy API (backward compatibility for imports) ─────────────────────────

/**
 * @deprecated Use resolveTenantBundle() instead. Kept for backward compatibility.
 */
export async function resolveTenant(
  hostname: string,
  db: D1Database,
  cache: KVNamespace,
): Promise<TenantInfo | null> {
  const bundle = await resolveTenantBundle(hostname, db, cache);
  return bundle?.tenant ?? null;
}

/**
 * @deprecated Use resolveTenantBundle() instead. Kept for backward compatibility.
 */
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

/**
 * @deprecated Use resolveTenantBundle() instead. Kept for backward compatibility.
 */
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

/**
 * @deprecated Use resolveTenantBundle() instead. Kept for backward compatibility.
 */
export async function getTenantLocale(db: D1Database, tenantId: string): Promise<string> {
  const config = await getTenantLocaleConfig(db, tenantId);
  return config.defaultLocale;
}

/**
 * @deprecated Use resolveTenantBundle() instead. Kept for backward compatibility.
 */
export async function getTenantLocaleConfig(db: D1Database, tenantId: string): Promise<LocaleConfig> {
  const configs = await db.prepare(
    "SELECT config_key, config_value FROM tenant_configs WHERE tenant_id = ? AND config_key IN ('default_locale', 'enabled_locales')"
  ).bind(tenantId).all<{ config_key: string; config_value: string }>();

  let defaultLocale = 'pt';
  let enabledLocales: string[] = [];
  let foundInConfigs = false;

  for (const cfg of configs.results) {
    if (cfg.config_key === 'default_locale') { defaultLocale = cfg.config_value; foundInConfigs = true; }
    if (cfg.config_key === 'enabled_locales') {
      try { enabledLocales = JSON.parse(cfg.config_value); } catch { /* ignore */ }
    }
  }

  if (!foundInConfigs) {
    const tenant = await db.prepare(
      'SELECT default_locale FROM tenants WHERE id = ?'
    ).bind(tenantId).first<{ default_locale: string }>();
    if (tenant?.default_locale) defaultLocale = tenant.default_locale;
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
