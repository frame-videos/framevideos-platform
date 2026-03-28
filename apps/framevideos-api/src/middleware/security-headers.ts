// Security headers middleware — Sprint 10
// Adds OWASP-recommended security headers to all responses

import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';

// ─── Security header values ─────────────────────────────────────────────────

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
  ].join('; '),
} as const;

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Adds security headers to every response.
 * Should be registered early in the middleware chain.
 */
export function securityHeaders(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    await next();

    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      c.header(header, value);
    }
  };
}

/**
 * Returns the expected security headers map.
 * Useful for the security audit route.
 */
export function getExpectedSecurityHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS };
}
