// Tenant Site — Type definitions

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
  ENVIRONMENT: string;
}

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  domain: string;
  isPrimary: boolean;
  planSlug: string;
  isWhiteLabel: boolean;
}

export interface SiteSettings {
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

export interface VideoItem {
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  channelName: string | null;
}

export interface LocaleConfig {
  enabledLocales: string[];
  defaultLocale: string;
}

export interface CategoryItem {
  slug: string;
  name: string;
  description: string;
  videoCount: number;
}

export interface PerformerItem {
  slug: string;
  name: string;
  bio: string;
  imageUrl: string | null;
  videoCount: number;
}

export interface TagItem {
  slug: string;
  name: string;
  videoCount: number;
}

export interface ChannelItem {
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  videoCount: number;
}

export interface PageItem {
  slug: string;
  title: string;
  content: string;
}

export interface RouteMatch {
  handler: string;
  params: Record<string, string>;
  locale?: string;
}

/** Cached tenant bundle — tenant + locale config + site settings in a single KV entry */
export interface TenantBundle {
  tenant: TenantInfo;
  localeConfig: LocaleConfig;
  settings: SiteSettings;
  /** Unix timestamp (ms) when this bundle was cached */
  cachedAt: number;
}
