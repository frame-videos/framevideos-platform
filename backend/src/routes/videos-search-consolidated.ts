/**
 * Consolidated Video Search Routes - Best of Both Implementations
 * Combines Rublo's clean structure + sub-agent's retry logic
 */

import { Hono } from 'hono';
import { SecureDatabase } from '../db/secure-db';
import {
  asyncHandler,
  validateUUID,
  withRetry,
  ValidationError,
} from '../error-handler-consolidated';

const router = new Hono();

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

/**
 * GET /api/v1/videos/search
 * Search videos with filters and pagination
 *
 * Query Parameters:
 * - q: Search query (title/description)
 * - category: Filter by category ID
 * - tag: Filter by tag ID
 * - sort: Sort field (date, views, likes, title)
 * - order: Sort order (asc, desc) - default: desc
 * - limit: Results per page (1-100) - default: 20
 * - offset: Pagination offset - default: 0
 */
router.get(
  '/search',
  asyncHandler(async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;

    // Parse query parameters
    const query = c.req.query('q') || '';
    const category = c.req.query('category');
    const tag = c.req.query('tag');
    const sort = c.req.query('sort') || 'date';
    const order = (c.req.query('order') || 'desc').toLowerCase();
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '20'), 1), 100);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);

    // Validate sort field
    const validSortFields = ['date', 'views', 'likes', 'title'];
    if (!validSortFields.includes(sort)) {
      throw new ValidationError('Invalid sort field', { sort, valid: validSortFields });
    }

    // Validate order
    if (!['asc', 'desc'].includes(order)) {
      throw new ValidationError('Invalid sort order', { order });
    }

    // Validate category and tag if provided
    if (category) {
      validateUUID(category, 'category id');
    }
    if (tag) {
      validateUUID(tag, 'tag id');
    }

    // Build search filters
    const filters = {
      query: query.trim(),
      categoryId: category,
      tagId: tag,
      sort,
      order: order as 'asc' | 'desc',
      limit,
      offset,
    };

    // Execute search with retry logic
    const results = await withRetry(async () => {
      return await db.searchVideos(tenantId, filters);
    });

    return c.json({
      videos: results.videos.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        views: v.views || 0,
        likes: v.likes || 0,
        duration: v.duration,
        category: v.category,
        tags: v.tags || [],
        createdAt: v.createdAt,
      })),
      total: results.total,
      limit,
      offset,
      hasMore: offset + limit < results.total,
    });
  })
);

// ============================================================================
// TRENDING ENDPOINT
// ============================================================================

/**
 * GET /api/v1/videos/search/trending
 * Get trending videos based on views + likes + recency
 *
 * Query Parameters:
 * - limit: Number of results (1-100) - default: 10
 * - offset: Pagination offset - default: 0
 */
router.get(
  '/search/trending',
  asyncHandler(async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '10'), 1), 100);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);

    // Get all videos for tenant
    const allVideos = await withRetry(async () => {
      return await db.getTenantVideos(tenantId, { limit: 1000, offset: 0 });
    });

    // Calculate trending score
    // Score = (views * 0.7) + (likes * 0.3) + recency_bonus
    const now = new Date();
    const scoredVideos = allVideos.map((video) => {
      const views = video.views || 0;
      const likes = video.likes || 0;

      // Recency bonus: videos from last 7 days get extra points
      const daysSinceCreated = Math.floor(
        (now.getTime() - new Date(video.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const recencyBonus = daysSinceCreated <= 7 ? 50 : 0;

      const score = views * 0.7 + likes * 0.3 + recencyBonus;

      return {
        ...video,
        score,
      };
    });

    // Sort by score descending
    const trending = scoredVideos
      .sort((a, b) => b.score - a.score)
      .slice(offset, offset + limit);

    return c.json({
      videos: trending.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views || 0,
        likes: v.likes || 0,
        score: parseFloat(v.score.toFixed(2)),
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
// POPULAR ENDPOINT
// ============================================================================

/**
 * GET /api/v1/videos/search/popular
 * Get most popular videos (by views)
 *
 * Query Parameters:
 * - limit: Number of results (1-100) - default: 10
 * - offset: Pagination offset - default: 0
 */
router.get(
  '/search/popular',
  asyncHandler(async (c) => {
    const tenantId = c.get('tenantId') as string;
    const db = c.get('db') as SecureDatabase;
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '10'), 1), 100);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);

    // Get videos sorted by views
    const videos = await withRetry(async () => {
      return await db.searchVideos(tenantId, {
        query: '',
        sort: 'views',
        order: 'desc',
        limit: 1000,
        offset: 0,
      });
    });

    const paginated = videos.videos.slice(offset, offset + limit);

    return c.json({
      videos: paginated.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views || 0,
        likes: v.likes || 0,
        duration: v.duration,
        createdAt: v.createdAt,
      })),
      total: videos.total,
      limit,
      offset,
      hasMore: offset + limit < videos.total,
    });
  })
);

// ============================================================================
// ADVANCED SEARCH (Future)
// ============================================================================

/**
 * GET /api/v1/videos/search/advanced
 * Advanced search with multiple filters
 * (Placeholder for future implementation)
 */
router.get(
  '/search/advanced',
  asyncHandler(async (c) => {
    return c.json(
      {
        message: 'Advanced search coming soon',
        features: ['Full-text search', 'Date range filtering', 'Duration filtering'],
      },
      200
    );
  })
);

export default router;
