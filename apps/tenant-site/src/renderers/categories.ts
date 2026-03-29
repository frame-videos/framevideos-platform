// Renderer — Categories listing & single category page

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';
import { getCategories, getCategoryBySlug, getVideos } from '../db/content.js';
import { esc, videoGrid, pagination, firstThumbnailUrl } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderCategoriesPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, localeConfig: LocaleConfig): Promise<string> {
  const categories = await getCategories(db, tenant.tenantId, locale);
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  let content = `<h1 class="text-2xl font-bold mb-6">Categorias</h1>`;

  if (categories.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhuma categoria disponível</p>`;
  } else {
    content += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${categories.map((c) => `<a href="${lp}/category/${esc(c.slug)}" class="bg-gray-900 rounded-lg p-5 text-center hover:bg-gray-800 hover:ring-1 hover:ring-purple-500/30 transition-all group">
        <p class="font-medium text-gray-200 group-hover:text-purple-400 transition-colors">${esc(c.name)}</p>
        <p class="text-sm text-gray-500 mt-1">${c.videoCount} vídeo${c.videoCount !== 1 ? 's' : ''}</p>
        ${c.description ? `<p class="text-xs text-gray-600 mt-2 line-clamp-2">${esc(c.description)}</p>` : ''}
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    tenant,
    title: 'Categorias',
    description: `Categorias de vídeos em ${settings.siteName}`,
    canonical: `https://${tenant.domain}${lp}/categories`,
    content,
    activePath: '/categories',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: '/categories',
  });
}

export async function renderCategoryPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL, localeConfig: LocaleConfig): Promise<string | null> {
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;

  // Paralelizar: ambas as queries são independentes (se category não existe, getVideos retorna vazio)
  const [category, { videos, total }] = await Promise.all([
    getCategoryBySlug(db, tenant.tenantId, locale, slug),
    getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, categorySlug: slug }),
  ]);
  if (!category) return null;
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  const breadcrumbLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: settings.siteName, item: `https://${tenant.domain}${lp}/` },
      { '@type': 'ListItem', position: 2, name: 'Categorias', item: `https://${tenant.domain}${lp}/categories` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `https://${tenant.domain}${lp}/category/${slug}` },
    ],
  });

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="${lp}/categories" class="hover:text-gray-300">Categorias</a> <span class="mx-1">›</span> <span class="text-gray-300">${esc(category.name)}</span></nav>
    <h1 class="text-2xl font-bold">${esc(category.name)}</h1>
    ${category.description ? `<p class="text-gray-400 text-sm mt-1">${esc(category.description)}</p>` : ''}
    <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
  </div>`;
  content += videoGrid(videos, lp);
  content += pagination(page, totalPages, `${lp}/category/${slug}`);

  return layout(settings, {
    tenant,
    title: category.name,
    description: category.description || `Vídeos da categoria ${category.name}`,
    canonical: `https://${tenant.domain}${lp}/category/${slug}`,
    content,
    activePath: '/categories',
    jsonLd: breadcrumbLd,
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: `/category/${slug}`,
    lcpImage: firstThumbnailUrl(videos),
  });
}
