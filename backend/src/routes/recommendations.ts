import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { z } from 'zod';

const app = new Hono();

// Schema de validação
const RecommendationQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  type: z.enum(['trending', 'similar', 'personalized', 'popular']).default('personalized'),
  videoId: z.string().optional(),
});

type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

/**
 * GET /api/recommendations
 * Obter recomendações de vídeos
 */
app.get('/', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Validar JWT
    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;

    // Validar query params
    const query = RecommendationQuerySchema.parse({
      limit: parseInt(c.req.query('limit') || '10'),
      type: c.req.query('type') || 'personalized',
      videoId: c.req.query('videoId'),
    });

    // Implementar lógica de recomendação
    let recommendations = [];

    switch (query.type) {
      case 'trending':
        recommendations = await getTrendingVideos(c.env, query.limit);
        break;
      case 'similar':
        if (!query.videoId) {
          return c.json({ error: 'videoId required for similar recommendations' }, 400);
        }
        recommendations = await getSimilarVideos(c.env, query.videoId, query.limit);
        break;
      case 'personalized':
        recommendations = await getPersonalizedRecommendations(c.env, userId, query.limit);
        break;
      case 'popular':
        recommendations = await getPopularVideos(c.env, query.limit);
        break;
    }

    return c.json({
      type: query.type,
      count: recommendations.length,
      videos: recommendations,
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return c.json({ error: 'Failed to fetch recommendations' }, 500);
  }
});

/**
 * Obter vídeos em tendência
 */
async function getTrendingVideos(env: any, limit: number) {
  try {
    const db = env.DB;
    const videos = await db
      .prepare(
        `
        SELECT v.*, 
               COUNT(DISTINCT a.id) as view_count,
               COUNT(DISTINCT l.id) as like_count
        FROM videos v
        LEFT JOIN analytics a ON v.id = a.video_id AND a.event_type = 'view'
        LEFT JOIN likes l ON v.id = l.video_id
        WHERE v.created_at > datetime('now', '-7 days')
        GROUP BY v.id
        ORDER BY view_count DESC, like_count DESC
        LIMIT ?
      `
      )
      .bind(limit)
      .all();

    return videos.results || [];
  } catch (error) {
    console.error('Error fetching trending videos:', error);
    return [];
  }
}

/**
 * Obter vídeos populares (all time)
 */
async function getPopularVideos(env: any, limit: number) {
  try {
    const db = env.DB;
    const videos = await db
      .prepare(
        `
        SELECT v.*, 
               COUNT(DISTINCT a.id) as view_count,
               COUNT(DISTINCT l.id) as like_count
        FROM videos v
        LEFT JOIN analytics a ON v.id = a.video_id AND a.event_type = 'view'
        LEFT JOIN likes l ON v.id = l.video_id
        GROUP BY v.id
        ORDER BY view_count DESC, like_count DESC
        LIMIT ?
      `
      )
      .bind(limit)
      .all();

    return videos.results || [];
  } catch (error) {
    console.error('Error fetching popular videos:', error);
    return [];
  }
}

/**
 * Obter vídeos similares
 */
async function getSimilarVideos(env: any, videoId: string, limit: number) {
  try {
    const db = env.DB;

    // Primeiro, obter tags do vídeo original
    const originalVideo = await db
      .prepare(
        `
        SELECT v.*, GROUP_CONCAT(t.name) as tags
        FROM videos v
        LEFT JOIN video_tags vt ON v.id = vt.video_id
        LEFT JOIN tags t ON vt.tag_id = t.id
        WHERE v.id = ?
        GROUP BY v.id
      `
      )
      .bind(videoId)
      .first();

    if (!originalVideo) {
      return [];
    }

    // Buscar vídeos com tags similares
    const tags = originalVideo.tags ? originalVideo.tags.split(',') : [];

    if (tags.length === 0) {
      return [];
    }

    const placeholders = tags.map(() => '?').join(',');
    const videos = await db
      .prepare(
        `
        SELECT DISTINCT v.*, 
               COUNT(DISTINCT a.id) as view_count,
               COUNT(DISTINCT l.id) as like_count
        FROM videos v
        JOIN video_tags vt ON v.id = vt.video_id
        JOIN tags t ON vt.tag_id = t.id
        LEFT JOIN analytics a ON v.id = a.video_id AND a.event_type = 'view'
        LEFT JOIN likes l ON v.id = l.video_id
        WHERE t.name IN (${placeholders}) AND v.id != ?
        GROUP BY v.id
        ORDER BY view_count DESC, like_count DESC
        LIMIT ?
      `
      )
      .bind(...tags, videoId, limit)
      .all();

    return videos.results || [];
  } catch (error) {
    console.error('Error fetching similar videos:', error);
    return [];
  }
}

/**
 * Obter recomendações personalizadas
 */
async function getPersonalizedRecommendations(env: any, userId: string, limit: number) {
  try {
    const db = env.DB;

    // Obter histórico de visualizações do usuário
    const viewHistory = await db
      .prepare(
        `
        SELECT DISTINCT a.video_id
        FROM analytics a
        WHERE a.user_id = ? AND a.event_type = 'view'
        ORDER BY a.created_at DESC
        LIMIT 10
      `
      )
      .bind(userId)
      .all();

    const viewedVideoIds = viewHistory.results?.map((r: any) => r.video_id) || [];

    if (viewedVideoIds.length === 0) {
      // Se não tem histórico, retornar populares
      return getPopularVideos(env, limit);
    }

    // Buscar vídeos similares aos que o usuário já viu
    const placeholders = viewedVideoIds.map(() => '?').join(',');
    const videos = await db
      .prepare(
        `
        SELECT DISTINCT v.*, 
               COUNT(DISTINCT a.id) as view_count,
               COUNT(DISTINCT l.id) as like_count
        FROM videos v
        JOIN video_tags vt ON v.id = vt.video_id
        JOIN tags t ON vt.tag_id = t.id
        LEFT JOIN analytics a ON v.id = a.video_id AND a.event_type = 'view'
        LEFT JOIN likes l ON v.id = l.video_id
        JOIN video_tags vt2 ON v.id = vt2.video_id
        JOIN tags t2 ON vt2.tag_id = t2.id
        WHERE t2.name IN (
          SELECT t.name FROM tags t
          JOIN video_tags vt ON t.id = vt.tag_id
          WHERE vt.video_id IN (${placeholders})
        )
        AND v.id NOT IN (${placeholders})
        GROUP BY v.id
        ORDER BY view_count DESC, like_count DESC
        LIMIT ?
      `
      )
      .bind(...viewedVideoIds, ...viewedVideoIds, limit)
      .all();

    return videos.results || [];
  } catch (error) {
    console.error('Error fetching personalized recommendations:', error);
    return [];
  }
}

export default app;
