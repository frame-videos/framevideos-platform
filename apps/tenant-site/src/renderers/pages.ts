// Renderer — Static pages (about, terms, etc.)

import type { SiteSettings, TenantInfo, LocaleConfig } from '../types.js';
import { getPage } from '../db/content.js';
import { esc } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export async function renderStaticPage(db: D1Database, tenant: TenantInfo, settings: SiteSettings, locale: string, slug: string, localeConfig: LocaleConfig): Promise<string | null> {
  const page = await getPage(db, tenant.tenantId, locale, slug);
  if (!page) return null;

  // Detect if content is already HTML or plain/markdown
  const isHtml = /<[a-z][\s\S]*>/i.test(page.content);
  let html: string;
  if (isHtml) {
    html = page.content;
  } else {
    html = esc(page.content)
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-purple-400 hover:underline">$1</a>')
      .replace(/\n\n/g, '</p><p class="mb-4 text-gray-300 leading-relaxed">')
      .replace(/\n/g, '<br>');
    html = `<p class="mb-4 text-gray-300 leading-relaxed">${html}</p>`;
  }

  const content = `<article class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">${esc(page.title)}</h1>
    <div class="prose prose-invert max-w-none">${html}</div>
  </article>`;

  const lp = locale !== localeConfig.defaultLocale ? `/${locale}` : '';
  return layout(settings, {
    title: page.title,
    description: page.content.slice(0, 160),
    canonical: `https://${tenant.domain}${lp}/pages/${slug}`,
    content,
    locale,
    localeConfig,
    domain: tenant.domain,
    currentPath: `/pages/${slug}`,
  });
}
