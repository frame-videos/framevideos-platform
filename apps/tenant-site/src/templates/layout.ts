// Tenant Site — Main HTML layout template

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { LOCALE_LABELS } from '../constants.js';
import { esc } from '../helpers/html.js';

export interface AdSlotConfig {
  headerPlacementId?: string;
  sidebarPlacementId?: string;
  inContentPlacementId?: string;
  tenantId: string;
  apiBaseUrl: string;
}

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
  adSlots?: AdSlotConfig;
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
  <style>
    /* Critical CSS — instant render without Tailwind CDN */
    *,::after,::before{box-sizing:border-box;border:0 solid #e5e7eb}
    html{line-height:1.5;-webkit-text-size-adjust:100%;font-family:ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji"}
    body{margin:0;line-height:inherit;background:#0a0a0f;color:#f3f4f6}
    a{color:inherit;text-decoration:inherit}
    img,video{display:block;max-width:100%;height:auto}
    h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}
    input,button,textarea,select{font:inherit;color:inherit}
    button{cursor:pointer;background:transparent}
    /* Layout */
    .min-h-screen{min-height:100vh}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1 1 0%}
    .items-center{align-items:center}.justify-between{justify-content:space-between}.justify-center{justify-content:center}
    .gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-6{gap:1.5rem}
    .hidden{display:none}.block{display:block}.inline-block{display:inline-block}.inline-flex{display:inline-flex}
    .grid{display:grid}
    /* Spacing */
    .p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.px-2{padding-left:.5rem;padding-right:.5rem}
    .px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}
    .py-1{padding-top:.25rem;padding-bottom:.25rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}
    .pb-4{padding-bottom:1rem}.pt-4{padding-top:1rem}
    .mb-1{margin-bottom:.25rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mb-4{margin-bottom:1rem}
    .mb-8{margin-bottom:2rem}.mb-10{margin-bottom:2.5rem}.mt-auto{margin-top:auto}
    .mx-auto{margin-left:auto;margin-right:auto}
    /* Sizing */
    .w-full{width:100%}.w-6{width:1.5rem}.h-6{height:1.5rem}.h-8{height:2rem}.h-16{height:4rem}
    .max-w-7xl{max-width:80rem}.shrink-0{flex-shrink:0}
    /* Typography */
    .text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}
    .text-lg{font-size:1.125rem;line-height:1.75rem}.text-xl{font-size:1.25rem;line-height:1.75rem}
    .text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}
    .font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}
    .text-center{text-align:center}
    /* Colors */
    .text-gray-100{color:#f3f4f6}.text-gray-200{color:#e5e7eb}.text-gray-300{color:#d1d5db}
    .text-gray-400{color:#9ca3af}.text-gray-500{color:#6b7280}
    .text-purple-400{color:#c084fc}.text-purple-500{color:#a855f7}.text-indigo-400{color:#818cf8}
    .text-white{color:#fff}
    .bg-gray-800{background:#1f2937}.bg-gray-800\\/50{background:rgba(31,41,55,.5)}.bg-gray-800\\/60{background:rgba(31,41,55,.6)}
    .bg-gray-900{background:#111827}.bg-black{background:#000}.bg-black\\/30{background:rgba(0,0,0,.3)}
    .bg-purple-600{background:#9333ea}.bg-purple-500{background:#a855f7}
    .bg-\\[\\#0a0a0f\\]{background:#0a0a0f}.bg-\\[\\#0d0d14\\]\\/95{background:rgba(13,13,20,.95)}
    .bg-\\[\\#111118\\]{background:#111118}
    /* Borders */
    .border{border-width:1px}.border-b{border-bottom-width:1px}.border-gray-700{border-color:#374151}
    .border-gray-800{border-color:#1f2937}.border-gray-800\\/50{border-color:rgba(31,41,55,.5)}
    .rounded{border-radius:.25rem}.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}
    .rounded-full{border-radius:9999px}
    /* Effects */
    .overflow-hidden{overflow:hidden}.relative{position:relative}.absolute{position:absolute}
    .sticky{position:sticky}.top-0{top:0}.z-50{z-index:50}.inset-0{inset:0}
    .backdrop-blur-md{backdrop-filter:blur(12px)}
    .transition-colors{transition-property:color,background-color,border-color;transition-duration:.15s}
    .transition-all{transition-property:all;transition-duration:.15s}
    .opacity-0{opacity:0}
    /* Aspect ratio */
    .aspect-video{aspect-ratio:16/9}.object-cover{object-fit:cover}
    /* Grid responsive */
    .grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
    .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .line-clamp-3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    /* Gradient */
    .bg-gradient-to-r{background-image:linear-gradient(to right,var(--tw-gradient-stops))}
    .bg-gradient-to-t{background-image:linear-gradient(to top,var(--tw-gradient-stops))}
    .from-purple-400{--tw-gradient-from:#c084fc;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to,transparent)}
    .to-indigo-400{--tw-gradient-to:#818cf8}
    .from-transparent{--tw-gradient-from:transparent;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to,transparent)}
    .to-black{--tw-gradient-to:#000}
    .bg-clip-text{-webkit-background-clip:text;background-clip:text}.text-transparent{color:transparent}
    /* Focus */
    .outline-none{outline:none}
    .focus\\:ring-2:focus{box-shadow:0 0 0 2px rgba(139,92,246,.5)}
    .focus\\:outline-none:focus{outline:none}
    /* Hover */
    .hover\\:text-gray-300:hover{color:#d1d5db}.hover\\:text-purple-300:hover{color:#d8b4fe}
    .hover\\:text-purple-400:hover{color:#c084fc}.hover\\:bg-gray-800:hover{background:#1f2937}
    .hover\\:bg-purple-700:hover{background:#7e22ce}.hover\\:ring-1:hover{box-shadow:0 0 0 1px}
    .hover\\:ring-purple-500\\/30:hover{--tw-ring-color:rgba(168,85,247,.3)}
    /* Scrollbar */
    ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#1a1a2e}
    ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#555}
    /* Responsive */
    @media(min-width:640px){.sm\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.sm\\:hidden{display:none}.sm\\:block{display:block}}
    @media(min-width:768px){.md\\:flex{display:flex}.md\\:hidden{display:none}.md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.md\\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.md\\:text-3xl{font-size:1.875rem}}
    @media(min-width:1024px){.lg\\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.lg\\:grid-cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}}
  </style>
  <script>
    /* Tailwind CDN — loaded async for dynamic classes, critical CSS handles initial render */
    (function(){var s=document.createElement('script');s.src='https://cdn.tailwindcss.com';s.onload=function(){
      tailwind.config={darkMode:'class',theme:{extend:{colors:{primary:'${esc(settings.colorPrimary)}',secondary:'${esc(settings.colorSecondary)}'}}}}
    };document.head.appendChild(s)})();
  </script>
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
          <a href="/login" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-700/60 rounded-lg border border-gray-700/50 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Entrar
          </a>
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
          <a href="/login" class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Entrar
          </a>
        </nav>
      </div>
    </div>
  </header>

  ${opts.adSlots?.headerPlacementId ? `
  <!-- Ad: Header Banner -->
  <div class="max-w-7xl mx-auto px-4 pt-4" id="ad-slot-header">
    <div class="flex justify-center">
      <iframe src="${esc(opts.adSlots.apiBaseUrl)}/api/v1/ads/serve?placement=${esc(opts.adSlots.headerPlacementId)}&tenant=${esc(opts.adSlots.tenantId)}"
        width="728" height="90" frameborder="0" scrolling="no" loading="lazy"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        style="max-width:100%;border:none;overflow:hidden;"></iframe>
    </div>
  </div>` : ''}

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
