/**
 * Custom Domain Management Routes
 * Cloudflare for SaaS integration
 */

import { Hono } from 'hono';
import { D1Database } from '../database-d1';
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  ConflictError,
  ExternalAPIError,
  validateRequired,
  validateUUID,
  withRetry,
} from '../error-handler';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logAuditEvent, AuditEventType } from '../audit';
import { getAuditContext } from '../middleware/audit-context';
import {
  CloudflareSaaSClient,
  CloudflareConfig,
  mapCloudflareStatus,
} from '../cloudflare-saas';

type Variables = {
  db: D1Database;
};

type Env = {
  DB: D1Database;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  FALLBACK_ORIGIN?: string;
};

const customDomain = new Hono<{ Variables: Variables; Bindings: Env }>();

// Apply authentication and admin middleware to all routes
customDomain.use('*', authenticate, requireAdmin);

/**
 * Get Cloudflare client from environment
 */
function getCloudflareClient(c: any): CloudflareSaaSClient {
  const zoneId = c.env.CLOUDFLARE_ZONE_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) {
    throw new Error('Cloudflare configuration missing. Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN.');
  }

  const config: CloudflareConfig = {
    zoneId,
    apiToken,
  };

  return new CloudflareSaaSClient(config);
}

/**
 * Get fallback origin (default domain)
 */
function getFallbackOrigin(c: any): string {
  return c.env.FALLBACK_ORIGIN || 'framevideos.com';
}

// ============================================================================
// POST /api/v1/tenants/:id/domain - Add Custom Domain
// ============================================================================

customDomain.post('/:id/domain', asyncHandler(async (c) => {
  const tenantId = c.req.param('id');
  const body = await c.req.json();
  const { customDomain: domain } = body;
  const db = c.get('db');
  const { ipAddress, userAgent } = getAuditContext(c);
  const user = c.get('user');
  const rawDB = c.env.DB;

  // Validation
  validateUUID(tenantId, 'tenantId');
  validateRequired(body, ['customDomain']);

  // Validate domain format
  if (!CloudflareSaaSClient.validateDomain(domain)) {
    throw new ValidationError('Invalid domain format', {
      domain,
      hint: 'Domain must be a valid FQDN (e.g., videos.example.com)',
    });
  }

  // Get tenant
  const tenant = await withRetry(() => db.getTenantById(tenantId));
  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId });
  }

  // Check if tenant already has a custom domain
  if (tenant.customDomain) {
    throw new ConflictError('Tenant already has a custom domain', {
      existingDomain: tenant.customDomain,
      hint: 'Delete the existing custom domain first',
    });
  }

  // Check if domain is already used by another tenant
  const existingTenant = await rawDB.prepare(
    'SELECT id, name FROM tenants WHERE custom_domain = ? AND id != ?'
  )
    .bind(domain, tenantId)
    .first();

  if (existingTenant) {
    throw new ConflictError('Domain already in use by another tenant', {
      domain,
      tenantId: existingTenant.id,
    });
  }

  // Add custom hostname to Cloudflare
  const cfClient = getCloudflareClient(c);
  let cfHostname;

  try {
    cfHostname = await cfClient.addCustomHostname(domain);
  } catch (error: any) {
    throw new ExternalAPIError('Failed to add custom hostname to Cloudflare', {
      error: error.message,
      hint: 'Check domain format and Cloudflare configuration',
    });
  }

  // Save to database
  const now = new Date().toISOString();
  await rawDB.prepare(`
    UPDATE tenants 
    SET 
      custom_domain = ?,
      custom_domain_status = ?,
      custom_domain_cloudflare_id = ?,
      custom_domain_ssl_status = ?,
      custom_domain_created_at = ?
    WHERE id = ?
  `)
    .bind(
      domain,
      'pending',
      cfHostname.id,
      cfHostname.ssl.status,
      now,
      tenantId
    )
    .run();

  // Log audit event
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.TENANT_UPDATE,
    userId: user?.id,
    tenantId,
    resourceType: 'custom_domain',
    resourceId: cfHostname.id,
    ipAddress,
    userAgent,
    details: {
      action: 'add_custom_domain',
      domain,
      cloudflareId: cfHostname.id,
    },
  });

  // Format validation instructions
  const fallbackOrigin = getFallbackOrigin(c);
  const validation = CloudflareSaaSClient.formatValidationInstructions(
    cfHostname,
    fallbackOrigin
  );

  return c.json({
    message: 'Custom domain added successfully',
    domain,
    status: 'pending',
    validation: {
      type: validation.type,
      name: validation.name,
      value: validation.value,
    },
    instructions: validation.instructions,
    ssl: {
      status: cfHostname.ssl.status,
      method: cfHostname.ssl.method,
    },
    cloudflareId: cfHostname.id,
  }, 201);
}));

