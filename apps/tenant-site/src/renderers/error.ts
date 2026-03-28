// Renderer — 404 page

import type { SiteSettings, TenantInfo } from '../types.js';
import { esc } from '../helpers/html.js';
import { layout } from '../templates/layout.js';

export function render404Page(settings: SiteSettings | null, tenant: TenantInfo | null): string {
  if (!settings || !tenant) {
    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Site não encontrado — Frame Videos</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{text-align:center;padding:2rem}h1{font-size:4rem;margin-bottom:1rem;color:#475569}p{color:#64748b;font-size:1.1rem;margin-bottom:2rem}a{color:#8b5cf6;text-decoration:none;font-weight:500}a:hover{text-decoration:underline}</style>
</head><body><div class="c"><h1>404</h1><p>Este site não foi encontrado ou ainda não está configurado.</p><a href="https://framevideos.com">Criar seu site com Frame Videos →</a></div></body></html>`;
  }

  const content = `<div class="text-center py-20">
    <p class="text-6xl font-bold text-gray-700 mb-4">404</p>
    <h1 class="text-2xl font-bold mb-2">Página não encontrada</h1>
    <p class="text-gray-500 mb-6">A página que você procura não existe ou foi removida.</p>
    <a href="/" class="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
      ← Voltar ao início
    </a>
  </div>`;

  return layout(settings, { tenant, title: 'Página não encontrada', content });
}
