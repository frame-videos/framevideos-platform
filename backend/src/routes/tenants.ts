import { Hono } from 'hono';
import { Tenant } from '../database';
import { D1Database } from '../database-d1';
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  ConflictError,
  validateRequired,
  validateUUID,
  withRetry,
} from '../error-handler';
import { authenticate, requireSuperAdmin } from '../middleware/auth';

type Variables = {
  db: D1Database;
};

const tenants = new Hono<{ Variables: Variables }>();

// Apply super_admin middleware to all tenant routes
tenants.use('*', authenticate, requireSuperAdmin);

// ============================================================================
// Create Tenant
// ============================================================================

tenants.post('/', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { name, domain } = body;
  const db = c.get('db');

  // Validation
  validateRequired(body, ['name', 'domain']);

  // Check if domain exists (with retry)
  const existingTenant = await withRetry(() => db.getTenantByDomain(domain));
  
  if (existingTenant) {
    throw new ConflictError('Domain already exists', { domain });
  }

  const tenant: Tenant = {
    id: crypto.randomUUID(),
    name,
    domain,
    createdAt: new Date().toISOString(),
  };

  await withRetry(() => db.createTenant(tenant));

  // Log tenant creation
  console.log('[TENANT_CREATED]', {
    timestamp: new Date().toISOString(),
    tenantId: tenant.id,
    name: tenant.name,
    domain: tenant.domain,
  });

  return c.json({
    message: 'Tenant created successfully',
    tenant,
  }, 201);
}));

// ============================================================================
// Get Tenant by Domain
// ============================================================================

tenants.get('/domain/:domain', asyncHandler(async (c) => {
  const domain = c.req.param('domain');
  const db = c.get('db');
  
  // Get tenant with retry
  const tenant = await withRetry(() => db.getTenantByDomain(domain));

  if (!tenant) {
    throw new NotFoundError('Tenant', { domain });
  }

  return c.json(tenant);
}));

// ============================================================================
// Get Tenant by ID
// ============================================================================

tenants.get('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  
  // Validate UUID format
  validateUUID(id, 'tenantId');
  
  // Get tenant with retry
  const tenant = await withRetry(() => db.getTenantById(id));

  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId: id });
  }

  return c.json(tenant);
}));

export default tenants;
