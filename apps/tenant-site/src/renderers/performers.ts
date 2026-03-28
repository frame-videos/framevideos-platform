// Renderer — Performers listing & single performer page

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';
import { getPerformers, getPerformerBySlug, getVideos } from '../db/content.js';
import { esc, videoGrid, pagination, firstThumbnailUrl } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderPerformersPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, localeConfig: LocaleConfig): Promise<string> {
  const performers = await getPerformers(db, tenant.tenantId, locale);
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  let content = `<h1 class="text-2xl font-bold mb-6">Modelos</h1>`;

  if (performers.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhum modelo disponível</p>`;
  } else {
    content += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${performers.map((p) => `<a href="${lp}/performer/${esc(p.slug)}" class="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/30 transition-all group">
        <div class="aspect-square bg-gray-800 flex items-center justify-center">
          ${p.imageUrl
            ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy" width="200" height="200" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />`
            : `<svg class="w-16 h-16 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
          }
        </div>
        <div class="p-3">
          <p class="font-medium text-gray-200 text-sm truncate group-hover:text-purple-400 transition-colors">${esc(p.name)}</p>
          <p class="text-xs text-gray-500">${p.videoCount} vídeo${p.videoCount !== 1 ? 's' : ''}</p>
        </div>
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    tenant,
    title: 'Modelos',
    description: `Modelos e performers em ${settings.siteName}`,
    canonical: `https://${tenant.domain}${lp}/performers`,
    content,
    activePath: '/performers',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: '/performers',
  });
}

export async function renderPerformerPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL, localeConfig: LocaleConfig): Promise<string | null> {
  const performer = await getPerformerBySlug(db, tenant.tenantId, locale, slug);
  if (!performer) return null;
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, performerSlug: slug });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="${lp}/performers" class="hover:text-gray-300">Modelos</a> <span class="mx-1">›</span> <span class="text-gray-300">${esc(performer.name)}</span></nav>
    <div class="flex items-start gap-4">
      ${performer.imageUrl ? `<img src="${esc(performer.imageUrl)}" alt="${esc(performer.name)}" width="80" height="80" class="w-20 h-20 rounded-full object-cover shrink-0" />` : ''}
      <div>
        <h1 class="text-2xl font-bold">${esc(performer.name)}</h1>
        ${performer.bio ? `<p class="text-gray-400 text-sm mt-1">${esc(performer.bio)}</p>` : ''}
        <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
      </div>
    </div>
  </div>`;
  content += videoGrid(videos, lp);
  content += pagination(page, totalPages, `${lp}/performer/${slug}`);

  return layout(settings, {
    tenant,
    title: performer.name,
    description: performer.bio || `Vídeos de ${performer.name}`,
    canonical: `https://${tenant.domain}${lp}/performer/${slug}`,
    ogImage: performer.imageUrl ?? undefined,
    content,
    activePath: '/performers',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: `/performer/${slug}`,
    lcpImage: firstThumbnailUrl(videos),
  });
}
