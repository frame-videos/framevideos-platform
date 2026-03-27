/**
 * Video Search Routes
 * Provides search, filtering, and sorting capabilities
 */

import { Hono } from 'hono';
import { verifyToken, extractToken } from '../auth';
import { D1Database } from '../database-d1';
import {
  FrameVideosError,
  ErrorCode,
  validateRequired,
} from '../error-handler';
import { getDomainTenantContext } from '../middleware/tenant-routing';

type Variables = {
  db: D1Database;
};

const videosSearch = new Hono<{ Variables: Variables }>();

/**
 * Search videos by title, category, tag, with pagination and sorting
 * GET /api/v1/videos/search?q=term&category=id&tag=id&sort=views&limit=20&offset=0
 */
videosSearch.get('/', async (c) => {
  try {
    // Get tenant from domain context (injected by tenant-routing middleware)
    const domainContext = getDomainTenantContext(c);
    const tenantId = domainContext.tenantId;

    // Get query parameters
    const q = c.req.query('q') || '';
    const categoryId = c.req.query('category');
    const tagId = c.req.query('tag');
    const sort = c.req.query('sort') || 'date'; // date, views, likes
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    // Get videos for tenant
    const allVideos = db.getVideos(tenantId);

    if (!allVideos) {
      return c.json({ videos: [], total: 0, limit, offset });
    }

    // Filter by search term (case-insensitive)
    let filtered = allVideos.filter((v: any) => {
      if (!q) return true;
      const lowerQ = q.toLowerCase();
      return (
        v.title.toLowerCase().includes(lowerQ) ||
        (v.description && v.description.toLowerCase().includes(lowerQ))
      );
    });

    // Filter by category
    if (categoryId) {
      filtered = filtered.filter((v: any) => {
        return v.categoryIds && v.categoryIds.includes(categoryId);
      });
    }

    // Filter by tag
    if (tagId) {
      filtered = filtered.filter((v: any) => {
        return v.tagIds && v.tagIds.includes(tagId);
      });
    }

    // Sort
    filtered.sort((a: any, b: any) => {
      switch (sort) {
        case 'views':
          return (b.views || 0) - (a.views || 0);
        case 'likes':
          return (b.likes || 0) - (a.likes || 0);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    // Paginate
    const total = filtered.length;
    const videos = filtered.slice(offset, offset + limit);

    return c.json({
      videos,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error: any) {
    if (error instanceof FrameVideosError) {
      return c.json(
        {
          error: error.code,
          message: error.message,
          details: error.details,
        },
        error.statusCode
      );
    }

    return c.json(
      {
        error: ErrorCode.INTERNAL_ERROR,
        message: 'Search failed',
      },
      500
    );
  }
});

/**
 * Get trending videos
 * GET /api/v1/videos/trending?limit=10
 */
videosSearch.get('/trending', async (c) => {
  try {
    // Get tenant from token
    const token = extractToken(c);
    if (!token) {
      throw new FrameVideosError(
        ErrorCode.UNAUTHORIZED,
        401,
        'Missing authentication token'
      );
    }

    const user = await verifyToken(token);
    if (!user) {
      throw new FrameVideosError(
        ErrorCode.INVALID_TOKEN,
        401,
        'Invalid token'
      );
    }

    const tenantId = user.tenantId;
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);

    // Get all videos
    const allVideos = db.getVideos(tenantId) || [];

    // Calculate trending score: views + likes + recency
    const now = Date.now();
    const trending = allVideos
      .map((v: any) => {
        const ageInDays =
          (now - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 10 - ageInDays); // 10 points for new videos
        const score =
          (v.views || 0) * 0.5 + (v.likes || 0) * 1.0 + recencyScore;

        return { ...v, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit);

    return c.json({ videos: trending });
  } catch (error: any) {
    if (error instanceof FrameVideosError) {
      return c.json(
        {
          error: error.code,
          message: error.message,
        },
        error.statusCode
      );
    }

    return c.json(
      {
        error: ErrorCode.INTERNAL_ERROR,
        message: 'Trending search failed',
      },
      500
    );
  }
});

/**
 * Get popular videos by views
 * GET /api/v1/videos/popular?limit=10
 */
videosSearch.get('/popular', async (c) => {
  try {
    // Get tenant from token
    const token = extractToken(c);
    if (!token) {
      throw new FrameVideosError(
        ErrorCode.UNAUTHORIZED,
        401,
        'Missing authentication token'
      );
    }

    const user = await verifyToken(token);
    if (!user) {
      throw new FrameVideosError(
        ErrorCode.INVALID_TOKEN,
        401,
        'Invalid token'
      );
    }

    const tenantId = user.tenantId;
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);

    // Get all videos sorted by views
    const allVideos = db.getVideos(tenantId) || [];
    const popular = allVideos
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, limit);

    return c.json({ videos: popular });
  } catch (error: any) {
    if (error instanceof FrameVideosError) {
      return c.json(
        {
          error: error.code,
          message: error.message,
        },
        error.statusCode
      );
    }

    return c.json(
      {
        error: ErrorCode.INTERNAL_ERROR,
        message: 'Popular search failed',
      },
      500
    );
  }
});

export default videosSearch;
