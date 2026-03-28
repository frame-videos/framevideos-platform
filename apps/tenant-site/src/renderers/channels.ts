// Renderer — Channels listing & single channel page

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { VIDEOS_PER_PAGE } from '../constants.js';
import { getChannels, getChannelBySlug, getVideos } from '../db/content.js';
import { esc, videoGrid, pagination } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderChannelsPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, localeConfig: LocaleConfig): Promise<string> {
  const channels = await getChannels(db, tenant.tenantId, locale);
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  let content = `<h1 class="text-2xl font-bold mb-6">Canais</h1>`;

  if (channels.length === 0) {
    content += `<p class="text-gray-500 text-center py-16">Nenhum canal disponível</p>`;
  } else {
    content += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${channels.map((ch) => `<a href="${lp}/channel/${esc(ch.slug)}" class="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/30 transition-all group">
        <div class="aspect-video bg-gray-800 flex items-center justify-center">
          ${ch.logoUrl
            ? `<img src="${esc(ch.logoUrl)}" alt="${esc(ch.name)}" loading="lazy" class="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />`
            : `<svg class="w-12 h-12 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12zM9 10v8l7-4z"/></svg>`
          }
        </div>
        <div class="p-3">
          <p class="font-medium text-gray-200 text-sm truncate group-hover:text-purple-400 transition-colors">${esc(ch.name)}</p>
          <p class="text-xs text-gray-500">${ch.videoCount} vídeo${ch.videoCount !== 1 ? 's' : ''}</p>
        </div>
      </a>`).join('')}
    </div>`;
  }

  return layout(settings, {
    tenant,
    title: 'Canais',
    description: `Canais de vídeos em ${settings.siteName}`,
    canonical: `https://${tenant.domain}${lp}/channels`,
    content,
    activePath: '/channels',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: '/channels',
  });
}

export async function renderChannelPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, url: URL, localeConfig: LocaleConfig): Promise<string | null> {
  const channel = await getChannelBySlug(db, tenant.tenantId, locale, slug);
  if (!channel) return null;
  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * VIDEOS_PER_PAGE;
  const { videos, total } = await getVideos(db, tenant.tenantId, locale, { limit: VIDEOS_PER_PAGE, offset, channelSlug: slug });
  const totalPages = Math.ceil(total / VIDEOS_PER_PAGE);

  let content = `<div class="mb-6">
    <nav class="text-sm text-gray-500 mb-2"><a href="${lp}/channels" class="hover:text-gray-300">Canais</a> <span class="mx-1">›</span> <span class="text-gray-300">${esc(channel.name)}</span></nav>
    <div class="flex items-start gap-4">
      ${channel.logoUrl ? `<img src="${esc(channel.logoUrl)}" alt="${esc(channel.name)}" class="w-16 h-16 rounded-lg object-contain bg-gray-800 p-2 shrink-0" />` : ''}
      <div>
        <h1 class="text-2xl font-bold">${esc(channel.name)}</h1>
        ${channel.description ? `<p class="text-gray-400 text-sm mt-1">${esc(channel.description)}</p>` : ''}
        <p class="text-gray-500 text-sm mt-1">${total} vídeo${total !== 1 ? 's' : ''}</p>
      </div>
    </div>
  </div>`;
  content += videoGrid(videos, lp);
  content += pagination(page, totalPages, `${lp}/channel/${slug}`);

  return layout(settings, {
    title: channel.name,
    description: channel.description || `Vídeos do canal ${channel.name}`,
    canonical: `https://${tenant.domain}${lp}/channel/${slug}`,
    content,
    activePath: '/channels',
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: `/channel/${slug}`,
  });
}