// ============================================================================
// GET /api/v1/tenants/:id/domain - Get Custom Domain Status
// ============================================================================

customDomain.get('/:id/domain', asyncHandler(async (c) => {
  const tenantId = c.req.param('id');
  const db = c.get('db');
  const rawDB = c.env.DB;

  // Validation
  validateUUID(tenantId, 'tenantId');

  // Get tenant
  const tenant = await withRetry(() => db.getTenantById(tenantId));
  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId });
  }

  // Check if tenant has custom domain
  if (!tenant.customDomain || !tenant.customDomainCloudflareId) {
    return c.json({
      message: 'No custom domain configured',
      status: 'none',
    });
  }

  // Get status from Cloudflare
  const cfClient = getCloudflareClient(c);
  let cfHostname;

  try {
    cfHostname = await cfClient.getCustomHostname(tenant.customDomainCloudflareId);
  } catch (error: any) {
    throw new ExternalAPIError('Failed to get custom hostname status from Cloudflare', {
      error: error.message,
    });
  }

  // Map Cloudflare status to our internal status
  const status = mapCloudflareStatus(cfHostname.status, cfHostname.ssl.status);

  // Update database if status changed
  if (status !== tenant.customDomainStatus || cfHostname.ssl.status !== tenant.customDomainSslStatus) {
    const updates: string[] = [];
    const bindings: any[] = [];

    updates.push('custom_domain_status = ?');
    bindings.push(status);

    updates.push('custom_domain_ssl_status = ?');
    bindings.push(cfHostname.ssl.status);

    // If now active and wasn't before, set verified_at
    if (status === 'active' && tenant.customDomainStatus !== 'active') {
      updates.push('custom_domain_verified_at = ?');
      bindings.push(new Date().toISOString());
    }

    bindings.push(tenantId);

    await rawDB.prepare(`
      UPDATE tenants 
      SET ${updates.join(', ')}
      WHERE id = ?
    `)
      .bind(...bindings)
      .run();
  }

  return c.json({
    domain: tenant.customDomain,
    status,
    ssl: {
      status: cfHostname.ssl.status,
      method: cfHostname.ssl.method,
      certificate_authority: cfHostname.ssl.certificate_authority,
      validation_errors: cfHostname.ssl.validation_errors,
    },
    verification: {
      verified: status === 'active',
      verified_at: tenant.customDomainVerifiedAt,
      errors: cfHostname.verification_errors,
    },
    cloudflare: {
      id: cfHostname.id,
      hostname_status: cfHostname.status,
      created_at: cfHostname.created_at,
    },
  });
}));

// ============================================================================
// DELETE /api/v1/tenants/:id/domain - Remove Custom Domain
// ============================================================================

customDomain.delete('/:id/domain', asyncHandler(async (c) => {
  const tenantId = c.req.param('id');
  const db = c.get('db');
  const { ipAddress, userAgent } = getAuditContext(c);
  const user = c.get('user');
  const rawDB = c.env.DB;

  // Validation
  validateUUID(tenantId, 'tenantId');

  // Get tenant
  const tenant = await withRetry(() => db.getTenantById(tenantId));
  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId });
  }

  // Check if tenant has custom domain
  if (!tenant.customDomain || !tenant.customDomainCloudflareId) {
    throw new NotFoundError('Custom domain', { tenantId });
  }

  const domainToDelete = tenant.customDomain;
  const cloudflareId = tenant.customDomainCloudflareId;

  // Delete from Cloudflare
  const cfClient = getCloudflareClient(c);
  
  try {
    await cfClient.deleteCustomHostname(cloudflareId);
  } catch (error: any) {
    // Log error but continue - we want to clean up our DB even if CF fails
    console.error('[CLOUDFLARE_DELETE_ERROR]', {
      tenantId,
      domain: domainToDelete,
      cloudflareId,
      error: error.message,
    });
  }

  // Remove from database
  await rawDB.prepare(`
    UPDATE tenants 
    SET 
      custom_domain = NULL,
      custom_domain_status = 'none',
      custom_domain_cloudflare_id = NULL,
      custom_domain_ssl_status = NULL,
      custom_domain_verified_at = NULL,
      custom_domain_created_at = NULL
    WHERE id = ?
  `)
    .bind(tenantId)
    .run();

  // Log audit event
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.TENANT_UPDATE,
    userId: user?.id,
    tenantId,
    resourceType: 'custom_domain',
    resourceId: cloudflareId,
    ipAddress,
    userAgent,
    details: {
      action: 'remove_custom_domain',
      domain: domainToDelete,
      cloudflareId,
    },
  });

  return c.json({
    message: 'Custom domain removed successfully',
    domain: domainToDelete,
  });
}));

export default customDomain;
