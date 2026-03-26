import { Hono } from 'hono';
import { db, Video } from '../database';
import { verifyToken, extractToken } from '../auth';

const videos = new Hono();

// Middleware to verify authentication
async function authenticate(c: any, next: any) {
  const token = extractToken(c.req.header('Authorization'));
  
  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('user', payload);
  await next();
}

// Get all videos for tenant (with optional filters)
videos.get('/', authenticate, async (c) => {
  const user = c.get('user');
  const categoryId = c.req.query('categoryId');
  const tagId = c.req.query('tagId');
  
  const filters: any = {};
  if (categoryId) filters.categoryId = categoryId;
  if (tagId) filters.tagId = tagId;
  
  const tenantVideos = await db.getVideosByTenantFiltered(user.tenantId, filters);
  
  return c.json({
    videos: tenantVideos,
    total: tenantVideos.length,
    filters: {
      categoryId: categoryId || null,
      tagId: tagId || null,
    },
  });
});

// Get single video
videos.get('/:id', authenticate, async (c) => {
  const id = c.req.param('id');
  const video = await db.getVideoById(id);

  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }

  const user = c.get('user');
  if (video.tenantId !== user.tenantId) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Increment views
  await db.incrementVideoViews(id);

  // Get categories and tags
  const categories = await db.getCategoriesByVideo(id);
  const tags = await db.getTagsByVideo(id);

  return c.json({
    ...video,
    categories,
    tags,
  });
});

// Create video
videos.post('/', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const { title, description, url, thumbnailUrl, duration } = await c.req.json();

    // Validation
    if (!title || !url) {
      return c.json({ error: 'Title and URL are required' }, 400);
    }

    const video: Video = {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      title,
      description: description || '',
      url,
      thumbnailUrl: thumbnailUrl || '',
      duration: duration || 0,
      views: 0,
      createdAt: new Date().toISOString(),
    };

    await db.createVideo(video);

    return c.json({
      message: 'Video created successfully',
      video,
    }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create video', message: error.message }, 500);
  }
});

// Update video
videos.put('/:id', authenticate, async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('user');
    const video = await db.getVideoById(id);

    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    if (video.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const updates = await c.req.json();
    const updated = await db.updateVideo(id, updates);

    return c.json({
      message: 'Video updated successfully',
      video: updated,
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to update video', message: error.message }, 500);
  }
});

// Delete video
videos.delete('/:id', authenticate, async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('user');
    const video = await db.getVideoById(id);

    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    if (video.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await db.deleteVideo(id);

    return c.json({
      message: 'Video deleted successfully',
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete video', message: error.message }, 500);
  }
});

// Add category to video
videos.post('/:id/categories/:categoryId', authenticate, async (c) => {
  try {
    const videoId = c.req.param('id');
    const categoryId = c.req.param('categoryId');
    const user = c.get('user');

    const video = await db.getVideoById(videoId);
    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    if (video.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const category = await db.getCategoryById(categoryId);
    if (!category) {
      return c.json({ error: 'Category not found' }, 404);
    }

    if (category.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await db.addVideoCategory(videoId, categoryId);

    return c.json({
      message: 'Category added to video successfully',
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to add category', message: error.message }, 500);
  }
});

// Remove category from video
videos.delete('/:id/categories/:categoryId', authenticate, async (c) => {
  try {
    const videoId = c.req.param('id');
    const categoryId = c.req.param('categoryId');
    const user = c.get('user');

    const video = await db.getVideoById(videoId);
    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    if (video.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await db.removeVideoCategory(videoId, categoryId);

    return c.json({
      message: 'Category removed from video successfully',
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove category', message: error.message }, 500);
  }
});

// Add tag to video
videos.post('/:id/tags/:tagId', authenticate, async (c) => {
  try {
    const videoId = c.req.param('id');
    const tagId = c.req.param('tagId');
    const user = c.get('user');

    const video = await db.getVideoById(videoId);
    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    if (video.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const tag = await db.getTagById(tagId);
    if (!tag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    if (tag.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await db.addVideoTag(videoId, tagId);

    return c.json({
      message: 'Tag added to video successfully',
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to add tag', message: error.message }, 500);
  }
});

// Remove tag from video
videos.delete('/:id/tags/:tagId', authenticate, async (c) => {
  try {
    const videoId = c.req.param('id');
    const tagId = c.req.param('tagId');
    const user = c.get('user');

    const video = await db.getVideoById(videoId);
    if (!video) {
      return c.json({ error: 'Video not found' }, 404);
    }

    if (video.tenantId !== user.tenantId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await db.removeVideoTag(videoId, tagId);

    return c.json({
      message: 'Tag removed from video successfully',
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove tag', message: error.message }, 500);
  }
});

export default videos;
