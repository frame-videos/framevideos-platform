// Tenant Site Worker — Sprint 4
// Resolve domínios customizados e subdomínios → renderiza site do tenant
//
// Fluxo:
// 1. Request chega em sites.framevideos.com ou slug.framevideos.com ou domínio customizado
// 2. Worker lê o header Host
// 3. Busca no D1: domínio customizado OU slug do tenant
// 4. Se encontrar → renderiza placeholder do site
// 5. Se não → 404

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
}

interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  domain: string;
  isPrimary: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 300; // 5 minutos de cache
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'sites',
  'mail',
  'smtp',
  'imap',
  'pop',
  'ftp',
  'cdn',
  'static',
  'assets',
  'staging',
  'dev',
  'test',
]);

// ─── Domain Resolution ──────────────────────────────────────────────────────

/**
 * Resolve um hostname para um tenant.
 * Tenta cache KV primeiro, depois D1.
 */
async function resolveTenant(
  hostname: string,
  db: D1Database,
  cache: KVNamespace,
): Promise<TenantInfo | null> {
  // 1. Tentar cache
  const cacheKey = `tenant:${hostname}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    if (cached === '__404__') return null;
    try {
      return JSON.parse(cached) as TenantInfo;
    } catch {
      // Cache corrompido, ignorar
    }
  }

  let tenant: TenantInfo | null = null;

  // 2. Verificar se é subdomínio framevideos.com
  if (hostname.endsWith('.framevideos.com')) {
    const slug = hostname.replace('.framevideos.com', '');

    // Ignorar subdomínios reservados
    if (RESERVED_SUBDOMAINS.has(slug) || slug === 'framevideos') {
      await cache.put(cacheKey, '__404__', { expirationTtl: CACHE_TTL_SECONDS });
      return null;
    }

    // Buscar tenant por slug
    const result = await db
      .prepare(
        `SELECT t.id, t.name, t.slug
         FROM tenants t
         WHERE t.slug = ? AND t.status IN ('active', 'trial')
         LIMIT 1`,
      )
      .bind(slug)
      .first<{ id: string; name: string; slug: string }>();

    if (result) {
      tenant = {
        tenantId: result.id,
        tenantName: result.name,
        tenantSlug: result.slug,
        domain: hostname,
        isPrimary: false,
      };
    }
  } else {
    // 3. Domínio customizado — buscar no D1
    const result = await db
      .prepare(
        `SELECT d.tenant_id, d.domain, d.is_primary, t.name, t.slug
         FROM domains d
         JOIN tenants t ON t.id = d.tenant_id
         WHERE d.domain = ? AND d.status = 'active' AND t.status IN ('active', 'trial')
         LIMIT 1`,
      )
      .bind(hostname)
      .first<{
        tenant_id: string;
        domain: string;
        is_primary: number;
        name: string;
        slug: string;
      }>();

    if (result) {
      tenant = {
        tenantId: result.tenant_id,
        tenantName: result.name,
        tenantSlug: result.slug,
        domain: result.domain,
        isPrimary: result.is_primary === 1,
      };
    }
  }

  // 4. Cachear resultado
  if (tenant) {
    await cache.put(cacheKey, JSON.stringify(tenant), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  } else {
    // Cache negativo pra evitar queries repetidas
    await cache.put(cacheKey, '__404__', {
      expirationTtl: 60, // Cache negativo mais curto (1 min)
    });
  }

  return tenant;
}

// ─── HTML Rendering ──────────────────────────────────────────────────────────

/**
 * Renderiza o placeholder HTML do site do tenant.
 * TODO: Sprint 5+ — substituir por renderização real com template engine.
 */
function renderSitePlaceholder(tenant: TenantInfo): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(tenant.tenantName)} — Em construção</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 600px;
    }
    .logo {
      font-size: 3rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      color: #94a3b8;
      font-size: 1.1rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .badge {
      display: inline-block;
      background: rgba(139, 92, 246, 0.15);
      color: #a78bfa;
      padding: 0.5rem 1.25rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 500;
      border: 1px solid rgba(139, 92, 246, 0.3);
    }
    .footer {
      margin-top: 3rem;
      font-size: 0.8rem;
      color: #475569;
    }
    .footer a {
      color: #8b5cf6;
      text-decoration: none;
    }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🎬</div>
    <h1>${escapeHtml(tenant.tenantName)}</h1>
    <p>Este site está em construção. Em breve estará disponível com conteúdo incrível.</p>
    <span class="badge">🚧 Em construção</span>
    <div class="footer">
      Powered by <a href="https://framevideos.com" target="_blank" rel="noopener">Frame Videos</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Renderiza página 404.
 */
function render404(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site não encontrado — Frame Videos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 4rem; margin-bottom: 1rem; color: #475569; }
    p { color: #64748b; font-size: 1.1rem; margin-bottom: 2rem; }
    a {
      color: #8b5cf6;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Este site não foi encontrado ou ainda não está configurado.</p>
    <a href="https://framevideos.com">Criar seu site com Frame Videos →</a>
  </div>
</body>
</html>`;
}

/**
 * Escapa HTML pra prevenir XSS.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Worker Entry Point ─────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    // Health check
    if (url.pathname === '/__health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'tenant-site' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Robots.txt — placeholder sites não devem ser indexados
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    try {
      // Resolver tenant pelo hostname
      const tenant = await resolveTenant(hostname, env.DB, env.CACHE);

      if (!tenant) {
        return new Response(render404(), {
          status: 404,
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=60',
          },
        });
      }

      // Renderizar site do tenant (placeholder por enquanto)
      const html = renderSitePlaceholder(tenant);

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'X-Tenant-Id': tenant.tenantId,
          'X-Frame-Options': 'SAMEORIGIN',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      });
    } catch (err) {
      console.error('[tenant-site] Error resolving tenant:', err);

      return new Response(render404(), {
        status: 500,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-store',
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
