/**
 * Tenant Routing Middleware
 * Automatically routes requests based on domain (Host header)
 * 
 * Flow:
 * 1. Extract domain from Host header
 * 2. Look up tenant by custom_domain OR domain
 * 3. Inject tenantId into context
 * 4. Return 404 if domain not found
 */

import { Context, Next } from 'hono';
import { D1Database } from '../database-d1';
import { NotFoundError } from '../error-handler';

export interface DomainTenantContext {
  tenantId: string;
  tenantDomain: string;
  isCustomDomain: boolean;
}

/**
 * Tenant Routing Middleware
 * Detects tenant from domain and injects into context
 */
export async function tenantRouting(c: Context, next: Next) {
  const db = c.get('db') as D1Database;
  
  // Extract domain from Host header
  const host = c.req.header('Host');
  if (!host) {
    throw new NotFoundError('Host header missing');
  }

  // Remove port if present (localhost:8787 -> localhost)
  const domain = host.split(':')[0];

  // Try to find tenant by custom_domain first, then by domain
  const tenant = await findTenantByDomain(db, domain);

  if (!tenant) {
    console.warn('[TENANT_ROUTING] Domain not found:', {
      domain,
      timestamp: new Date().toISOString(),
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    });
    
    throw new NotFoundError(`Domain not configured: ${domain}`);
  }

  // Check tenant status
  if (tenant.status === 'suspended') {
    console.warn('[TENANT_ROUTING] Tenant suspended:', {
      domain,
      tenantId: tenant.id,
      timestamp: new Date().toISOString(),
    });
    
    return c.json({
      error: 'This account has been suspended. Please contact support.',
      code: 'TENANT_SUSPENDED',
    }, 403);
  }

  if (tenant.status === 'cancelled') {
    console.warn('[TENANT_ROUTING] Tenant cancelled:', {
      domain,
      tenantId: tenant.id,
      timestamp: new Date().toISOString(),
    });
    
    return c.json({
      error: 'This account has been cancelled.',
      code: 'TENANT_CANCELLED',
    }, 403);
  }

  // Set domain tenant context
  const domainContext: DomainTenantContext = {
    tenantId: tenant.id,
    tenantDomain: domain,
    isCustomDomain: tenant.isCustomDomain,
  };

  c.set('domainTenantContext', domainContext);

  // Log routing for audit
  console.log('[TENANT_ROUTING] Routed:', {
    domain,
    tenantId: tenant.id,
    isCustomDomain: tenant.isCustomDomain,
    timestamp: new Date().toISOString(),
  });

  await next();
}

/**
 * Find tenant by domain (custom_domain or domain)
 */
async function findTenantByDomain(
  db: D1Database,
  domain: string
): Promise<{ id: string; isCustomDomain: boolean; status: string } | null> {
  // Try custom_domain first
  const customDomainResult = await db.db
    .prepare(
      `SELECT id, status FROM tenants 
       WHERE custom_domain = ? 
       AND custom_domain_status = 'active' 
       LIMIT 1`
    )
    .bind(domain)
    .first();

  if (customDomainResult) {
    return {
      id: customDomainResult.id as string,
      isCustomDomain: true,
      status: customDomainResult.status as string || 'active',
    };
  }

  // Try default domain
  const defaultDomainResult = await db.db
    .prepare('SELECT id, status FROM tenants WHERE domain = ? LIMIT 1')
    .bind(domain)
    .first();

  if (defaultDomainResult) {
    return {
      id: defaultDomainResult.id as string,
      isCustomDomain: false,
      status: defaultDomainResult.status as string || 'active',
    };
  }

  return null;
}

/**
 * Get domain tenant context from request
 * Should be used after tenantRouting middleware
 */
export function getDomainTenantContext(c: Context): DomainTenantContext {
  const context = c.get('domainTenantContext');
  if (!context) {
    throw new Error(
      'Domain tenant context not found. Did you apply tenantRouting middleware?'
    );
  }
  return context;
}

/**
 * Get tenant ID from domain context
 * Shortcut for getDomainTenantContext(c).tenantId
 */
export function getTenantIdFromDomain(c: Context): string {
  return getDomainTenantContext(c).tenantId;
}

/**
 * Validate that authenticated user belongs to the domain's tenant
 * Use after authenticate middleware to ensure JWT tenant matches domain
 */
export function validateDomainTenantMatch(c: Context) {
  const domainContext = getDomainTenantContext(c);
  const user = c.get('user');
  
  if (!user) {
    throw new Error('User not authenticated. Apply authenticate middleware first.');
  }
  
  if (user.tenantId !== domainContext.tenantId) {
    console.warn('[DOMAIN_TENANT_MISMATCH]', {
      timestamp: new Date().toISOString(),
      userId: user.sub,
      userTenantId: user.tenantId,
      domainTenantId: domainContext.tenantId,
      domain: domainContext.tenantDomain,
    });
    
    throw new Error(
      'Access denied: your account does not belong to this domain'
    );
  }
}
