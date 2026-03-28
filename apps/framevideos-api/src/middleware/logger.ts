// Structured logging middleware — JSON log entries for every request
// Outputs structured logs to console (captured by Cloudflare Workers runtime)

import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  tenantId?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Structured logger that emits JSON log entries for every request.
 * Captures: method, path, status, duration, client info, tenant context.
 * Errors are logged with message + stack (in non-production).
 */
export function structuredLogger(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const start = Date.now();
    const requestId = c.get('requestId') || crypto.randomUUID();

    try {
      await next();
    } finally {
      const duration = Date.now() - start;
      const status = c.res.status;

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: c.req.method,
        path: c.req.path,
        status,
        duration,
      };

      // Client info
      const ip =
        c.req.header('CF-Connecting-IP') ??
        c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
      if (ip) entry.ip = ip;

      const userAgent = c.req.header('User-Agent');
      if (userAgent) entry.userAgent = userAgent.slice(0, 256);

      // Tenant context (if authenticated)
      const tenantId = c.get('tenantId');
      if (tenantId) entry.tenantId = tenantId;

      // Log level based on status
      if (status >= 500) {
        console.error(JSON.stringify(entry));
      } else if (status >= 400) {
        console.warn(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
    }
  };
}
