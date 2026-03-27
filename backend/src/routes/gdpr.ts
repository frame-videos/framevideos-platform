/**
 * GDPR Compliance Routes
 * Implements data export and right to be forgotten
 */

import { Hono } from 'hono';
import { D1Database } from '../database-d1';
import { verifyToken, extractToken } from '../auth';
import {
  asyncHandler,
  AuthenticationError,
  NotFoundError,
  FrameVideosError,
  ErrorCode,
} from '../error-handler';

type Bindings = {
  DB: any;
};

type Variables = {
  db: D1Database;
};

const gdpr = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Helper to verify authentication and get user
 */
async function authenticateUser(c: any): Promise<any> {
  const token = extractToken(c);
  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  const decoded = await verifyToken(token);
  if (!decoded || !decoded.userId) {
    throw new AuthenticationError('Invalid token');
  }

  const db = c.get('db');
  const user = await db.getUserById(decoded.userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check if user is soft-deleted
  if (user.deletedAt) {
    throw new AuthenticationError('User account has been deleted');
  }

  return user;
}

// ============================================================================
// Data Export (GDPR Article 15 - Right of Access)
// ============================================================================

gdpr.get('/users/me/data', asyncHandler(async (c) => {
  const user = await authenticateUser(c);
  const db = c.get('db');
  const rawDB = c.env.DB;

  // Collect all user data
  const userData: any = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
      privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt || null,
      termsAcceptedAt: user.termsAcceptedAt || null,
    },
    videos: [],
    analytics: [],
    favorites: [],
    comments: [],
  };

  // Get user's videos
  try {
    const videos = await rawDB
      .prepare('SELECT id, title, description, status, duration, url, thumbnail_url, created_at, updated_at FROM videos WHERE user_id = ? AND tenant_id = ?')
      .bind(user.id, user.tenantId)
      .all();
    userData.videos = videos.results || [];
  } catch (error) {
    console.error('Error fetching videos:', error);
  }

  // Get user's analytics events
  try {
    const analytics = await rawDB
      .prepare('SELECT id, video_id, event_type, metadata, created_at FROM analytics WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1000')
      .bind(user.id, user.tenantId)
      .all();
    userData.analytics = analytics.results || [];
  } catch (error) {
    console.error('Error fetching analytics:', error);
  }

  // Get user's favorites (if table exists)
  try {
    const favorites = await rawDB
      .prepare('SELECT video_id, created_at FROM favorites WHERE user_id = ?')
      .bind(user.id)
      .all();
    userData.favorites = favorites.results || [];
  } catch (error) {
    // Table might not exist, that's ok
  }

  // Get user's comments (if table exists)
  try {
    const comments = await rawDB
      .prepare('SELECT id, video_id, content, created_at FROM comments WHERE user_id = ?')
      .bind(user.id)
      .all();
    userData.comments = comments.results || [];
  } catch (error) {
    // Table might not exist, that's ok
  }

  return c.json({
    success: true,
    data: userData,
    exportedAt: new Date().toISOString(),
  });
}));

// ============================================================================
// Account Deletion (GDPR Article 17 - Right to be Forgotten)
// ============================================================================

gdpr.delete('/users/me/delete', asyncHandler(async (c) => {
  const user = await authenticateUser(c);
  const rawDB = c.env.DB;
  const now = new Date().toISOString();

  // Soft delete: mark user as deleted and anonymize personal data
  await rawDB
    .prepare(`
      UPDATE users 
      SET 
        deleted_at = ?,
        email = ?,
        name = ?,
        password = ?
      WHERE id = ? AND tenant_id = ?
    `)
    .bind(
      now,
      `deleted_${user.id}@anonymized.local`,
      'Deleted User',
      'DELETED',
      user.id,
      user.tenantId
    )
    .run();

  // Anonymize user's videos
  await rawDB
    .prepare(`
      UPDATE videos 
      SET 
        title = 'Deleted Video',
        description = 'This video has been deleted by the user'
      WHERE user_id = ? AND tenant_id = ?
    `)
    .bind(user.id, user.tenantId)
    .run();

  // Delete user's analytics data
  await rawDB
    .prepare('DELETE FROM analytics WHERE user_id = ? AND tenant_id = ?')
    .bind(user.id, user.tenantId)
    .run();

  // Delete user's favorites (if table exists)
  try {
    await rawDB
      .prepare('DELETE FROM favorites WHERE user_id = ?')
      .bind(user.id)
      .run();
  } catch (error) {
    // Table might not exist
  }

  // Anonymize user's comments (if table exists)
  try {
    await rawDB
      .prepare(`
        UPDATE comments 
        SET content = '[deleted]', user_id = NULL 
        WHERE user_id = ?
      `)
      .bind(user.id)
      .run();
  } catch (error) {
    // Table might not exist
  }

  // Delete login attempts
  try {
    await rawDB
      .prepare('DELETE FROM login_attempts WHERE email = ?')
      .bind(user.email)
      .run();
  } catch (error) {
    // Ignore
  }

  // Delete account lockouts
  try {
    await rawDB
      .prepare('DELETE FROM account_lockouts WHERE user_id = ?')
      .bind(user.id)
      .run();
  } catch (error) {
    // Ignore
  }

  return c.json({
    success: true,
    message: 'Your account has been deleted and your personal data has been anonymized',
    deletedAt: now,
  });
}));

export { gdpr };
