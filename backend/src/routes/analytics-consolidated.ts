/**
 * Consolidated Analytics Routes - Best of Both Implementations
 * Combines Rublo's clean structure + sub-agent's retry logic
 */

import { Hono } from 'hono';
import { SecureDatabase } from '../db/secure-db';
import {
  asyncHandler,
  validateUUID,
  NotFoundError,
  AuthenticationError,
  withRetry,
  ErrorCode,
  FrameVideosError,
} from '../error-handler-consolidated';

const router = new Hono();

// ============================================================================
// VIEW TRACKING
// ============================================================================

/**
 * POST /api/v1/analytics/videos/:id/view
 * Track a video view (increments view counter)
 */
router.post(
  '/videos/:id/view',
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const db = c.get('db') as SecureDatabase;
    const tenantId = c.get('tenantId') as string;

    // Validate UUID
    validateUUID(id, 'video id');

    // Use retry logic for database operations
    const video = await withRetry(async () => {
      return await db.getVideo(id, tenantId);
    });

    if (!video) {
      throw new NotFoundError('Video', id);
    }

    // Increment views
    await withRetry(async () => {
      await db.incrementVideoViews(id, tenantId);
    });

    return c.json({
      videoId: id,
      views: (video.views || 0) + 1,
      timestamp: new Date().toISOString(),
    });
  })
);

// ============================================================================
// LIKE SYSTEM
// ============================================================================

/**
 * POST /api/v1/analytics/videos/:id/like
 * Like or unlike a video (toggle)
 */
router.post(
  '/videos/:id/like',
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const userId = c.get('userId') as string;
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;

    if (!userId) {
      throw new AuthenticationError('User must be authenticated to like videos');
    }

    validateUUID(id, 'video id');
    validateUUID(userId, 'user id');

    // Check if video exists
    const video = await withRetry(async () => {
      return await db.getVideo(id, tenantId);
    });

    if (!video) {
      throw new NotFoundError('Video', id);
    }

    // Check if already liked
    const existingLike = await withRetry(async () => {
      return await db.getUserVideoLike(userId, id, tenantId);
    });

    if (existingLike) {
      // Unlike
      await withRetry(async () => {
        await db.removeVideoLike(userId, id, tenantId);
      });

      return c.json({
        videoId: id,
        userId,
        liked: false,
        likes: Math.max(0, (video.likes || 0) - 1),
        timestamp: new Date().toISOString(),
      });
    } else {
      // Like
      await withRetry(async () => {
        await db.addVideoLike(userId, id, tenantId);
      });

      return c.json({
        videoId: id,
        userId,
        liked: true,
        likes: (video.likes || 0) + 1,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// VIDEO ANALYTICS
// ============================================================================

/**
 * GET /api/v1/analytics/videos/:id
 * Get detailed analytics for a specific video
 */
router.get(
  '/videos/:id',
  asyncHandler(async (c) => {
    const { id } = c.req.param();
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;

    validateUUID(id, 'video id');

    const video = await withRetry(async () => {
      return await db.getVideo(id, tenantId);
    });

    if (!video) {
      throw new NotFoundError('Video', id);
    }

    // Calculate engagement rate
    const views = video.views || 0;
    const likes = video.likes || 0;
    const comments = video.comments || 0;
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    // Get view trends (last 30 days)
    const viewTrends = await withRetry(async () => {
      return await db.getVideoViewTrends(id, tenantId, 30);
    });

    return c.json({
      videoId: id,
      title: video.title,
      views,
      likes,
      comments,
      shares: video.shares || 0,
      engagementRate: engagementRate.toFixed(2),
      viewTrends,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    });
  })
);

// ============================================================================
// USER DASHBOARD
// ============================================================================

/**
 * GET /api/v1/analytics/dashboard
 * Get user's analytics dashboard
 */
router.get(
  '/dashboard',
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;

    if (!userId) {
      throw new AuthenticationError('User must be authenticated to view dashboard');
    }

    // Get user's videos
    const userVideos = await withRetry(async () => {
      return await db.getUserVideos(userId, tenantId);
    });

    // Calculate aggregated stats
    const totalViews = userVideos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = userVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalComments = userVideos.reduce((sum, v) => sum + (v.comments || 0), 0);

    const avgEngagement =
      userVideos.length > 0
        ? ((totalLikes + totalComments) / (totalViews || 1)) * 100
        : 0;

    // Get top 10 videos
    const topVideos = userVideos
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);

    return c.json({
      userId,
      videoCount: userVideos.length,
      totalViews,
      totalLikes,
      totalComments,
      avgEngagement: avgEngagement.toFixed(2),
      topVideos: topVideos.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
      })),
    });
  })
);

// ============================================================================
// TRENDING VIDEOS
// ============================================================================

/**
 * GET /api/v1/analytics/trending
 * Get trending videos for the tenant
 */
router.get(
  '/trending',
  asyncHandler(async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    // Get all videos for tenant
    const allVideos = await withRetry(async () => {
      return await db.getTenantVideos(tenantId, { limit: 1000, offset: 0 });
    });

    // Calculate trending score
    // Score = (views * 0.5) + (likes * 1.0) + recency_bonus
    const now = new Date();
    const scoredVideos = allVideos.map((video) => {
      const views = video.views || 0;
      const likes = video.likes || 0;

      // Recency bonus: videos from last 7 days get extra points
      const daysSinceCreated = Math.floor(
        (now.getTime() - new Date(video.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const recencyBonus = daysSinceCreated <= 7 ? 10 : 0;

      const score = views * 0.5 + likes * 1.0 + recencyBonus;

      return {
        ...video,
        score,
      };
    });

    // Sort by score and apply pagination
    const trending = scoredVideos
      .sort((a, b) => b.score - a.score)
      .slice(offset, offset + limit);

    return c.json({
      videos: trending.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views,
        likes: v.likes,
        score: v.score.toFixed(2),
        createdAt: v.createdAt,
      })),
      total: scoredVideos.length,
      limit,
      offset,
      hasMore: offset + limit < scoredVideos.length,
    });
  })
);

// ============================================================================
// POPULAR VIDEOS
// ============================================================================

/**
 * GET /api/v1/analytics/popular
 * Get most popular videos (by views)
 */
router.get(
  '/popular',
  asyncHandler(async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    const videos = await withRetry(async () => {
      return await db.getTenantVideos(tenantId, { limit, offset });
    });

    const sorted = videos.sort((a, b) => (b.views || 0) - (a.views || 0));

    return c.json({
      videos: sorted.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views,
        likes: v.likes,
        createdAt: v.createdAt,
      })),
      total: videos.length,
      limit,
      offset,
    });
  })
);

export default router;
