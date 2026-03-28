// Middleware de autenticação Hono
// Verifica JWT e injeta user info no context

import type { Context, Next } from 'hono';
import { UnauthorizedError } from '@frame-videos/shared/errors';
import { verifyToken } from './jwt.js';

/**
 * Extrai o Bearer token do header Authorization.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1] ?? null;
}

/**
 * Middleware de autenticação obrigatória.
 * Verifica o JWT, extrai payload e injeta no context:
 * - requestId (se ainda não existir)
 * - userId
 * - tenantId
 * - userRole
 *
 * Rejeita com 401 se o token for inválido ou ausente.
 */
export function authMiddleware(jwtSecretKey: string) {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header('Authorization'));

    if (!token) {
      throw new UnauthorizedError('Missing authentication token');
    }

    const payload = await verifyToken(token, jwtSecretKey);

    if (!payload) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    // Injetar dados do usuário no context
    c.set('userId', payload.sub);
    c.set('tenantId', payload.tid);
    c.set('userRole', payload.role);

    await next();
  };
}

/**
 * Middleware de autenticação opcional.
 * Se o token estiver presente e válido, injeta user info.
 * Se ausente ou inválido, continua sem autenticação (não rejeita).
 */
export function optionalAuth(jwtSecretKey: string) {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header('Authorization'));

    if (token) {
      const payload = await verifyToken(token, jwtSecretKey);
      if (payload) {
        c.set('userId', payload.sub);
        c.set('tenantId', payload.tid);
        c.set('userRole', payload.role);
      }
    }

    await next();
  };
}
