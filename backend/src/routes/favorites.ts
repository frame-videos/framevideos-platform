import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { z } from 'zod';

const app = new Hono();

const FavoriteSchema = z.object({
  videoId: z.string().min(1),
});

/**
 * GET /api/favorites
 * Obter vídeos favoritados do usuário
 */
app.get('/', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;

    const db = c.env.DB;
    const favorites = await db
      .prepare(
        `
        SELECT v.* FROM videos v
        JOIN favorites f ON v.id = f.video_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
      `
      )
      .bind(userId)
      .all();

    return c.json({
      count: favorites.results?.length || 0,
      videos: favorites.results || [],
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return c.json({ error: 'Failed to fetch favorites' }, 500);
  }
});

/**
 * POST /api/favorites
 * Adicionar vídeo aos favoritos
 */
app.post('/', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;

    const body = await c.req.json();
    const { videoId } = FavoriteSchema.parse(body);

    const db = c.env.DB;

    // Verificar se já existe
    const existing = await db
      .prepare('SELECT id FROM favorites WHERE user_id = ? AND video_id = ?')
      .bind(userId, videoId)
      .first();

    if (existing) {
      return c.json({ error: 'Already in favorites' }, 409);
    }

    // Adicionar aos favoritos
    await db
      .prepare(
        `
        INSERT INTO favorites (user_id, video_id, created_at)
        VALUES (?, ?, datetime('now'))
      `
      )
      .bind(userId, videoId)
      .run();

    return c.json({ message: 'Added to favorites' }, 201);
  } catch (error) {
    console.error('Error adding favorite:', error);
    return c.json({ error: 'Failed to add favorite' }, 500);
  }
});

/**
 * DELETE /api/favorites/:videoId
 * Remover vídeo dos favoritos
 */
app.delete('/:videoId', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;
    const videoId = c.req.param('videoId');

    const db = c.env.DB;
    const result = await db
      .prepare('DELETE FROM favorites WHERE user_id = ? AND video_id = ?')
      .bind(userId, videoId)
      .run();

    if (result.success) {
      return c.json({ message: 'Removed from favorites' });
    } else {
      return c.json({ error: 'Not found' }, 404);
    }
  } catch (error) {
    console.error('Error removing favorite:', error);
    return c.json({ error: 'Failed to remove favorite' }, 500);
  }
});

/**
 * GET /api/favorites/:videoId
 * Verificar se vídeo está nos favoritos
 */
app.get('/:videoId', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;
    const videoId = c.req.param('videoId');

    const db = c.env.DB;
    const favorite = await db
      .prepare('SELECT id FROM favorites WHERE user_id = ? AND video_id = ?')
      .bind(userId, videoId)
      .first();

    return c.json({
      isFavorite: !!favorite,
    });
  } catch (error) {
    console.error('Error checking favorite:', error);
    return c.json({ error: 'Failed to check favorite' }, 500);
  }
});

export default app;
