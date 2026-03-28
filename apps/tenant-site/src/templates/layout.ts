// Tenant Site — Main HTML layout template

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { LOCALE_LABELS } from '../constants.js';
import { esc } from '../helpers/html.js';

export interface LayoutOptions {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  jsonLd?: string;
  content: string;
  activePath?: string;
  locale?: string;
  localeConfig?: LocaleConfig;
  domain?: string;
  currentPath?: string;
  hreflangPaths?: Record<string, string>;
  tenant?: TenantInfo | null;
}

export function layout(settings: SiteSettings, opts: LayoutOptions): string {
  const pageTitle = opts.title === settings.siteName ? settings.siteName : `${opts.title} — ${settings.siteName}`;
  const desc = opts.description ?? `${settings.siteName} — O melhor conteúdo em vídeo`;
  const active = opts.activePath ?? '/';
  const locale = opts.locale ?? 'pt';
  const localeConfig = opts.localeConfig;
  const domain = opts.domain ?? '';

  // Build hreflang tags
  let hreflangTags = '';
  if (localeConfig && localeConfig.enabledLocales.length > 1 && domain) {
    const paths = opts.hreflangPaths ?? {};
    for (const loc of localeConfig.enabledLocales) {
      const localePath = paths[loc] ?? (loc === localeConfig.defaultLocale ? (opts.currentPath ?? '/') : `/${loc}${opts.currentPath ?? '/'}`);
      hreflangTags += `\n  <link rel="alternate" hreflang="${esc(loc)}" href="https://${esc(domain)}${esc(localePath)}">`;
    }
    const defaultPath = paths[localeConfig.defaultLocale] ?? (opts.currentPath ?? '/');
    hreflangTags += `\n  <link rel="alternate" hreflang="x-default" href="https://${esc(domain)}${esc(defaultPath)}">`;
  }

  // Locale prefix for nav links
  const lp = localeConfig && locale !== localeConfig.defaultLocale ? `/${locale}` : '';

  const navLink = (href: string, label: string) => {
    const fullHref = `${lp}${href}`;
    const isActive = active === href || (href !== '/' && active.startsWith(href));
    return `<a href="${fullHref}" class="px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-purple-400 bg-gray-800' : 'text-gray-300 hover:text-white hover:bg-gray-800'}">${label}</a>`;
  };

  // Locale switcher
  let localeSwitcher = '';
  if (localeConfig && localeConfig.enabledLocales.length > 1) {
    const currentPath = opts.currentPath ?? '/';
    const options = localeConfig.enabledLocales.map((loc) => {
      const prefix = loc === localeConfig.defaultLocale ? '' : `/${loc}`;
      const href = `${prefix}${currentPath}`;
      return `<a href="${esc(href)}" class="block px-3 py-1.5 text-sm ${loc === locale ? 'text-purple-400 font-medium' : 'text-gray-400 hover:text-white'} hover:bg-gray-800 rounded transition-colors">${esc(LOCALE_LABELS[loc] ?? loc)}</a>`;
    }).join('');

    localeSwitcher = `<div class="relative" id="locale-switcher">
      <button type="button" onclick="document.getElementById('locale-menu').classList.toggle('hidden')" class="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800/60 rounded-lg border border-gray-700/50 transition-colors">
        <span>🌐</span><span>${esc(LOCALE_LABELS[locale] ?? locale)}</span>
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div id="locale-menu" class="hidden absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[140px]">
        ${options}
      </div>
    </div>`;
  }

  const langAttr = locale === 'zh' ? 'zh-Hans' : locale;

  return `<!DOCTYPE html>
<html lang="${esc(langAttr)}" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="index, follow">
  ${opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : ''}
  ${settings.siteFaviconUrl ? `<link rel="icon" href="${esc(settings.siteFaviconUrl)}">` : ''}
  ${hreflangTags}
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="${esc(opts.ogType ?? 'website')}">
  ${opts.ogUrl ? `<meta property="og:url" content="${esc(opts.ogUrl)}">` : (opts.canonical ? `<meta property="og:url" content="${esc(opts.canonical)}">` : '')}
  ${opts.ogImage ? `<meta property="og:image" content="${esc(opts.ogImage)}">` : ''}
  <meta property="og:locale" content="${esc(locale)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(desc)}">
  ${opts.ogImage ? `<meta name="twitter:image" content="${esc(opts.ogImage)}">` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: '${esc(settings.colorPrimary)}',
            secondary: '${esc(settings.colorSecondary)}',
          }
        }
      }
    }
  </script>
  <style>
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    body { background: #0a0a0f; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #1a1a2e; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #555; }
  </style>
  ${settings.customCss ? `<style>${settings.customCss}</style>` : ''}
  ${settings.customHeadScripts || ''}
  ${settings.googleAnalyticsId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(settings.googleAnalyticsId)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(settings.googleAnalyticsId)}');</script>` : ''}
  ${opts.jsonLd ? `<script type="application/ld+json">${opts.jsonLd}</script>` : ''}
