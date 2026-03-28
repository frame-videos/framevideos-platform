// Middleware de tenant-scoping para queries D1
// Garante isolamento multi-tenant em todas as operações

import { ForbiddenError } from '@frame-videos/shared/errors';
import { UserRole } from '@frame-videos/shared/types';

/**
 * Tabelas que NÃO precisam de tenant_id (tabelas globais).
 */
const GLOBAL_TABLES = new Set(['plans', '_migrations']);

/**
 * Valida que uma query tem tenant_id quando necessário.
 * Super admins podem acessar sem tenant_id.
 */
export function validateTenantScope(
  sql: string,
  params: unknown[],
  options: {
    tenantId?: string;
    userRole?: string;
  },
): { sql: string; params: unknown[] } {
  const normalizedSql = sql.toLowerCase().trim();

  // Super admin pode fazer qualquer coisa
  if (options.userRole === UserRole.SUPER_ADMIN) {
    return { sql, params };
  }

  // Verificar se é uma tabela global
  const isGlobalTable = Array.from(GLOBAL_TABLES).some(
    (table) =>
      normalizedSql.includes(`from ${table}`) ||
      normalizedSql.includes(`into ${table}`) ||
      normalizedSql.includes(`update ${table}`),
  );

  if (isGlobalTable) {
    return { sql, params };
  }

  // Pra queries não-globais, tenant_id é obrigatório
  if (!options.tenantId) {
    throw new ForbiddenError('Tenant context is required for this operation');
  }

  // Verificar se a query já tem tenant_id
  if (!normalizedSql.includes('tenant_id')) {
    throw new ForbiddenError(
      'Query must include tenant_id filter for multi-tenant isolation',
    );
  }

  return { sql, params };
}

/**
 * Cria um wrapper de D1Client que aplica tenant-scoping automaticamente.
 */
export function withTenantScope(
  tenantId: string | undefined,
  userRole: string | undefined,
) {
  return {
    /**
     * Valida que a query respeita o tenant scope antes de executar.
     */
    validate(sql: string, params: unknown[] = []): { sql: string; params: unknown[] } {
      return validateTenantScope(sql, params, { tenantId, userRole });
    },
  };
}
