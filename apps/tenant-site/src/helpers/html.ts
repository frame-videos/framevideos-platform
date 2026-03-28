// Tenant Site — HTML helper utilities

import type { VideoItem } from '../types.js';

export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function videoCard(v: VideoItem, localePrefix = ''): string {
  const dur = formatDuration(v.durationSeconds);
  const views = formatViews(v.viewCount);
  return `<a href="${localePrefix}/video/${esc(v.slug)}" class="group block bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/50 transition-all">
  <div class="relative aspect-video bg-gray-800">
    ${v.thumbnailUrl
      ? `<img src="${esc(v.thumbnailUrl)}" alt="${esc(v.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />`
      : `<div class="w-full h-full flex items-center justify-center text-gray-600"><svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>`
    }
    ${dur ? `<span class="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">${dur}</span>` : ''}
  </div>
  <div class="p-3">
    <h3 class="text-sm font-medium text-gray-100 line-clamp-2 group-hover:text-purple-400 transition-colors">${esc(v.title || 'Sem título')}</h3>
    <p class="text-xs text-gray-500 mt-1">${v.channelName ? esc(v.channelName) + ' • ' : ''}${views} visualizações</p>
  </div>
</a>`;
}

export function videoGrid(videos: VideoItem[], localePrefix = ''): string {
  if (videos.length === 0) {
    return `<div class="text-center py-16 text-gray-500">
      <svg class="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
      <p class="text-lg">Nenhum vídeo encontrado</p>
    </div>`;
  }
  return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">${videos.map((v) => videoCard(v, localePrefix)).join('')}</div>`;
}

export function pagination(page: number, totalPages: number, baseUrl: string): string {
  if (totalPages <= 1) return '';
  const pages: string[] = [];
  const maxVisible = 7;

  let start = Math.max(1, page - 3);
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (page > 1) {
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page - 1}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">←</a>`);
  }

  if (start > 1) {
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=1" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">1</a>`);
    if (start > 2) pages.push(`<span class="px-2 py-2 text-gray-600">…</span>`);
  }

  for (let i = start; i <= end; i++) {
    if (i === page) {
      pages.push(`<span class="px-3 py-2 rounded bg-purple-600 text-white font-medium">${i}</span>`);
    } else {
      pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${i}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">${i}</a>`);
    }
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push(`<span class="px-2 py-2 text-gray-600">…</span>`);
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${totalPages}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">${totalPages}</a>`);
  }

  if (page < totalPages) {
    pages.push(`<a href="${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page + 1}" class="px-3 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">→</a>`);
  }

  return `<nav class="flex items-center justify-center gap-1 mt-8">${pages.join('')}</nav>`;
}
