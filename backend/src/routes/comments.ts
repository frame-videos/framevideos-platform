import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { z } from 'zod';

const app = new Hono();

const CommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

const ReplySchema = z.object({
  content: z.string().min(1).max(1000),
});

/**
 * GET /api/comments/:videoId
 * Obter comentários de um vídeo
 */
app.get('/:videoId', async (c) => {
  try {
    const videoId = c.req.param('videoId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const db = c.env.DB;
    const comments = await db
      .prepare(
        `
        SELECT c.*, u.name as author_name, u.email as author_email,
               COUNT(DISTINCT r.id) as reply_count
        FROM comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN comment_replies r ON c.id = r.comment_id
        WHERE c.video_id = ? AND c.parent_comment_id IS NULL
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `
      )
      .bind(videoId, limit, offset)
      .all();

    const total = await db
      .prepare('SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND parent_comment_id IS NULL')
      .bind(videoId)
      .first();

    return c.json({
      comments: comments.results || [],
      total: total.count || 0,
      page,
      limit,
      pages: Math.ceil((total.count || 0) / limit),
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

/**
 * POST /api/comments/:videoId
 * Criar novo comentário
 */
app.post('/:videoId', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;
    const videoId = c.req.param('videoId');

    const body = await c.req.json();
    const { content } = CommentSchema.parse(body);

    const db = c.env.DB;
    
    // Verificar se vídeo existe
    const video = await db
      .prepare('SELECT id FROM videos WHERE id = ?')
      .bind(videoId)
      .first();

    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    // Criar comentário
    const result = await db
      .prepare(
        `
        INSERT INTO comments (video_id, user_id, content, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `
      )
      .bind(videoId, userId, content)
      .run();

    return c.json({
      id: result.meta.last_row_id,
      videoId,
      userId,
      content,
      createdAt: new Date().toISOString(),
    }, 201);
  } catch (error) {
    console.error('Error creating comment:', error);
    return c.json({ error: 'Failed to create comment' }, 500);
  }
});

/**
 * DELETE /api/comments/:commentId
 * Deletar comentário
 */
app.delete('/:commentId', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;
    const commentId = c.req.param('commentId');

    const db = c.env.DB;

    // Verificar se comentário pertence ao usuário
    const comment = await db
      .prepare('SELECT user_id FROM comments WHERE id = ?')
      .bind(commentId)
      .first();

    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    if (comment.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Deletar comentário e respostas
    await db
      .prepare('DELETE FROM comment_replies WHERE comment_id = ?')
      .bind(commentId)
      .run();

    await db
      .prepare('DELETE FROM comments WHERE id = ?')
      .bind(commentId)
      .run();

    return c.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
});

/**
 * POST /api/comments/:commentId/replies
 * Responder a um comentário
 */
app.post('/:commentId/replies', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verify(token, c.env.JWT_SECRET as string);
    const userId = payload.sub as string;
    const commentId = c.req.param('commentId');

    const body = await c.req.json();
    const { content } = ReplySchema.parse(body);

    const db = c.env.DB;

    // Verificar se comentário existe
    const comment = await db
      .prepare('SELECT id FROM comments WHERE id = ?')
      .bind(commentId)
      .first();

    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    // Criar resposta
    const result = await db
      .prepare(
        `
        INSERT INTO comment_replies (comment_id, user_id, content, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `
      )
      .bind(commentId, userId, content)
      .run();

    return c.json({
      id: result.meta.last_row_id,
      commentId,
      userId,
      content,
      createdAt: new Date().toISOString(),
    }, 201);
  } catch (error) {
    console.error('Error creating reply:', error);
    return c.json({ error: 'Failed to create reply' }, 500);
  }
});

/**
 * GET /api/comments/:commentId/replies
 * Obter respostas de um comentário
 */
app.get('/:commentId/replies', async (c) => {
  try {
    const commentId = c.req.param('commentId');

    const db = c.env.DB;
    const replies = await db
      .prepare(
        `
        SELECT r.*, u.name as author_name
        FROM comment_replies r
        JOIN users u ON r.user_id = u.id
        WHERE r.comment_id = ?
        ORDER BY r.created_at ASC
      `
      )
      .bind(commentId)
      .all();

    return c.json({
      replies: replies.results || [],
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    return c.json({ error: 'Failed to fetch replies' }, 500);
  }
});

export default app;
