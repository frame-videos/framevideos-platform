// Tenant Site — Constants

export const SUPPORTED_LOCALES = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ru', 'nl', 'pl', 'tr', 'ar'] as const;

export const LOCALE_LABELS: Record<string, string> = {
  pt: 'Português', en: 'English', es: 'Español', fr: 'Français',
  de: 'Deutsch', it: 'Italiano', ja: '日本語', zh: '中文',
  ko: '한국어', ru: 'Русский', nl: 'Nederlands', pl: 'Polski',
  tr: 'Türkçe', ar: 'العربية',
};

export const CACHE_TTL_SECONDS = 300;
export const VIDEOS_PER_PAGE = 24;

export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'sites', 'mail', 'smtp', 'imap',
  'pop', 'ftp', 'cdn', 'static', 'assets', 'staging', 'dev', 'test',
]);

export const SITEMAP_MAX_URLS = 50000;
// Sprint 10 — force deploy 2026-03-28T12:45:00Z
