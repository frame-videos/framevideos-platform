// Tenant Site — Sitemap generators

import type { LocaleConfig } from '../types.js';
import { SITEMAP_MAX_URLS } from '../constants.js';
import { esc } from '../helpers/html.js';

function sitemapXmlHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
}

function sitemapUrl(loc: string, lastmod?: string, alternates?: Array<{ locale: string; href: string }>): string {
  let entry = `  <url>\n    <loc>${esc(loc)}</loc>\n`;
  if (lastmod) entry += `    <lastmod>${lastmod}</lastmod>\n`;
  if (alternates) {
    for (const alt of alternates) {
      entry += `    <xhtml:link rel="alternate" hreflang="${esc(alt.locale)}" href="${esc(alt.href)}" />\n`;
    }
  }
  entry += `  </url>\n`;
  return entry;
}

export async function generateSitemapIndex(hostname: string): Promise<string> {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://${esc(hostname)}/sitemap-videos.xml</loc></sitemap>
  <sitemap><loc>https://${esc(hostname)}/sitemap-categories.xml</loc></sitemap>
  <sitemap><loc>https://${esc(hostname)}/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`;
}

export async function generateVideoSitemap(db: D1Database, tenantId: string, hostname: string, localeConfig: LocaleConfig, pageNum: number): Promise<string> {
  const limit = SITEMAP_MAX_URLS;
  const offset = (pageNum - 1) * limit;

  const videos = await db.prepare(
    `SELECT v.slug, v.updated_at, v.created_at
     FROM videos v WHERE v.tenant_id = ? AND v.status = 'published'
     ORDER BY v.created_at DESC LIMIT ? OFFSET ?`
  ).bind(tenantId, limit, offset).all<{ slug: string; updated_at: string | null; created_at: string }>();

  let xml = sitemapXmlHeader();
  for (const v of videos.results) {
    const lastmod = (v.updated_at || v.created_at).split('T')[0] ?? '';
    for (const loc of localeConfig.enabledLocales) {
      const prefix = loc === localeConfig.defaultLocale ? '' : `/${loc}`;
      const urlStr = `https://${hostname}${prefix}/video/${v.slug}`;
      const alternates = localeConfig.enabledLocales.map((l) => ({
        locale: l,
        href: `https://${hostname}${l === localeConfig.defaultLocale ? '' : `/${l}`}/video/${v.slug}`,
      }));
      xml += sitemapUrl(urlStr, lastmod, alternates);
    }
  }
  xml += '</urlset>';
  return xml;
}

export async function generateCategorySitemap(db: D1Database, tenantId: string, hostname: string, localeConfig: LocaleConfig): Promise<string> {
  const categories = await db.prepare(
    'SELECT slug FROM categories WHERE tenant_id = ? AND is_active = 1 ORDER BY slug'
  ).bind(tenantId).all<{ slug: string }>();

  let xml = sitemapXmlHeader();
  for (const c of categories.results) {
    for (const loc of localeConfig.enabledLocales) {
      const prefix = loc === localeConfig.defaultLocale ? '' : `/${loc}`;
      const urlStr = `https://${hostname}${prefix}/category/${c.slug}`;
      const alternates = localeConfig.enabledLocales.map((l) => ({
        locale: l,
        href: `https://${hostname}${l === localeConfig.defaultLocale ? '' : `/${l}`}/category/${c.slug}`,
      }));
      xml += sitemapUrl(urlStr, undefined, alternates);
    }
  }
  xml += '</urlset>';
  return xml;
}

export async function generatePageSitemap(db: D1Database, tenantId: string, hostname: string, localeConfig: LocaleConfig): Promise<string> {
  const pages = await db.prepare(
    'SELECT slug, updated_at FROM pages WHERE tenant_id = ? AND is_published = 1 ORDER BY slug'
  ).bind(tenantId).all<{ slug: string; updated_at: string | null }>();

  let xml = sitemapXmlHeader();

  const staticPaths = ['/', '/videos', '/categories', '/performers', '/tags', '/channels'];
  for (const path of staticPaths) {
    for (const loc of localeConfig.enabledLocales) {
      const prefix = loc === localeConfig.defaultLocale ? '' : `/${loc}`;
      const urlStr = `https://${hostname}${prefix}${path === '/' ? '' : path}` || `https://${hostname}${prefix}/`;
      const alternates = localeConfig.enabledLocales.map((l) => ({
        locale: l,
        href: `https://${hostname}${l === localeConfig.defaultLocale ? '' : `/${l}`}${path === '/' ? '/' : path}`,
      }));
      xml += sitemapUrl(urlStr, undefined, alternates);
    }
  }

  for (const p of pages.results) {
    for (const loc of localeConfig.enabledLocales) {
      const prefix = loc === localeConfig.defaultLocale ? '' : `/${loc}`;
      const urlStr = `https://${hostname}${prefix}/pages/${p.slug}`;
      const alternates = localeConfig.enabledLocales.map((l) => ({
        locale: l,
        href: `https://${hostname}${l === localeConfig.defaultLocale ? '' : `/${l}`}/pages/${p.slug}`,
      }));
      xml += sitemapUrl(urlStr, p.updated_at?.split('T')[0], alternates);
    }
  }
  xml += '</urlset>';
  return xml;
}
