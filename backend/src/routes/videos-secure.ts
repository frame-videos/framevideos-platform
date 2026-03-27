import { Hono } from 'hono';
import { Video } from '../database';
import { tenantIsolation, getTenantContext, validateTenantOwnership } from '../middleware/tenant-isolation';
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  validateRequired,
  validateUUID,
  withRetry,
} from '../error-handler';
import { analyticsDb } from '../analytics';
import { D1Database } from '../database-d1';
import { logAuditEvent, AuditEventType } from '../audit';
import { getAuditContext } from '../middleware/audit-context';

type Variables = {
  db: D1Database;
};

const videos = new Hono<{ Variables: Variables }>();

// Apply tenant isolation middleware to ALL routes
videos.use('*', tenantIsolation);

// ============================================================================
// Get All Videos
// ============================================================================

videos.get('/', asyncHandler(async (c) => {
  const db = c.get('db');
  const { tenantId } = getTenantContext(c);
  
  // Get videos with retry
  const tenantVideos = await withRetry(() => db.getVideosByTenant(tenantId));
  
  return c.json({
    videos: tenantVideos,
    total: tenantVideos.length,
  });
}));

// ============================================================================
// Get Single Video
// ============================================================================

videos.get('/:id', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { tenantId } = getTenantContext(c);
  
  // Validate UUID format
  validateUUID(id, 'videoId');
  
  // Row-level security: getVideoById validates tenantId (with retry)
  const video = await withRetry(() => db.getVideoById(id, tenantId));

  if (!video) {
    throw new NotFoundError('Video', { videoId: id, tenantId });
  }

  // Increment views in both database and analytics (with retry)
  await withRetry(() => db.incrementVideoViews(id, tenantId));
  await withRetry(() => analyticsDb.incrementViews(id, tenantId));

  return c.json(video);
}));

// ============================================================================
// Create Video
// ============================================================================

videos.post('/', asyncHandler(async (c) => {
  const db = c.get('db');
  const { tenantId, userId } = getTenantContext(c);
  const body = await c.req.json();
  const { title, description, url, thumbnailUrl, duration } = body;

  // Validation
  validateRequired(body, ['title', 'url']);

  const video: Video = {
    id: crypto.randomUUID(),
    tenantId, // Use authenticated tenant ID
    title,
    description: description || '',
    url,
    thumbnailUrl: thumbnailUrl || '',
    duration: duration || 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };

  // Row-level security: createVideo validates tenantId (with retry)
  await withRetry(() => db.createVideo(video, tenantId));

  // Log creation
  console.log('[VIDEO_CREATED]', {
    timestamp: new Date().toISOString(),
    videoId: video.id,
    tenantId,
    userId,
  });

  return c.json({
    message: 'Video created successfully',
    video,
  }, 201);
}));

// ============================================================================
// Update Video
// ============================================================================

videos.put('/:id', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { tenantId, userId } = getTenantContext(c);
  
  // Validate UUID format
  validateUUID(id, 'videoId');
  
  // Row-level security: getVideoById validates tenantId (with retry)
  const video = await withRetry(() => db.getVideoById(id, tenantId));

  if (!video) {
    throw new NotFoundError('Video', { videoId: id, tenantId });
  }

  // Additional validation (already checked by getVideoById)
  validateTenantOwnership(c, video.tenantId);

  const updates = await c.req.json();
  
  // Row-level security: updateVideo validates tenantId (with retry)
  const updated = await withRetry(() => db.updateVideo(id, updates, tenantId));

  // Log update
  console.log('[VIDEO_UPDATED]', {
    timestamp: new Date().toISOString(),
    videoId: id,
    tenantId,
    userId,
    updates: Object.keys(updates),
  });

  return c.json({
    message: 'Video updated successfully',
    video: updated,
  });
}));

// ============================================================================
// Delete Video
// ============================================================================

videos.delete('/:id', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { tenantId, userId } = getTenantContext(c);
  const { ipAddress, userAgent } = getAuditContext(c);
  const rawDB = c.env.DB;
  
  // Validate UUID format
  validateUUID(id, 'videoId');
  
  // Row-level security: getVideoById validates tenantId (with retry)
  const video = await withRetry(() => db.getVideoById(id, tenantId));

  if (!video) {
    throw new NotFoundError('Video', { videoId: id, tenantId });
  }

  // Additional validation (already checked by getVideoById)
  validateTenantOwnership(c, video.tenantId);

  // Row-level security: deleteVideo validates tenantId (with retry)
  await withRetry(() => db.deleteVideo(id, tenantId));

  // Log deletion
  console.log('[VIDEO_DELETED]', {
    timestamp: new Date().toISOString(),
    videoId: id,
    tenantId,
    userId,
  });

  // Audit log
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.VIDEO_DELETE,
    userId,
    tenantId,
    resourceType: 'video',
    resourceId: id,
    ipAddress,
    userAgent,
    details: {
      title: video.title,
      url: video.url,
    },
  });

  return c.json({
    message: 'Video deleted successfully',
  });
}));

// ============================================================================
// Video Categories
// ============================================================================

videos.post('/:id/categories', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { tenantId } = getTenantContext(c);
  
  validateUUID(id, 'videoId');
  
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError('Video', { videoId: id });
  }

  const body = await c.req.json();
  const { categoryIds } = body;

  if (!categoryIds || !Array.isArray(categoryIds)) {
    throw new ValidationError('categoryIds must be an array');
  }

  await withRetry(() => db.setVideoCategories(id, categoryIds));

  const categories = await withRetry(() => db.getVideoCategories(id));

  return c.json({
    message: 'Video categories updated',
    categories,
  });
}));

videos.delete('/:id/categories/:catId', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const catId = c.req.param('catId');
  const { tenantId } = getTenantContext(c);
  
  validateUUID(id, 'videoId');
  validateUUID(catId, 'categoryId');
  
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError('Video', { videoId: id });
  }

  await withRetry(() => db.removeVideoCategory(id, catId));

  return c.json({ message: 'Category removed from video' });
}));

videos.get('/:id/categories', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { tenantId } = getTenantContext(c);
  
  validateUUID(id, 'videoId');
  
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError('Video', { videoId: id });
  }

  const categories = await withRetry(() => db.getVideoCategories(id));

  return c.json({ categories });
}));

// ============================================================================
// Video Tags
// ============================================================================

videos.post('/:id/tags', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { tenantId } = getTenantContext(c);
  
  validateUUID(id, 'videoId');
  
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError('Video', { videoId: id });
  }

  const body = await c.req.json();
  const { tagIds } = body;

  if (!tagIds || !Array.isArray(tagIds)) {
    throw new ValidationError('tagIds must be an array');
  }

  await withRetry(() => db.setVideoTags(id, tagIds));

  const videoTags = await withRetry(() => db.getVideoTags(id));

  return c.json({
    message: 'Video tags updated',
    tags: videoTags,
  });
}));

videos.delete('/:id/tags/:tagId', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const tagId = c.req.param('tagId');
  const { tenantId } = getTenantContext(c);
  
  validateUUID(id, 'videoId');
  validateUUID(tagId, 'tagId');
  
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError('Video', { videoId: id });
  }

  await withRetry(() => db.removeVideoTag(id, tagId));

  return c.json({ message: 'Tag removed from video' });
}));

videos.get('/:id/tags', asyncHandler(async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { tenantId } = getTenantContext(c);
  
  validateUUID(id, 'videoId');
  
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError('Video', { videoId: id });
  }

  const videoTags = await withRetry(() => db.getVideoTags(id));

  return c.json({ tags: videoTags });
}));

export default videos;
