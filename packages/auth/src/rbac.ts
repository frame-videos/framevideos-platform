// RBAC — Role-Based Access Control
// Mapa de permissões por role, middleware Hono pra enforcement

import type { Context, Next } from 'hono';
import { UserRole } from '@frame-videos/shared/types';
import { ForbiddenError, UnauthorizedError } from '@frame-videos/shared/errors';

/**
 * Recursos do sistema.
 */
export type Resource =
  | 'tenant'
  | 'user'
  | 'video'
  | 'category'
  | 'tag'
  | 'performer'
  | 'channel'
  | 'page'
  | 'domain'
  | 'subscription'
  | 'plan'
  | 'llm_wallet'
  | 'ad_campaign'
  | 'ad_creative'
  | 'crawler'
  | 'audit_log'
  | 'settings';

/**
 * Ações possíveis sobre recursos.
 */
export type Action = 'create' | 'read' | 'update' | 'delete' | 'list' | 'manage';

/**
 * Mapa de permissões: role → resource → ações permitidas.
 * "manage" implica todas as ações.
 */
const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  // Super admin pode tudo
  super_admin: {
    tenant: ['manage'],
    user: ['manage'],
    video: ['manage'],
    category: ['manage'],
    tag: ['manage'],
    performer: ['manage'],
    channel: ['manage'],
    page: ['manage'],
    domain: ['manage'],
    subscription: ['manage'],
    plan: ['manage'],
    llm_wallet: ['manage'],
    ad_campaign: ['manage'],
    ad_creative: ['manage'],
    crawler: ['manage'],
    audit_log: ['manage'],
    settings: ['manage'],
  },

  // Admin do tenant — gerencia tudo dentro do tenant
  tenant_admin: {
    tenant: ['read', 'update'],
    user: ['manage'],
    video: ['manage'],
    category: ['manage'],
    tag: ['manage'],
    performer: ['manage'],
    channel: ['manage'],
    page: ['manage'],
    domain: ['manage'],
    subscription: ['read', 'update'],
    llm_wallet: ['read'],
    ad_campaign: ['manage'],
    ad_creative: ['manage'],
    crawler: ['manage'],
    audit_log: ['read', 'list'],
    settings: ['read', 'update'],
  },

  // Usuário do tenant — acesso limitado a conteúdo
  tenant_user: {
    video: ['create', 'read', 'update', 'list'],
    category: ['read', 'list'],
    tag: ['read', 'list', 'create'],
    performer: ['read', 'list'],
    channel: ['read', 'list'],
    page: ['read', 'list'],
  },

  // Anunciante — acesso apenas a campanhas e criativos
  advertiser: {
    ad_campaign: ['create', 'read', 'update', 'list'],
    ad_creative: ['create', 'read', 'update', 'list'],
  },
};

/**
 * Verifica se um role tem permissão pra uma ação em um recurso.
 */
export function hasPermission(
  role: UserRole,
  action: Action,
  resource: Resource,
): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;

  const resourceActions = rolePermissions[resource];
  if (!resourceActions) return false;

  return resourceActions.includes('manage') || resourceActions.includes(action);
}

/**
 * Middleware Hono que exige permissão específica.
 * Usa o userRole do context (injetado pelo authMiddleware).
 */
export function requirePermission(action: Action, resource: Resource) {
  return async (c: Context, next: Next) => {
    const userRole = c.get('userRole') as UserRole | undefined;

    if (!userRole) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!hasPermission(userRole, action, resource)) {
      throw new ForbiddenError(
        `Permission denied: ${action} on ${resource} requires higher privileges`,
      );
    }

    await next();
  };
}
