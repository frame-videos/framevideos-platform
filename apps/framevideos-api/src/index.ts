// Frame Videos API — Entry point
// Cloudflare Worker com Hono

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from './env.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { structuredLogger } from './middleware/logger.js';
import { errorTracker } from './middleware/error-tracker.js';
import { securityHeaders } from './middleware/security-headers.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { health } from './routes/health.js';
import { auth } from './routes/auth.js';
import { billing } from './routes/billing.js';
import { domains } from './routes/domains.js';
import { content } from './routes/content.js';
import { publicRoutes } from './routes/public.js';
import { credits } from './routes/credits.js';
import { ai } from './routes/ai.js';
import { analytics } from './routes/analytics.js';
import { email } from './routes/email.js';
import { newsletter } from './routes/newsletter.js';
import { monitoring } from './routes/monitoring.js';
import { admin } from './routes/admin.js';
import { security } from './routes/security.js';
import { crawler } from './routes/crawler.js';
import { ads } from './routes/ads.js';

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new Hono<AppContext>();

// ─── Middleware global ───────────────────────────────────────────────────────

// CORS — permitir origens configuráveis (em prod, restringir)
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Em dev, aceitar tudo. Em prod, validar contra domínios cadastrados.
      return origin;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Tenant-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  }),
);

// Request ID em toda request
app.use('*', requestIdMiddleware);

// Error tracking — global error boundary (FIRST to catch all errors)
app.use('*', errorTracker());

// Security headers em toda response
app.use('*', securityHeaders());

// Input sanitization (antes das routes, depois do CORS)
app.use('*', sanitizeInput());

// Structured logging — JSON log entries for every request
app.use('*', structuredLogger());

// ─── Error handler global (fallback for errors not caught by errorTracker) ───

app.onError(errorHandler);

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check (sem versionamento)
app.route('/health', health);

// API v1
app.route('/api/v1/auth', auth);
app.route('/api/v1/billing', billing);
app.route('/api/v1/domains', domains);
app.route('/api/v1/content', content);
app.route('/api/v1/public', publicRoutes);
app.route('/api/v1/credits', credits);
app.route('/api/v1/ai', ai);
app.route('/api/v1/analytics', analytics);
app.route('/api/v1/email', email);
app.route('/api/v1/newsletter', newsletter);
app.route('/api/v1/monitoring', monitoring);
app.route('/api/v1/admin', admin);
app.route('/api/v1/security', security);
app.route('/api/v1/crawler', crawler);
app.route('/api/v1/ads', ads);

// 404 catch-all
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        requestId: c.get('requestId') ?? null,
      },
    },
    404,
  );
});

// ─── Scheduled Handler (Cron) ────────────────────────────────────────────────

import { D1Client } from '@frame-videos/db';
import { executeCrawl } from './services/crawler.js';

async function handleScheduled(env: AppContext['Bindings']): Promise<void> {
  const db = new D1Client(env.DB);

  // Check global crawl interval from platform_config
  const intervalConfig = await db.queryOne<{ value: string }>(
    "SELECT value FROM platform_config WHERE key = 'crawler_interval_minutes'",
    [],
  ).catch(() => null);
  const globalInterval = Math.max(5, parseInt(intervalConfig?.value || '60', 10));

  // Find all active sources that need crawling
  const sources = await db.query<{
    id: string;
    tenant_id: string;
    name: string;
    last_run_at: string | null;
    crawl_interval_minutes: number | null;
  }>(
    'SELECT id, tenant_id, name, last_run_at, crawl_interval_minutes FROM crawler_sources WHERE is_active = 1',
    [],
  );

  const now = Date.now();

  for (const source of sources) {
    const interval = source.crawl_interval_minutes || globalInterval;
    const lastRun = source.last_run_at ? new Date(source.last_run_at + 'Z').getTime() : 0;
    const elapsed = (now - lastRun) / 60_000; // minutes

    if (elapsed >= interval) {
      console.log(`[cron] Crawling "${source.name}" (${source.id}) — last run ${Math.round(elapsed)}min ago, interval ${interval}min`);
      try {
        const result = await executeCrawl(source.id, source.tenant_id, env);
        console.log(`[cron] Crawl complete: ${result.videosFound} found, ${result.videosNew} new, ${result.errors.length} errors`);
      } catch (err) {
        console.error(`[cron] Crawl failed for ${source.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: AppContext['Bindings'], ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
};
