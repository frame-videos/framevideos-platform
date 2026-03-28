// Error tracking middleware — global error boundary with structured error responses
// Catches unhandled errors, logs structured data, returns consistent JSON

import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';
import { AppError } from '@frame-videos/shared/errors';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ErrorLogEntry {
  timestamp: string;
  level: 'error';
  requestId: string;
  method: string;
  path: string;
  error: {
    name: string;
    message: string;
    code?: string;
    statusCode?: number;
    stack?: string;
  };
  ip?: string;
  tenantId?: string;
  duration: number;
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Global error boundary middleware.
 * - Catches unhandled errors that escape route handlers
 * - Logs structured error data
 * - Returns consistent JSON error response
 * - In production: never exposes stack traces to clients
 */
export function errorTracker(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const start = Date.now();

    try {
      await next();
    } catch (err) {
      const duration = Date.now() - start;
      const requestId = c.get('requestId') || crypto.randomUUID();
      const isProduction = c.env.ENVIRONMENT === 'production';

      // Build structured error log
      const error = err instanceof Error ? err : new Error(String(err));
      const logEntry: ErrorLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        requestId,
        method: c.req.method,
        path: c.req.path,
        error: {
          name: error.name,
          message: error.message,
          stack: isProduction ? undefined : error.stack,
        },
        duration,
      };

      // Add context
      const ip =
        c.req.header('CF-Connecting-IP') ??
        c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
      if (ip) logEntry.ip = ip;

      const tenantId = c.get('tenantId');
      if (tenantId) logEntry.tenantId = tenantId;

      // Handle known application errors
      if (err instanceof AppError) {
        logEntry.error.code = err.code;
        logEntry.error.statusCode = err.statusCode;
        console.error(JSON.stringify(logEntry));

        const body = err.toJSON() as Record<string, Record<string, unknown>>;
        if (body['error']) {
          body['error']['requestId'] = requestId;
        }

        return c.json(body, err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500);
      }

      // Unknown/unhandled error — always 500
      console.error(JSON.stringify(logEntry));

      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: isProduction
              ? 'An unexpected error occurred'
              : error.message,
            requestId,
          },
        },
        500,
      );
    }
  };
}
