// Renderer — Tags listing & single tag page

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';
import { getTags, getTagBySlug, getVideos } from '../db/content.js';
import { esc, videoGrid, pagination, firstThumbnailUrl } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderTagsPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, localeConfig: LocaleConfig): Promise<string> {
  const tags = await getTags(db, tenant.tenantId, locale);
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  let content = `<h1 class="text-2xl font-bold mb-6">Tags</h1>`;

  if (tags.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhuma tag disponível</p>`;
  } else {
    content += `<div class="flex flex-wrap gap-2">
      ${tags.map((t) => `<a href="${lp}/tag/${esc(t.slug)}" class="bg-gray-900 px-4 py-2 rounded-lg text-sm hover:bg-gray-800 hover:text-purple-400 transition-colors">
        <span class="text-gray-400">#</span>${esc(t.name)}
        <span class="text-xs text-gray-600 ml-1">(${t.videoCount})</span>
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    tenant,
    title: 'Tags',
    description: `Tags de vídeos em ${settings.siteName}`,
    canonical: `https://${tenant.domain}${lp}/tags`,
    content,
    activePath: '/tags',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: '/tags',
  });
}

export async function renderTagPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL, localeConfig: LocaleConfig): Promise<string | null> {
  const tag = await getTagBySlug(db, tenant.tenantId, locale, slug);
  if (!tag) return null;
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, tagSlug: slug });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="${lp}/tags" class="hover:text-gray-300">Tags</a> <span class="mx-1">›</span> <span class="text-gray-300">#${esc(tag.name)}</span></nav>
    <h1 class="text-2xl font-bold">#${esc(tag.name)}</h1>
    <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
  </div>`;
  content += videoGrid(videos, lp);
  content += pagination(page, totalPages, `${lp}/tag/${slug}`);

  return layout(settings, {
    tenant,
    title: `#${tag.name}`,
    description: `Vídeos com a tag ${tag.name}`,
    canonical: `https://${tenant.domain}${lp}/tag/${slug}`,
    content,
    activePath: '/tags',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: `/tag/${slug}`,
    lcpImage: firstThumbnailUrl(videos),
  });
}
