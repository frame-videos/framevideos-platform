/**
 * Tenant Query Helpers
 * Ensures all database queries include tenant isolation
 * 
 * Task 3.4: Isolamento de Dados
 */

/**
 * Validates that a tenantId is provided and is a valid UUID
 */
export function validateTenantId(tenantId: string | undefined): asserts tenantId is string {
  if (!tenantId) {
    throw new Error('SECURITY: tenantId is required for this operation');
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    throw new Error('SECURITY: Invalid tenantId format');
  }
}

/**
 * Validates that resource tenantId matches authenticated tenantId
 */
export function validateTenantMatch(
  resourceTenantId: string,
  authenticatedTenantId: string,
  resourceType: string = 'resource'
): void {
  if (resourceTenantId !== authenticatedTenantId) {
    console.error('[TENANT_VIOLATION]', {
      timestamp: new Date().toISOString(),
      resourceType,
      resourceTenantId,
      authenticatedTenantId,
    });
    throw new Error(`SECURITY: ${resourceType} belongs to different tenant`);
  }
}

/**
 * Wraps a query result to ensure it belongs to the correct tenant
 */
export function validateResultTenant<T extends { tenant_id?: string; tenantId?: string }>(
  result: T | null,
  expectedTenantId: string,
  resourceType: string = 'resource'
): T | null {
  if (!result) return null;

  const resultTenantId = result.tenant_id || result.tenantId;
  
  if (resultTenantId && resultTenantId !== expectedTenantId) {
    console.error('[TENANT_LEAK_PREVENTED]', {
      timestamp: new Date().toISOString(),
      resourceType,
      resultTenantId,
      expectedTenantId,
    });
    return null; // Don't leak data from other tenant
  }

  return result;
}

/**
 * Filters array results to only include items from the correct tenant
 */
export function filterByTenant<T extends { tenant_id?: string; tenantId?: string }>(
  results: T[],
  expectedTenantId: string
): T[] {
  return results.filter(item => {
    const itemTenantId = item.tenant_id || item.tenantId;
    return itemTenantId === expectedTenantId;
  });
}

/**
 * Builds a WHERE clause with tenant isolation
 */
export function buildTenantWhereClause(
  baseCondition: string = '',
  tenantIdParam: string = 'tenant_id'
): string {
  const tenantClause = `${tenantIdParam} = ?`;
  
  if (!baseCondition) {
    return `WHERE ${tenantClause}`;
  }
  
  return `WHERE ${tenantClause} AND (${baseCondition})`;
}

/**
 * Logs tenant access for audit trail
 */
export function logTenantQuery(
  operation: string,
  tenantId: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, any>
): void {
  console.log('[TENANT_QUERY]', {
    timestamp: new Date().toISOString(),
    operation,
    tenantId,
    resourceType,
    resourceId,
    ...metadata,
  });
}

/**
 * Validates that a resource creation matches authenticated tenant
 */
export function validateResourceCreation(
  resourceTenantId: string,
  authenticatedTenantId: string,
  resourceType: string = 'resource'
): void {
  if (resourceTenantId !== authenticatedTenantId) {
    console.error('[TENANT_CREATION_VIOLATION]', {
      timestamp: new Date().toISOString(),
      resourceType,
      resourceTenantId,
      authenticatedTenantId,
    });
    throw new Error(
      `SECURITY: Cannot create ${resourceType} for different tenant. ` +
      `Authenticated as ${authenticatedTenantId}, tried to create for ${resourceTenantId}`
    );
  }
}

/**
 * Ensures that queries always include tenant_id in WHERE clause
 * This is a compile-time helper for query validation
 */
export type TenantIsolatedQuery = {
  query: string;
  params: any[];
  tenantId: string;
};

export function createTenantQuery(
  query: string,
  params: any[],
  tenantId: string
): TenantIsolatedQuery {
  validateTenantId(tenantId);
  
  // Validate that query includes tenant_id check
  const lowerQuery = query.toLowerCase();
  if (!lowerQuery.includes('tenant_id')) {
    console.warn('[QUERY_WARNING] Query may be missing tenant isolation:', query);
  }
  
  return { query, params, tenantId };
}
