// Middleware que gera um requestId único pra cada request
// Útil pra tracing e correlação de logs

import type { Context, Next } from 'hono';

/**
 * Gera um UUID v4 e injeta como requestId no context e no header de resposta.
 */
export async function requestIdMiddleware(c: Context, next: Next): Promise<void> {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
}
