/**
 * Authentication & Authorization Middleware
 * Multi-level role-based access control
 */

import { Context, Next } from 'hono';
import { verifyToken, extractToken, JWTPayload } from '../auth';
import { AuthenticationError, AuthorizationError } from '../error-handler';

/**
 * Authenticate user and attach payload to context
 * Required for all protected routes
 */
export async function authenticate(c: Context, next: Next) {
  const token = extractToken(c.req.header('Authorization'));
  
  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  const payload = await verifyToken(token);
  
  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  c.set('user', payload);
  await next();
}

/**
 * Require admin or super_admin role
 * Must be used after authenticate middleware
 */
export async function requireAdmin(c: Context, next: Next) {
  const user: JWTPayload = c.get('user');
  
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const allowedRoles = ['admin', 'super_admin'];
  
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      'Admin access required',
      { 
        requiredRole: 'admin or super_admin',
        userRole: user.role 
      }
    );
  }

  await next();
}

/**
 * Require super_admin role only
 * Must be used after authenticate middleware
 */
export async function requireSuperAdmin(c: Context, next: Next) {
  const user: JWTPayload = c.get('user');
  
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (user.role !== 'super_admin') {
    throw new AuthorizationError(
      'Super admin access required',
      { 
        requiredRole: 'super_admin',
        userRole: user.role 
      }
    );
  }

  await next();
}
