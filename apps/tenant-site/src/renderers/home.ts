// Renderer — Homepage

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { getHomepageDataBatched } from '../db/content.js';
import { esc, videoGrid, firstThumbnailUrl } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderHomepage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, localeConfig: LocaleConfig): Promise<string> {
  // Single db.batch() call — 4 queries in 1 D1 round-trip (~200ms instead of ~800ms)
  const { videos: recentVideos, categories, performers } = await getHomepageDataBatched(db, tenant.tenantId, locale);
  const featuredPerformers = performers.slice(0, 8);
  const topCategories = categories.filter((c) => c.videoCount > 0).slice(0, 12);
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  let content = '';

  content += `<section class="mb-8">
    <h1 class="text-2xl md:text-3xl font-bold mb-2">${esc(settings.siteName)}</h1>
    <p class="text-gray-400">Os melhores vídeos, atualizados diariamente</p>
  </section>`;

  content += `<section class="mb-10">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Vídeos Recentes</h2>
      <a href="${lp}/videos" class="text-sm text-purple-400 hover:text-purple-300">Ver todos →</a>
    </div>
    ${videoGrid(recentVideos, lp)}
  </section>`;

  if (topCategories.length > 0) {
    content += `<section class="mb-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Categorias Populares</h2>
        <a href="${lp}/categories" class="text-sm text-purple-400 hover:text-purple-300">Ver todas →</a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        ${topCategories.map((c) => `<a href="${lp}/category/${esc(c.slug)}" class="bg-gray-900 rounded-lg p-4 text-center hover:bg-gray-800 hover:ring-1 hover:ring-purple-500/30 transition-all">
          <p class="font-medium text-gray-200 text-sm">${esc(c.name)}</p>
          <p class="text-xs text-gray-400 mt-1">${c.videoCount} vídeos</p>
        </a>`).join('')}
      </div>
    </section>`;
  }

  if (featuredPerformers.length > 0) {
    content += `<section class="mb-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Modelos em Destaque</h2>
        <a href="${lp}/performers" class="text-sm text-purple-400 hover:text-purple-300">Ver todos →</a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        ${featuredPerformers.map((p) => `<a href="${lp}/performer/${esc(p.slug)}" class="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/30 transition-all group">
          <div class="aspect-square bg-gray-800 flex items-center justify-center">
            ${p.imageUrl
              ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy" width="200" height="200" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />`
              : `<svg class="w-16 h-16 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
            }
          </div>
          <div class="p-3">
            <p class="font-medium text-gray-200 text-sm truncate">${esc(p.name)}</p>
            <p class="text-xs text-gray-400">${p.videoCount} vídeos</p>
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
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `https://${tenant.domain}${lp}/videos?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });

  return layout(settings, {
    tenant,
    title: settings.siteName,
    description: `${settings.siteName} — Os melhores vídeos, atualizados diariamente`,
    canonical: `https://${tenant.domain}${lp}/`,
    ogUrl: `https://${tenant.domain}${lp}/`,
    content,
    activePath: '/',
    jsonLd,
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: '/',
    lcpImage: firstThumbnailUrl(recentVideos),
  });
}
