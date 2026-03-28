// Health check endpoint

import { Hono } from 'hono';
import type { AppContext } from '../env.js';

const health = new Hono<AppContext>();

/**
 * GET /health — Status da API.
 * Retorna status, timestamp, environment e versão.
 */
health.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT ?? 'unknown',
    version: '0.1.0',
  });
});

export { health };
