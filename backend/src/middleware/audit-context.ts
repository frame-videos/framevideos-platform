/**
 * Audit Context Middleware
 * Captures IP address and User-Agent for audit logging
 */

import { Context, Next } from 'hono';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Middleware to extract and store audit context (IP, User-Agent)
 */
export async function auditContextMiddleware(c: Context, next: Next) {
  // Extract IP address (try multiple headers for proxy support)
  const ipAddress =
    c.req.header('cf-connecting-ip') || // Cloudflare
    c.req.header('x-real-ip') || // Nginx
    c.req.header('x-forwarded-for')?.split(',')[0].trim() || // Standard proxy
    'unknown';

  // Extract User-Agent
  const userAgent = c.req.header('user-agent') || 'unknown';

  // Store in context for use by routes
  c.set('auditContext', {
    ipAddress,
    userAgent,
  } as AuditContext);

  await next();
}

/**
 * Helper to get audit context from request
 */
export function getAuditContext(c: Context): AuditContext {
  return c.get('auditContext') || {};
}
