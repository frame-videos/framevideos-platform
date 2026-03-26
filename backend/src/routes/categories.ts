import { Hono } from 'hono';
import { Category } from '../database';
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

const categories = new Hono<{ Variables: Variables }>();

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
// Get All Categories (with video count)
// ============================================================================

categories.get('/', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const tenantCategories = await withRetry(() => db.getCategoriesByTenant(user.tenantId));
  
  return c.json({
    categories: tenantCategories,
    total: tenantCategories.length,
  });
}));

// ============================================================================
// Get Single Category
// ============================================================================

categories.get('/:id', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  
  // Check if it looks like a slug first
  if (id.includes('-') && !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    // Treat as slug
    const user = c.get('user');
    const category = await withRetry(() => db.getCategoryBySlug(user.tenantId, id));
    if (!category) {
      throw new NotFoundError('Category', { slug: id });
    }
    return c.json(category);
  }
  
  validateUUID(id, 'categoryId');
  
  const category = await withRetry(() => db.getCategoryById(id));

  if (!category) {
    throw new NotFoundError('Category', { categoryId: id });
  }

  const user = c.get('user');
  
  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this category', { categoryId: id });
  }

  return c.json(category);
}));

// ============================================================================
// Create Category
// ============================================================================

categories.post('/', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const body = await c.req.json();
  const { name, description } = body;

  validateRequired(body, ['name']);

  const slug = generateSlug(name);

  // Check if slug already exists
  const existing = await withRetry(() => db.getCategoryBySlug(user.tenantId, slug));
  
  if (existing) {
    throw new ConflictError('Category with this name already exists', { name, slug });
  }

  const category: Category = {
    id: crypto.randomUUID(),
    tenantId: user.tenantId,
    name,
    slug,
    description: description || '',
    createdAt: new Date().toISOString(),
  };

  await withRetry(() => db.createCategory(category));

  console.log('[CATEGORY_CREATED]', {
    timestamp: new Date().toISOString(),
    categoryId: category.id,
    tenantId: user.tenantId,
    name,
  });

  return c.json({
    message: 'Category created successfully',
    category,
  }, 201);
}));

// ============================================================================
// Update Category
// ============================================================================

categories.put('/:id', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = c.get('db');
  
  validateUUID(id, 'categoryId');
  
  const category = await withRetry(() => db.getCategoryById(id));

  if (!category) {
    throw new NotFoundError('Category', { categoryId: id });
  }

  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this category', { categoryId: id });
  }

  const updates = await c.req.json();
  
  // If name is being updated, regenerate slug
  if (updates.name) {
    updates.slug = generateSlug(updates.name);
    
    // Check if new slug conflicts with another category
    const existing = await withRetry(() => db.getCategoryBySlug(user.tenantId, updates.slug));
    
    if (existing && existing.id !== id) {
      throw new ConflictError('Category with this name already exists', { name: updates.name });
    }
  }

  const updated = await withRetry(() => db.updateCategory(id, updates));

  console.log('[CATEGORY_UPDATED]', {
    timestamp: new Date().toISOString(),
    categoryId: id,
    tenantId: user.tenantId,
    updates: Object.keys(updates),
  });

  return c.json({
    message: 'Category updated successfully',
    category: updated,
  });
}));

// ============================================================================
// Delete Category
// ============================================================================

categories.delete('/:id', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = c.get('db');
  
  validateUUID(id, 'categoryId');
  
  const category = await withRetry(() => db.getCategoryById(id));

  if (!category) {
    throw new NotFoundError('Category', { categoryId: id });
  }

  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this category', { categoryId: id });
  }

  await withRetry(() => db.deleteCategory(id));

  console.log('[CATEGORY_DELETED]', {
    timestamp: new Date().toISOString(),
    categoryId: id,
    tenantId: user.tenantId,
  });

  return c.json({
    message: 'Category deleted successfully',
  });
}));

// ============================================================================
// Get Videos by Category
// ============================================================================

categories.get('/:id/videos', authenticate, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = c.get('db');
  
  validateUUID(id, 'categoryId');
  
  const category = await withRetry(() => db.getCategoryById(id));

  if (!category) {
    throw new NotFoundError('Category', { categoryId: id });
  }

  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this category', { categoryId: id });
  }

  const videos = await withRetry(() => db.getVideosByCategory(id));

  return c.json({
    category,
    videos,
    total: videos.length,
  });
}));

export default categories;
