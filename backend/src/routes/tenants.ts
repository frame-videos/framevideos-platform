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
import { logAuditEvent, AuditEventType } from '../audit';
import { getAuditContext } from '../middleware/audit-context';

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
  const { ipAddress, userAgent } = getAuditContext(c);
  const user = c.get('user');
  const rawDB = c.env.DB;

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

  // Audit log
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.TENANT_CREATE,
    userId: user?.id,
    tenantId: tenant.id,
    resourceType: 'tenant',
    resourceId: tenant.id,
    ipAddress,
    userAgent,
    details: {
      name: tenant.name,
      domain: tenant.domain,
    },
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

// ============================================================================
// Suspend Tenant
// ============================================================================

tenants.post('/:id/suspend', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { reason } = body;
  const db = c.get('db');
  const { ipAddress, userAgent } = getAuditContext(c);
  const user = c.get('user');
  const rawDB = c.env.DB;

  // Validate UUID
  validateUUID(id, 'tenantId');

  // Get tenant
  const tenant = await withRetry(() => db.getTenantById(id));
  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId: id });
  }

  // Check current status
  if (tenant.status === 'suspended') {
    throw new ValidationError('Tenant is already suspended');
  }

  if (tenant.status === 'cancelled') {
    throw new ValidationError('Cannot suspend cancelled tenant');
  }

  const now = new Date().toISOString();
  const previousStatus = tenant.status;

  // Update tenant status
  await withRetry(() => db.updateTenantStatus(id, 'suspended', {
    suspendedAt: now,
    suspendedReason: reason || 'No reason provided',
    reactivatedAt: null,
  }));

  // Log lifecycle event
  await withRetry(() => db.logTenantLifecycleEvent({
    id: crypto.randomUUID(),
    tenantId: id,
    action: 'suspended',
    previousStatus,
    newStatus: 'suspended',
    reason: reason || 'No reason provided',
    performedBy: user?.id,
    ipAddress,
    createdAt: now,
  }));

  // Audit log
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.TENANT_SUSPEND,
    userId: user?.id,
    tenantId: id,
    resourceType: 'tenant',
    resourceId: id,
    ipAddress,
    userAgent,
    details: {
      reason: reason || 'No reason provided',
      previousStatus,
    },
  });

  console.log('[TENANT_SUSPENDED]', {
    timestamp: now,
    tenantId: id,
    reason: reason || 'No reason provided',
    performedBy: user?.id,
  });

  // Get updated tenant
  const updatedTenant = await withRetry(() => db.getTenantById(id));

  return c.json({
    message: 'Tenant suspended successfully',
    tenant: updatedTenant,
  });
}));

// ============================================================================
// Reactivate Tenant
// ============================================================================

tenants.post('/:id/reactivate', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  const { ipAddress, userAgent } = getAuditContext(c);
  const user = c.get('user');
  const rawDB = c.env.DB;

  // Validate UUID
  validateUUID(id, 'tenantId');

  // Get tenant
  const tenant = await withRetry(() => db.getTenantById(id));
  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId: id });
  }

  // Check current status
  if (tenant.status === 'active') {
    throw new ValidationError('Tenant is already active');
  }

  if (tenant.status === 'cancelled') {
    throw new ValidationError('Cannot reactivate cancelled tenant');
  }

  const now = new Date().toISOString();
  const previousStatus = tenant.status;

  // Update tenant status
  await withRetry(() => db.updateTenantStatus(id, 'active', {
    suspendedAt: null,
    suspendedReason: null,
    reactivatedAt: now,
  }));

  // Log lifecycle event
  await withRetry(() => db.logTenantLifecycleEvent({
    id: crypto.randomUUID(),
    tenantId: id,
    action: 'reactivated',
    previousStatus,
    newStatus: 'active',
    performedBy: user?.id,
    ipAddress,
    createdAt: now,
  }));

  // Audit log
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.TENANT_REACTIVATE,
    userId: user?.id,
    tenantId: id,
    resourceType: 'tenant',
    resourceId: id,
    ipAddress,
    userAgent,
    details: {
      previousStatus,
    },
  });

  console.log('[TENANT_REACTIVATED]', {
    timestamp: now,
    tenantId: id,
    performedBy: user?.id,
  });

  // Get updated tenant
  const updatedTenant = await withRetry(() => db.getTenantById(id));

  return c.json({
    message: 'Tenant reactivated successfully',
    tenant: updatedTenant,
  });
}));

// ============================================================================
// Cancel Tenant
// ============================================================================

tenants.post('/:id/cancel', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { reason } = body;
  const db = c.get('db');
  const { ipAddress, userAgent } = getAuditContext(c);
  const user = c.get('user');
  const rawDB = c.env.DB;

  // Validate UUID
  validateUUID(id, 'tenantId');

  // Get tenant
  const tenant = await withRetry(() => db.getTenantById(id));
  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId: id });
  }

  // Check current status
  if (tenant.status === 'cancelled') {
    throw new ValidationError('Tenant is already cancelled');
  }

  const now = new Date().toISOString();
  const previousStatus = tenant.status;

  // Update tenant status
  await withRetry(() => db.updateTenantStatus(id, 'cancelled', {
    cancelledAt: now,
    cancelledReason: reason || 'No reason provided',
    suspendedAt: null,
    suspendedReason: null,
  }));

  // Log lifecycle event
  await withRetry(() => db.logTenantLifecycleEvent({
    id: crypto.randomUUID(),
    tenantId: id,
    action: 'cancelled',
    previousStatus,
    newStatus: 'cancelled',
    reason: reason || 'No reason provided',
    performedBy: user?.id,
    ipAddress,
    createdAt: now,
  }));

  // Audit log
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.TENANT_CANCEL,
    userId: user?.id,
    tenantId: id,
    resourceType: 'tenant',
    resourceId: id,
    ipAddress,
    userAgent,
    details: {
      reason: reason || 'No reason provided',
      previousStatus,
    },
  });

  console.log('[TENANT_CANCELLED]', {
    timestamp: now,
    tenantId: id,
    reason: reason || 'No reason provided',
    performedBy: user?.id,
  });

  // Get updated tenant
  const updatedTenant = await withRetry(() => db.getTenantById(id));

  return c.json({
    message: 'Tenant cancelled successfully',
    tenant: updatedTenant,
  });
}));

// ============================================================================
// Get Tenant Lifecycle Log
// ============================================================================

tenants.get('/:id/lifecycle-log', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');

  // Validate UUID
  validateUUID(id, 'tenantId');

  // Get tenant to verify it exists
  const tenant = await withRetry(() => db.getTenantById(id));
  if (!tenant) {
    throw new NotFoundError('Tenant', { tenantId: id });
  }

  // Get lifecycle log
  const logs = await withRetry(() => db.getTenantLifecycleLog(id));

  return c.json({
    tenantId: id,
    logs,
  });
}));

export default tenants;
