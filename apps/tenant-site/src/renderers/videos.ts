// Renderer — Videos listing & single video page

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';
import { getVideos, getVideoBySlug } from '../db/content.js';
import { esc, formatDuration, formatViews, videoGrid, pagination } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderVideosPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, url: URL, localeConfig: LocaleConfig): Promise<string> {
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const search = url.searchParams.get('search') ?? undefined;
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, search });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <h1 class="text-2xl font-bold">${search ? `Resultados para "${esc(search)}"` : 'Todos os Vídeos'}</h1>
    <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}</p>
  </div>`;

  content += videoGrid(videos, lp);
  content += pagination(page, totalPages, search ? `${lp}/videos?search=${encodeURIComponent(search)}` : `${lp}/videos`);

  return layout(settings, {
    tenant,
    title: search ? `Busca: ${search}` : 'Vídeos',
    description: search ? `Resultados da busca por "${search}"` : `Todos os vídeos de ${settings.siteName}`,
    canonical: `https://${tenant.domain}${lp}/videos`,
    content,
    activePath: '/videos',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: '/videos',
  });
}

export async function renderVideoPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, localeConfig: LocaleConfig): Promise<string | null> {
  const video = await getVideoBySlug(db, tenant.tenantId, locale, slug);
  if (!video) return null;

  // Increment view (fire-and-forget)
  db.prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').bind(video.id).run();

  const dur = formatDuration(video.duration_seconds);
  const views = formatViews(video.view_count);
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  let playerHtml = '';
  if (video.embed_url) {
    playerHtml = `<div class="relative aspect-video bg-black rounded-xl overflow-hidden mb-4 shadow-2xl shadow-black/50 ring-1 ring-gray-800">
      <iframe src="${esc(video.embed_url)}" class="absolute inset-0 w-full h-full" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture" frameborder="0" loading="lazy"></iframe>
    </div>`;
  } else if (video.video_url) {
    playerHtml = `<div class="relative aspect-video bg-black rounded-xl overflow-hidden mb-4 shadow-2xl shadow-black/50 ring-1 ring-gray-800">
      <video src="${esc(video.video_url)}" class="absolute inset-0 w-full h-full" controls playsinline preload="metadata" ${video.thumbnail_url ? `poster="${esc(video.thumbnail_url)}"` : ''}></video>
    </div>`;
  } else if (video.thumbnail_url) {
    playerHtml = `<div class="relative aspect-video bg-black rounded-xl overflow-hidden mb-4 shadow-2xl shadow-black/50 ring-1 ring-gray-800 flex items-center justify-center">
      <img src="${esc(video.thumbnail_url)}" alt="${esc(video.title)}" class="max-w-full max-h-full object-contain" />
      <div class="absolute inset-0 flex items-center justify-center bg-black/30">
        <div class="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
          <svg class="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </div>`;
  }

  let content = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2">
      ${playerHtml}
      <h1 class="text-xl md:text-2xl font-bold mb-2">${esc(video.title)}</h1>
      <div class="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-4">
        ${video.channel ? `<a href="${lp}/channel/${esc(video.channel.slug)}" class="hover:text-purple-400">${esc(video.channel.name)}</a><span>•</span>` : ''}
        <span>${views} visualizações</span>
        ${dur ? `<span>•</span><span>${dur}</span>` : ''}
        ${video.published_at ? `<span>•</span><span>${new Date(video.published_at).toLocaleDateString('pt-BR')}</span>` : ''}
      </div>

      ${video.description ? `<div class="bg-gray-900 rounded-lg p-4 mb-4">
        <p class="text-gray-300 text-sm whitespace-pre-line">${esc(video.description)}</p>
      </div>` : ''}

      ${video.performers.length > 0 ? `<div class="mb-4">
        <h3 class="text-sm font-medium text-gray-400 mb-2">Modelos</h3>
        <div class="flex flex-wrap gap-2">
          ${video.performers.map((p) => `<a href="${lp}/performer/${esc(p.slug)}" class="flex items-center gap-2 bg-gray-900 rounded-full px-3 py-1.5 text-sm hover:bg-gray-800 transition-colors">
            ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" class="w-6 h-6 rounded-full object-cover" />` : ''}
            <span>${esc(p.name)}</span>
          </a>`).join('')}
        </div>
      </div>` : ''}

      ${video.categories.length > 0 ? `<div class="mb-4">
        <h3 class="text-sm font-medium text-gray-400 mb-2">Categorias</h3>
        <div class="flex flex-wrap gap-2">
          ${video.categories.map((c) => `<a href="${lp}/category/${esc(c.slug)}" class="bg-purple-900/30 text-purple-300 text-xs px-3 py-1 rounded-full hover:bg-purple-900/50 transition-colors">${esc(c.name)}</a>`).join('')}
        </div>
      </div>` : ''}

      ${video.tags.length > 0 ? `<div class="mb-4">
        <h3 class="text-sm font-medium text-gray-400 mb-2">Tags</h3>
        <div class="flex flex-wrap gap-2">
          ${video.tags.map((t) => `<a href="${lp}/tag/${esc(t.slug)}" class="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded hover:bg-gray-700 hover:text-gray-200 transition-colors">#${esc(t.name)}</a>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <div>
      <h2 class="text-lg font-semibold mb-4">Vídeos Relacionados</h2>
      <div class="flex flex-col gap-3">
        ${video.related.map((r) => `<a href="${lp}/video/${esc(r.slug)}" class="flex gap-3 group">
          <div class="relative w-40 shrink-0 aspect-video bg-gray-800 rounded overflow-hidden">
            ${r.thumbnailUrl ? `<img src="${esc(r.thumbnailUrl)}" alt="${esc(r.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />` : ''}
            ${r.durationSeconds ? `<span class="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded font-mono">${formatDuration(r.durationSeconds)}</span>` : ''}
          </div>
          <div class="min-w-0">
            <h3 class="text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-purple-400 transition-colors">${esc(r.title)}</h3>
            <p class="text-xs text-gray-500 mt-1">${r.channelName ? esc(r.channelName) : ''}</p>
            <p class="text-xs text-gray-500">${formatViews(r.viewCount)} visualizações</p>
          </div>
        </a>`).join('')}
        ${video.related.length === 0 ? '<p class="text-gray-600 text-sm">Nenhum vídeo relacionado</p>' : ''}
      </div>
    </div>
  </div>`;

  const seoTitle = video.seo_title || video.title;
  const seoDesc = video.seo_description || video.description || video.title;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description || video.title,
    thumbnailUrl: video.thumbnail_url ? [video.thumbnail_url] : undefined,
    uploadDate: video.published_at || video.created_at,
    duration: video.duration_seconds ? `PT${Math.floor(video.duration_seconds / 3600)}H${Math.floor((video.duration_seconds % 3600) / 60)}M${video.duration_seconds % 60}S` : undefined,
    contentUrl: video.video_url || undefined,
    embedUrl: video.embed_url || undefined,
    inLanguage: locale,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/WatchAction',
      userInteractionCount: video.view_count,
    },
  });

  return layout(settings, {
    tenant,
    title: seoTitle,
    description: seoDesc,
    canonical: `https://${tenant.domain}${lp}/video/${slug}`,
    ogType: 'video.other',
    ogUrl: `https://${tenant.domain}${lp}/video/${slug}`,
    ogImage: video.thumbnail_url ?? undefined,
    content,
    activePath: '/videos',
    jsonLd,
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: `/video/${slug}`,
  });
}
