import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './routes/auth';
import videos from './routes/videos';
import tenants from './routes/tenants';
import storage from './routes/storage';
import categories from './routes/categories';
import tags from './routes/tags';

// Types
type Bindings = {
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  API_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://framevideos.com', 'https://*.framevideos.com'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.get('/api/v1', (c) => {
  return c.json({
    name: 'Frame Videos API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      videos: '/api/v1/videos',
      tenants: '/api/v1/tenants',
      storage: '/api/v1/storage',
      categories: '/api/v1/categories',
      tags: '/api/v1/tags',
    },
  });
});

// Mount routes
app.route('/api/v1/auth', auth);
app.route('/api/v1/videos', videos);
app.route('/api/v1/tenants', tenants);
app.route('/api/v1/storage', storage);
app.route('/api/v1/categories', categories);
app.route('/api/v1/tags', tags);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

export default app;
