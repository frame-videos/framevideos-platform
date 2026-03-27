import { Context, Next } from 'hono';
import { verifyToken, extractToken } from '../auth';
import { validateTenantId } from '../helpers/tenant-query';

export interface TenantContext {
  userId: string;
  email: string;
  tenantId: string;
}

/**
 * Tenant Isolation Middleware
 * Validates authentication and extracts tenant context
 * MUST be applied to all routes that access tenant data
 */
export async function tenantIsolation(c: Context, next: Next) {
  const token = extractToken(c.req.header('Authorization'));
  
  if (!token) {
    return c.json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString(),
    }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ 
      error: 'Invalid or expired token',
      code: 'AUTH_INVALID',
      timestamp: new Date().toISOString(),
    }, 401);
  }

  // Validate tenantId format
  try {
    validateTenantId(payload.tenantId);
  } catch (error) {
    console.error('[TENANT_ISOLATION_ERROR]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: payload.sub,
    });
    return c.json({ 
      error: 'Invalid tenant context',
      code: 'TENANT_INVALID',
      timestamp: new Date().toISOString(),
    }, 403);
  }

  // Set tenant context in request
  const tenantContext: TenantContext = {
    userId: payload.sub,
    email: payload.email,
    tenantId: payload.tenantId,
  };

  c.set('tenantContext', tenantContext);
  
  // Log access for audit trail
  logTenantAccess(c, tenantContext);
  
  await next();
}

/**
 * Log tenant access for security audit
 */
function logTenantAccess(c: Context, context: TenantContext) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tenantId: context.tenantId,
    userId: context.userId,
    method: c.req.method,
    path: c.req.path,
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    userAgent: c.req.header('User-Agent') || 'unknown',
  };

  // In production, send to logging service (e.g., Cloudflare Logs, Sentry)
  console.log('[TENANT_ACCESS]', JSON.stringify(logEntry));
}

/**
 * Get tenant context from request
 * Throws if not authenticated (should be used after tenantIsolation middleware)
 */
export function getTenantContext(c: Context): TenantContext {
  const context = c.get('tenantContext');
  if (!context) {
    throw new Error('Tenant context not found. Did you apply tenantIsolation middleware?');
  }
  return context;
}

/**
 * Validate that a resource belongs to the authenticated tenant
 * Throws 403 if tenant mismatch
 */
export function validateTenantOwnership(c: Context, resourceTenantId: string) {
  const context = getTenantContext(c);
  
  if (context.tenantId !== resourceTenantId) {
    console.warn('[TENANT_VIOLATION]', {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      userTenantId: context.tenantId,
      resourceTenantId,
      path: c.req.path,
      method: c.req.method,
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    });
    
    throw new Error('Access denied: resource belongs to different tenant');
  }
}

/**
 * Validates that body data doesn't contain tenantId (should come from auth only)
 * Prevents tenant injection attacks
 */
export function validateNoTenantInBody(body: any) {
  if (body && (body.tenantId || body.tenant_id)) {
    console.warn('[TENANT_INJECTION_ATTEMPT]', {
      timestamp: new Date().toISOString(),
      attemptedTenantId: body.tenantId || body.tenant_id,
    });
    throw new Error('Security: tenantId cannot be provided in request body');
  }
}

/**
 * Sanitizes request body by removing any tenantId fields
 * Use this before processing user input
 */
export function sanitizeTenantFromBody<T extends Record<string, any>>(body: T): Omit<T, 'tenantId' | 'tenant_id'> {
  const { tenantId, tenant_id, ...sanitized } = body;
  
  if (tenantId || tenant_id) {
    console.warn('[TENANT_FIELD_REMOVED]', {
      timestamp: new Date().toISOString(),
      removedTenantId: tenantId || tenant_id,
    });
  }
  
  return sanitized;
}
