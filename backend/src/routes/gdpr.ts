import { Hono } from 'hono';
import { verifyToken, extractToken } from '../auth';
import { D1Database } from '../database-d1';
import {
  asyncHandler,
  AuthenticationError,
  withRetry,
} from '../error-handler';

type Variables = {
  db: D1Database;
};

const gdpr = new Hono<{ Variables: Variables }>();

// ============================================================================
// Authentication Middleware
// ============================================================================

async function authenticate(c: any, next: any) {
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

// ============================================================================
// Export User Data (GDPR Article 15 - Right to Access)
// ============================================================================

gdpr.get('/users/me/data', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  // Get user data
  const userData = await withRetry(() => db.getUserById(user.sub));
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get user's videos
  const videos = await withRetry(() => db.getVideosByUser(user.sub));

  // Get tenant data
  const tenant = await withRetry(() => db.getTenantById(userData.tenantId));

  // Prepare export
  const exportData = {
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      createdAt: userData.createdAt,
      privacyPolicyAcceptedAt: userData.privacyPolicyAcceptedAt,
      termsAcceptedAt: userData.termsAcceptedAt,
    },
    tenant: tenant ? {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      createdAt: tenant.createdAt,
    } : null,
    videos: videos.map(v => ({
      id: v.id,
      title: v.title,
      description: v.description,
      url: v.url,
      views: v.views,
      createdAt: v.createdAt,
    })),
    exportedAt: new Date().toISOString(),
  };

  return c.json(exportData);
}));

// ============================================================================
// Delete User Account (GDPR Article 17 - Right to be Forgotten)
// ============================================================================

gdpr.delete('/users/me/delete', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  // Soft delete user
  await withRetry(() => db.softDeleteUser(user.sub));

  return c.json({
    message: 'Your account has been deleted. All personal data will be anonymized within 30 days.',
    deletedAt: new Date().toISOString(),
  });
}));

export default gdpr;
