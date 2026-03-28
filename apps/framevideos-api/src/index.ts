// Frame Videos API — Entry point
// Cloudflare Worker com Hono

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppContext } from './env.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
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
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  }),
);

// Logger (console.log no Worker)
app.use('*', logger());

// Request ID em toda request
app.use('*', requestIdMiddleware);

// ─── Error handler global ────────────────────────────────────────────────────

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

// ─── Export ──────────────────────────────────────────────────────────────────

export default app;
