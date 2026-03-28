// Renderer — Admin SPA with dynamic manifest from R2

import type { Env, TenantInfo } from '../types.js';
import { esc } from '../helpers/html.js';
import { CACHE_TTL_SECONDS } from '../constants.js';

interface AdminManifest {
  js: string;
  css: string;
}

const MANIFEST_CACHE_KEY = 'admin-manifest:v1';
const FALLBACK_JS = 'index-CLM2aGJk.js';
const FALLBACK_CSS = 'index-QLKxswdp.css';

async function getAdminManifest(env: Env): Promise<AdminManifest> {
  // Try KV cache first
  const cached = await env.CACHE.get(MANIFEST_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached) as AdminManifest; } catch { /* ignore */ }
  }

  // Try R2
  try {
    const obj = await env.STORAGE.get('admin-assets/manifest.json');
    if (obj) {
      const text = await obj.text();
      const manifest = JSON.parse(text) as AdminManifest;
      await env.CACHE.put(MANIFEST_CACHE_KEY, text, { expirationTtl: CACHE_TTL_SECONDS });
      return manifest;
    }
  } catch { /* ignore */ }

  // Fallback to hardcoded
  return { js: FALLBACK_JS, css: FALLBACK_CSS };
}

export async function handleAdminRequest(
  pathname: string,
  env: Env,
  tenant: TenantInfo,
): Promise<Response> {
  // Serve admin assets from R2
  if (pathname.startsWith('/admin/assets/')) {
    const assetKey = `admin-assets/${pathname.replace('/admin/assets/', '')}`;
    const obj = await env.STORAGE.get(assetKey);
    if (obj) {
      const ext = assetKey.split('.').pop();
      const contentType = ext === 'js' ? 'application/javascript' : ext === 'css' ? 'text/css' : 'application/octet-stream';
      return new Response(obj.body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return new Response('Not found', { status: 404 });
  }

  // Serve admin SPA index.html with dynamic manifest
  const manifest = await getAdminManifest(env);

  return new Response(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Painel Admin — ${esc(tenant.tenantName)}</title>
  <meta name="robots" content="noindex, nofollow">
  <script type="module" crossorigin src="/admin/assets/${esc(manifest.js)}"></script>
  <link rel="stylesheet" crossorigin href="/admin/assets/${esc(manifest.css)}">
</head>
<body>
  <div id="root"></div>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
