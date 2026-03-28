// Renderer — Search page

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';
import { getVideos, getTags } from '../db/content.js';
import { esc, videoGrid, pagination, firstThumbnailUrl } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderSearchPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, url: URL, localeConfig: LocaleConfig): Promise<string> {
  const query = url.searchParams.get('q') ?? url.searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  let content = '';
  let lcpImage: string | undefined;

  content += `<section class="mb-8">
    <h1 class="text-2xl font-bold mb-4">${query ? `Resultados para "${esc(query)}"` : 'Buscar Vídeos'}</h1>
    <form action="${lp}/search" method="GET" class="max-w-2xl">
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
    lcpImage = firstThumbnailUrl(videos);

    content += `<p class="text-gray-500 text-sm mb-4">${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}</p>`;
    content += videoGrid(videos, lp);
    content += pagination(page, totalPages, `${lp}/search?q=${encodeURIComponent(query)}`);
  } else {
    const tags = await getTags(db, tenant.tenantId, locale);
    const topTags = tags.slice(0, 30);

    if (topTags.length > 0) {
      content += `<section class="mt-8">
        <h2 class="text-lg font-semibold mb-4 text-gray-300">Tags Populares</h2>
        <div class="flex flex-wrap gap-2">
          ${topTags.map((t) => `<a href="${lp}/search?q=${encodeURIComponent(t.name)}" class="bg-gray-900 px-4 py-2 rounded-lg text-sm hover:bg-gray-800 hover:text-purple-400 transition-colors">
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
    canonical: `https://${tenant.domain}${lp}/search`,
    content,
    activePath: '/search',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: '/search',
    lcpImage,
  });
}
