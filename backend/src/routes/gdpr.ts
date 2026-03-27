import { Hono } from 'hono';
import { authenticate } from '../middleware/auth';
import { getUserData, softDeleteUser } from '../database-d1';
import { asyncHandler } from '../error-handler';

type Bindings = {
  DB: any;
};

const gdpr = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to all GDPR routes
gdpr.use('*', authenticate);

/**
 * GET /api/v1/users/me/data
 * Export all user data (GDPR Right to Data Portability)
 */
gdpr.get('/users/me/data', asyncHandler(async (c) => {
  const user = c.get('user');
  const userId = user?.sub;
  
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userData = await getUserData(c.env.DB, userId);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Return complete user data export
  return c.json({
    export_date: new Date().toISOString(),
    user: userData,
  });
}));

/**
 * DELETE /api/v1/users/me/delete
 * Soft delete user account + anonymize data (GDPR Right to be Forgotten)
 */
gdpr.delete('/users/me/delete', asyncHandler(async (c) => {
  const user = c.get('user');
  const userId = user?.sub;
  
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await softDeleteUser(c.env.DB, userId);
  
  if (!result) {
    return c.json({ error: 'User not found or already deleted' }, 404);
  }

  return c.json({
    message: 'Account successfully deleted',
    deleted_at: result.deleted_at,
  });
}));

export default gdpr;
