import { Hono } from 'hono';
import { Tag } from '../database';
import { verifyToken, extractToken } from '../auth';
import { D1Database } from '../database-d1';
import {
  asyncHandler,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  validateRequired,
  validateUUID,
  withRetry,
} from '../error-handler';

type Variables = {
  db: D1Database;
  user: any;
};

const tags = new Hono<{ Variables: Variables }>();

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
// Helper Functions
// ============================================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// Get All Tags (with video count)
// ============================================================================

tags.get('/', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const tenantTags = await withRetry(() => db.getTagsByTenant(user.tenantId));
  
  return c.json({
    tags: tenantTags,
    total: tenantTags.length,
  });
}));

// ============================================================================
// Tag Cloud (popular tags with weight)
// ============================================================================

tags.get('/cloud', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const limit = parseInt(c.req.query('limit') || '50');
  
  const tagCloud = await withRetry(() => db.getTagCloud(user.tenantId, limit));
  
  // Calculate weight (1-5 scale based on video count)
  const maxCount = Math.max(...tagCloud.map((t: any) => t.videoCount || 0), 1);
  const weightedTags = tagCloud.map((tag: any) => ({
    ...tag,
    weight: Math.max(1, Math.ceil((tag.videoCount / maxCount) * 5)),
  }));
  
  return c.json({
    tags: weightedTags,
    total: weightedTags.length,
  });
}));

// ============================================================================
// Autocomplete Tags (search by partial name)
// ============================================================================

tags.get('/autocomplete', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '10');
  
  if (!query || query.length < 1) {
    return c.json({ tags: [] });
  }
  
  const results = await withRetry(() => db.searchTags(user.tenantId, query, limit));
  
  return c.json({
    tags: results,
    total: results.length,
  });
}));

// ============================================================================
// Get Single Tag
// ============================================================================

tags.get('/:id', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  
  // Check if it looks like a slug first
  if (id.includes('-') && !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    const user = c.get('user');
    const tag = await withRetry(() => db.getTagBySlug(user.tenantId, id));
    if (!tag) {
      throw new NotFoundError('Tag', { slug: id });
    }
    return c.json(tag);
  }
  
  validateUUID(id, 'tagId');
  
  const tag = await withRetry(() => db.getTagById(id));

  if (!tag) {
    throw new NotFoundError('Tag', { tagId: id });
  }

  const user = c.get('user');
  
  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this tag', { tagId: id });
  }

  return c.json(tag);
}));

// ============================================================================
// Create Tag
// ============================================================================

tags.post('/', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const body = await c.req.json();
  const { name } = body;

  validateRequired(body, ['name']);

  const slug = generateSlug(name);

  // Check if slug already exists
  const existing = await withRetry(() => db.getTagBySlug(user.tenantId, slug));
  
  if (existing) {
    throw new ConflictError('Tag with this name already exists', { name, slug });
  }

  const tag: Tag = {
    id: crypto.randomUUID(),
    tenantId: user.tenantId,
    name,
    slug,
    createdAt: new Date().toISOString(),
  };

  await withRetry(() => db.createTag(tag));

  console.log('[TAG_CREATED]', {
    timestamp: new Date().toISOString(),
    tagId: tag.id,
    tenantId: user.tenantId,
    name,
  });

  return c.json({
    message: 'Tag created successfully',
    tag,
  }, 201);
}));

// ============================================================================
// Update Tag
// ============================================================================

tags.put('/:id', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = c.get('db');
  
  validateUUID(id, 'tagId');
  
  const tag = await withRetry(() => db.getTagById(id));

  if (!tag) {
    throw new NotFoundError('Tag', { tagId: id });
  }

  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this tag', { tagId: id });
  }

  const updates = await c.req.json();
  
  // If name is being updated, regenerate slug
  if (updates.name) {
    updates.slug = generateSlug(updates.name);
    
    // Check if new slug conflicts with another tag
    const existing = await withRetry(() => db.getTagBySlug(user.tenantId, updates.slug));
    
    if (existing && existing.id !== id) {
      throw new ConflictError('Tag with this name already exists', { name: updates.name });
    }
  }

  const updated = await withRetry(() => db.updateTag(id, updates));

  console.log('[TAG_UPDATED]', {
    timestamp: new Date().toISOString(),
    tagId: id,
    tenantId: user.tenantId,
    updates: Object.keys(updates),
  });

  return c.json({
    message: 'Tag updated successfully',
    tag: updated,
  });
}));

// ============================================================================
// Delete Tag
// ============================================================================

tags.delete('/:id', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = c.get('db');
  
  validateUUID(id, 'tagId');
  
  const tag = await withRetry(() => db.getTagById(id));

  if (!tag) {
    throw new NotFoundError('Tag', { tagId: id });
  }

  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this tag', { tagId: id });
  }

  await withRetry(() => db.deleteTag(id));

  console.log('[TAG_DELETED]', {
    timestamp: new Date().toISOString(),
    tagId: id,
    tenantId: user.tenantId,
  });

  return c.json({
    message: 'Tag deleted successfully',
  });
}));

// ============================================================================
// Get Videos by Tag
// ============================================================================

tags.get('/:id/videos', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = c.get('db');
  
  validateUUID(id, 'tagId');
  
  const tag = await withRetry(() => db.getTagById(id));

  if (!tag) {
    throw new NotFoundError('Tag', { tagId: id });
  }

  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this tag', { tagId: id });
  }

  const videos = await withRetry(() => db.getVideosByTag(id));

  return c.json({
    tag,
    videos,
    total: videos.length,
  });
}));

export default tags;
