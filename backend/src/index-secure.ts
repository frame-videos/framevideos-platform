import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './routes/auth-secure';
import videos from './routes/videos-secure';
import videosUpload from './routes/videos-upload';
import tenants from './routes/tenants';
import storage from './routes/storage';
import categories from './routes/categories';
import tags from './routes/tags';
import videosSearch from './routes/videos-search';
import analytics from './routes/analytics';
import { FrameVideosError } from './error-handler';
import { D1Database } from './database-d1';
import { publicRateLimit } from './middleware/rate-limit';
import { securityHeaders } from './middleware/security-headers';

// Types
type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  API_URL: string;
};

// Variables set in context
type Variables = {
  db: D1Database;
  requestId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware - inject D1 instance into context
app.use('*', async (c, next) => {
  c.set('db', new D1Database(c.env.DB));
  await next();
});

app.use('*', logger());

app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://framevideos.com', 'https://*.framevideos.com', 'https://production.frame-videos-frontend.pages.dev', 'https://*.frame-videos-frontend.pages.dev'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));

// Security headers middleware (global)
app.use('*', securityHeaders());

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
});

// Global rate limiting for public endpoints (100 req/min per IP)
app.use('/api/v1/*', publicRateLimit);

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    security: {
      tenantIsolation: 'enabled',
      rowLevelSecurity: 'enabled',
      auditLogging: 'enabled',
      errorHandling: 'enabled',
    },
  });
});

// ============================================================================
// API Info
// ============================================================================

app.get('/api/v1', (c) => {
  return c.json({
    name: 'Frame Videos API',
    version: '1.0.0',
    security: {
      tenantIsolation: 'enabled',
      authentication: 'JWT',
      errorHandling: 'centralized',
      documentation: '/docs/MULTI_TENANT.md',
    },
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      videos: '/api/v1/videos',
      videosUpload: '/api/v1/videos/upload',
      tenants: '/api/v1/tenants',
      storage: '/api/v1/storage',
      categories: '/api/v1/categories',
      tags: '/api/v1/tags',
      analytics: '/api/v1/analytics',
    },
  });
});

// ============================================================================
// Mount Routes
// ============================================================================

app.route('/api/v1/auth', auth);
app.route('/api/v1/videos/upload', videosUpload);
app.route('/api/v1/videos', videos);
app.route('/api/v1/tenants', tenants);
app.route('/api/v1/storage', storage);
app.route('/api/v1/categories', categories);
app.route('/api/v1/tags', tags);
app.route('/api/v1/analytics', analytics);

// ============================================================================
// 404 Handler
// ============================================================================

app.notFound((c) => {
  const requestId = c.get('requestId') || 'unknown';
  
  console.warn('[NOT_FOUND]', {
    timestamp: new Date().toISOString(),
    path: c.req.path,
    method: c.req.method,
    requestId,
  });
  
  return c.json({
    error: {
      message: 'Endpoint not found',
      code: 404,
      category: 'NOT_FOUND',
      requestId,
      timestamp: new Date().toISOString(),
      context: {
        path: c.req.path,
        method: c.req.method,
      },
    },
  }, 404);
});

// ============================================================================
// Global Error Handler
// ============================================================================

app.onError((err, c) => {
  const requestId = c.get('requestId') || 'unknown';
  
  // Log error
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    requestId,
    error: err.message,
    stack: err.stack,
  });
  
  // Return error response
  if (err instanceof FrameVideosError) {
    return c.json({
      error: {
        message: err.message,
        code: err.statusCode,
        category: err.category,
        requestId,
        timestamp: new Date().toISOString(),
        details: err.details,
      },
    }, err.statusCode);
  }
  
  // Generic error
  return c.json({
    error: {
      message: 'Internal server error',
      code: 500,
      category: 'INTERNAL',
      requestId,
      timestamp: new Date().toISOString(),
    },
  }, 500);
});

export default app;