</head>
<body class="bg-[#0a0a0f] text-gray-100 min-h-screen flex flex-col">
  <header class="sticky top-0 z-50 bg-[#0d0d14]/95 backdrop-blur-md border-b border-gray-800/50">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-6">
          <a href="/" class="flex items-center gap-2 shrink-0">
            ${settings.siteLogoUrl
              ? `<img src="${esc(settings.siteLogoUrl)}" alt="${esc(settings.siteName)}" class="h-8 w-auto" />`
              : `<span class="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">${esc(settings.siteName)}</span>`
            }
          </a>
          <nav class="hidden md:flex items-center gap-1">
            ${navLink('/', 'Início')}
            ${navLink('/categories', 'Categorias')}
            ${navLink('/performers', 'Modelos')}
            ${navLink('/channels', 'Canais')}
            ${navLink('/tags', 'Tags')}
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <form action="${lp}/search" method="GET" class="hidden sm:block">
            <div class="relative">
              <input type="text" name="q" placeholder="Buscar vídeos..." class="w-48 lg:w-64 pl-9 pr-3 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </form>
          ${localeSwitcher}
          <button id="mobile-menu-btn" class="md:hidden p-2 text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
      </div>
      <div id="mobile-menu" class="md:hidden hidden pb-4">
        <form action="${lp}/search" method="GET" class="mb-3 sm:hidden">
          <input type="text" name="q" placeholder="Buscar vídeos..." class="w-full pl-3 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
        </form>
        <nav class="flex flex-col gap-1">
          ${navLink('/', 'Início')}
          ${navLink('/categories', 'Categorias')}
          ${navLink('/performers', 'Modelos')}
          ${navLink('/channels', 'Canais')}
          ${navLink('/tags', 'Tags')}
        </nav>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
    ${opts.content}
  </main>

  <footer class="border-t border-gray-800/50 bg-[#0d0d14]/80 mt-auto">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <a href="${lp}/pages/about" class="hover:text-gray-300 transition-colors">Sobre</a>
          <a href="${lp}/pages/contact" class="hover:text-gray-300 transition-colors">Contato</a>
          <a href="${lp}/pages/terms" class="hover:text-gray-300 transition-colors">Termos</a>
          <a href="${lp}/pages/privacy" class="hover:text-gray-300 transition-colors">Privacidade</a>
          <a href="${lp}/pages/dmca" class="hover:text-gray-300 transition-colors">DMCA</a>
        </div>
        <p class="text-sm text-gray-600">© ${new Date().getFullYear()} ${esc(settings.siteName)}${opts.tenant && !opts.tenant.isWhiteLabel ? '. Powered by <a href="https://framevideos.com" target="_blank" rel="noopener" class="text-purple-500 hover:text-purple-400">Frame Videos</a>' : ''}</p>
      </div>
    </div>
  </footer>

  <script>
    document.getElementById('mobile-menu-btn')?.addEventListener('click', function() {
      document.getElementById('mobile-menu')?.classList.toggle('hidden');
    });
    document.addEventListener('click', function(e) {
      var sw = document.getElementById('locale-switcher');
      var menu = document.getElementById('locale-menu');
      if (sw && menu && !sw.contains(e.target)) menu.classList.add('hidden');
    });
  </script>
  <script>!function(){try{var d={path:location.pathname,referrer:document.referrer||""};navigator.sendBeacon?navigator.sendBeacon("/api/track",JSON.stringify(d)):fetch("/api/track",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d),keepalive:!0}).catch(function(){})}catch(e){}}();</script>
  ${settings.customBodyScripts || ''}
</body>
</html>`;
}
