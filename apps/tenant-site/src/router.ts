// Tenant Site — Route matching

import type { RouteMatch } from './types.js';
import { SUPPORTED_LOCALES } from './constants.js';

export function matchRoute(pathname: string): RouteMatch {
  let path = pathname;
  let detectedLocale: string | undefined;

  const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (localeMatch && (SUPPORTED_LOCALES as readonly string[]).includes(localeMatch[1]!)) {
    detectedLocale = localeMatch[1]!;
    path = localeMatch[2] || '/';
  }

  // Exact matches
  if (path === '/' || path === '') return { handler: 'home', params: {}, locale: detectedLocale };
  if (path === '/videos') return { handler: 'videos', params: {}, locale: detectedLocale };
  if (path === '/search') return { handler: 'search', params: {}, locale: detectedLocale };
  if (path === '/categories') return { handler: 'categories', params: {}, locale: detectedLocale };
  if (path === '/performers') return { handler: 'performers', params: {}, locale: detectedLocale };
  if (path === '/tags') return { handler: 'tags', params: {}, locale: detectedLocale };
  if (path === '/channels') return { handler: 'channels', params: {}, locale: detectedLocale };

  // Auth routes
  if (path === '/login') return { handler: 'auth-login', params: {}, locale: detectedLocale };
  if (path === '/signup') return { handler: 'auth-signup', params: {}, locale: detectedLocale };
  if (path === '/forgot-password') return { handler: 'auth-forgot', params: {}, locale: detectedLocale };
  if (path === '/reset-password') return { handler: 'auth-reset', params: {}, locale: detectedLocale };

  // Advertiser portal routes
  if (path === '/advertiser/login') return { handler: 'advertiser-login', params: {}, locale: detectedLocale };
  if (path === '/advertiser/dashboard') return { handler: 'advertiser-dashboard', params: {}, locale: detectedLocale };
  if (path === '/advertiser/campaigns') return { handler: 'advertiser-campaigns', params: {}, locale: detectedLocale };
  if (path === '/advertiser/reports') return { handler: 'advertiser-reports', params: {}, locale: detectedLocale };

  // Parameterized routes
  const videoMatch = path.match(/^\/video\/([^/]+)$/);
  if (videoMatch) return { handler: 'video', params: { slug: videoMatch[1]! }, locale: detectedLocale };

  const categoryMatch = path.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) return { handler: 'category', params: { slug: categoryMatch[1]! }, locale: detectedLocale };

  const performerMatch = path.match(/^\/performer\/([^/]+)$/);
  if (performerMatch) return { handler: 'performer', params: { slug: performerMatch[1]! }, locale: detectedLocale };

  const tagMatch = path.match(/^\/tag\/([^/]+)$/);
  if (tagMatch) return { handler: 'tag', params: { slug: tagMatch[1]! }, locale: detectedLocale };

  const channelMatch = path.match(/^\/channel\/([^/]+)$/);
  if (channelMatch) return { handler: 'channel', params: { slug: channelMatch[1]! }, locale: detectedLocale };

  const pageMatch = path.match(/^\/pages\/([^/]+)$/);
  if (pageMatch) return { handler: 'page', params: { slug: pageMatch[1]! }, locale: detectedLocale };

  // Common static page shortcuts: /about → /pages/about, /terms → /pages/terms, etc.
  const staticSlugs = ['about', 'terms', 'privacy', 'dmca', 'contact', 'faq', 'help'];
  if (staticSlugs.includes(path.slice(1))) {
    return { handler: 'page', params: { slug: path.slice(1) }, locale: detectedLocale };
  }

  return { handler: '404', params: {} };
}
