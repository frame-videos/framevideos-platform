/**
 * Tenant Isolation Security Layer
 * 
 * Ensures complete data isolation between tenants.
 * All database queries MUST go through these helpers.
 */

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

/**
 * Validates that a tenant ID is provided and not empty
 * @throws {TenantIsolationError} if tenant ID is missing or invalid
 */
export function ensureTenantId(tenantId: string | undefined | null, operation: string): asserts tenantId is string {
  if (!tenantId || tenantId.trim() === '') {
    throw new TenantIsolationError(
      `Tenant isolation violation: ${operation} requires a valid tenant_id. ` +
      `This operation cannot proceed without tenant context.`
    );
  }
}

/**
 * Validates that a resource belongs to the specified tenant
 * @throws {TenantIsolationError} if resource doesn't belong to tenant
 */
export function ensureTenantOwnership(
  resource: { tenant_id?: string; tenantId?: string } | null | undefined,
  tenantId: string,
  resourceType: string,
  resourceId: string
): void {
  if (!resource) {
    throw new TenantIsolationError(
      `Tenant isolation violation: ${resourceType} ${resourceId} not found`
    );
  }

  const resourceTenantId = resource.tenant_id || resource.tenantId;
  
  if (resourceTenantId !== tenantId) {
    throw new TenantIsolationError(
      `Tenant isolation violation: ${resourceType} ${resourceId} belongs to tenant ${resourceTenantId}, ` +
      `but tenant ${tenantId} attempted to access it`
    );
  }
}

/**
 * Validates that all resources in an array belong to the specified tenant
 */
export function ensureTenantOwnershipBulk(
  resources: Array<{ tenant_id?: string; tenantId?: string; id: string }>,
  tenantId: string,
  resourceType: string
): void {
  for (const resource of resources) {
    ensureTenantOwnership(resource, tenantId, resourceType, resource.id);
  }
}

/**
 * Security audit logger for tenant isolation violations
 */
export function logTenantViolationAttempt(
  tenantId: string,
  operation: string,
  targetTenantId: string | undefined,
  userId?: string
): void {
  console.error('[SECURITY] Tenant isolation violation attempt:', {
    timestamp: new Date().toISOString(),
    tenantId,
    operation,
    targetTenantId,
    userId,
    severity: 'HIGH',
  });
  
  // TODO: Enviar para sistema de monitoramento/alertas
  // TODO: Considerar rate limiting ou bloqueio temporário
}

/**
 * Validates that a query includes tenant isolation
 * Use for SQL query validation in development/testing
 */
export function validateQueryHasTenantFilter(sql: string, operation: string): void {
  const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ');
  
  // Check for tenant_id in WHERE clause
  if (!normalizedSql.includes('tenant_id') && !normalizedSql.includes('tenantid')) {
    console.warn(`[SECURITY WARNING] Query may be missing tenant isolation: ${operation}`);
    console.warn(`SQL: ${sql}`);
  }
}
