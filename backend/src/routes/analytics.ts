/**
 * Analytics Routes
 * Tracks views, likes, and provides analytics dashboard
 */

import { Hono } from 'hono';
import { verifyToken, extractToken } from '../auth';
import { D1Database } from '../database-d1';
import {
  asyncHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  validateRequired,
  validateUUID,
  withRetry,
} from '../error-handler';

type Variables = {
  db: D1Database;
};

const analytics = new Hono<{ Variables: Variables }>();

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
// Get Video Analytics
// ============================================================================

analytics.get('/videos/:id', authenticate, asyncHandler(async (c) => {
  const videoId = c.req.param('id');
  const user = c.get('user');
  
  validateUUID(videoId, 'videoId');

  // Get video (with retry)
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }

  // Check authorization
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId });
  }

  // Return analytics
  return c.json({
    videoId,
    title: video.title,
    views: video.views || 0,
    likes: video.likes || 0,
    comments: video.comments || 0,
    shares: video.shares || 0,
    engagementRate:
      ((video.likes || 0) + (video.comments || 0)) /
      Math.max(video.views || 1, 1),
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  });
}));

// ============================================================================
// Track View
// ============================================================================

analytics.post('/videos/:id/view', asyncHandler(async (c) => {
  const db = c.get('db');
  const videoId = c.req.param('id');
  const body = await c.req.json();
  const { sessionId } = body;

  validateUUID(videoId, 'videoId');

  // Get video (with retry)
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }

  // Increment views
  const updatedVideo = await withRetry(() =>
    db.updateVideo(videoId, {
      views: (video.views || 0) + 1,
    })
  );

  console.log('[VIDEO_VIEW_TRACKED]', {
    timestamp: new Date().toISOString(),
    videoId,
    sessionId,
    totalViews: updatedVideo.views,
  });

  return c.json({
    message: 'View tracked successfully',
    videoId,
    views: updatedVideo.views,
  });
}));

// ============================================================================
// Track Like
// ============================================================================

analytics.post('/videos/:id/like', authenticate, asyncHandler(async (c) => {
  const videoId = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();
  const { liked } = body;

  validateUUID(videoId, 'videoId');

  // Get video (with retry)
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }

  // Check authorization
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId });
  }

  // Update likes
  const currentLikes = video.likes || 0;
  const newLikes = liked ? currentLikes + 1 : Math.max(currentLikes - 1, 0);

  const updatedVideo = await withRetry(() =>
    db.updateVideo(videoId, {
      likes: newLikes,
    })
  );

  console.log('[VIDEO_LIKE_TOGGLED]', {
    timestamp: new Date().toISOString(),
    videoId,
    userId: user.userId,
    liked,
    totalLikes: updatedVideo.likes,
  });

  return c.json({
    message: 'Like tracked successfully',
    videoId,
    likes: updatedVideo.likes,
    liked,
  });
}));

// ============================================================================
// Track Comment
// ============================================================================

analytics.post('/videos/:id/comment', authenticate, asyncHandler(async (c) => {
  const videoId = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();
  const { comment } = body;

  validateUUID(videoId, 'videoId');
  validateRequired(body, ['comment']);

  // Get video (with retry)
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }

  // Check authorization
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId });
  }

  // Increment comments
  const updatedVideo = await withRetry(() =>
    db.updateVideo(videoId, {
      comments: (video.comments || 0) + 1,
    })
  );

  console.log('[VIDEO_COMMENT_ADDED]', {
    timestamp: new Date().toISOString(),
    videoId,
    userId: user.userId,
    totalComments: updatedVideo.comments,
  });

  return c.json({
    message: 'Comment tracked successfully',
    videoId,
    comments: updatedVideo.comments,
  });
}));

// ============================================================================
// Track Share
// ============================================================================

analytics.post('/videos/:id/share', asyncHandler(async (c) => {
  const db = c.get('db');
  const videoId = c.req.param('id');
  const body = await c.req.json();
  const { platform } = body;

  validateUUID(videoId, 'videoId');
  validateRequired(body, ['platform']);

  // Get video (with retry)
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }

  // Increment shares
  const updatedVideo = await withRetry(() =>
    db.updateVideo(videoId, {
      shares: (video.shares || 0) + 1,
    })
  );

  console.log('[VIDEO_SHARE_TRACKED]', {
    timestamp: new Date().toISOString(),
    videoId,
    platform,
    totalShares: updatedVideo.shares,
  });

  return c.json({
    message: 'Share tracked successfully',
    videoId,
    shares: updatedVideo.shares,
    platform,
  });
}));

// ============================================================================
// Get Dashboard Analytics
// ============================================================================

analytics.get('/dashboard', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');

  // Get all videos for tenant (with retry)
  const videos = await withRetry(() =>
    db.getVideosByTenant(user.tenantId)
  );

  // Calculate aggregate metrics
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0);
  const totalComments = videos.reduce((sum, v) => sum + (v.comments || 0), 0);
  const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);

  const engagementRate =
    (totalLikes + totalComments) / Math.max(totalViews, 1);

  // Top videos by views
  const topVideosByViews = videos
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10)
    .map((v) => ({
      id: v.id,
      title: v.title,
      views: v.views || 0,
      likes: v.likes || 0,
      comments: v.comments || 0,
      shares: v.shares || 0,
    }));

  // Top videos by engagement
  const topVideosByEngagement = videos
    .map((v) => ({
      id: v.id,
      title: v.title,
      views: v.views || 0,
      likes: v.likes || 0,
      comments: v.comments || 0,
      shares: v.shares || 0,
      engagement: (v.likes || 0) + (v.comments || 0),
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10)
    .map(({ engagement, ...rest }) => rest);

  return c.json({
    summary: {
      totalVideos: videos.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      engagementRate: parseFloat(engagementRate.toFixed(4)),
    },
    topVideosByViews,
    topVideosByEngagement,
  });
}));

// ============================================================================
// Get Video Metrics by Date Range
// ============================================================================

analytics.get('/videos/:id/metrics', authenticate, asyncHandler(async (c) => {
  const videoId = c.req.param('id');
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  validateUUID(videoId, 'videoId');

  // Get video (with retry)
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }

  // Check authorization
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId });
  }

  // Return metrics (would be filtered by date range in real implementation)
  return c.json({
    videoId,
    title: video.title,
    period: {
      startDate: startDate || 'all-time',
      endDate: endDate || 'now',
    },
    metrics: {
      views: video.views || 0,
      likes: video.likes || 0,
      comments: video.comments || 0,
      shares: video.shares || 0,
      engagementRate:
        ((video.likes || 0) + (video.comments || 0)) /
        Math.max(video.views || 1, 1),
    },
  });
}));

export default analytics;
