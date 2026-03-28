// Rotas de content management — Sprint 5
// CRUD completo: videos, categories, tags, performers, channels, pages, settings
// Todas protegidas por auth middleware (tenant-scoped)

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid, slugify } from '@frame-videos/shared/utils';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '@frame-videos/shared/errors';
import { SYSTEM_LIMITS } from '@frame-videos/shared/constants';

const content = new Hono<AppContext>();

// ─── Auth middleware (todas as rotas) ────────────────────────────────────────

content.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// ─── Role guard: apenas tenant_admin e super_admin ───────────────────────────

content.use('*', async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'tenant_admin' && role !== 'super_admin') {
    throw new ForbiddenError('Apenas administradores podem gerenciar conteúdo');
  }
  await next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginationParams(c: { req: { query: (k: string) => string | undefined } }, defaultLimit = 24) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? String(defaultLimit), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function ensureUniqueSlug(
  db: D1Client,
  table: string,
  tenantId: string,
  slug: string,
  excludeId?: string,
): Promise<string> {
  let candidate = slug;
  let counter = 0;
  const maxAttempts = 20;

  while (counter < maxAttempts) {
    const existing = excludeId
      ? await db.queryOne<{ id: string }>(
          `SELECT id FROM ${table} WHERE tenant_id = ? AND slug = ? AND id != ?`,
          [tenantId, candidate, excludeId],
        )
      : await db.queryOne<{ id: string }>(
          `SELECT id FROM ${table} WHERE tenant_id = ? AND slug = ?`,
          [tenantId, candidate],
        );

    if (!existing) return candidate;
    counter++;
    candidate = `${slug}-${counter}`;
  }

  // Fallback: append random suffix
  return `${slug}-${Date.now().toString(36)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEOS
// ═══════════════════════════════════════════════════════════════════════════════

const createVideoSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(SYSTEM_LIMITS.MAX_TITLE_LENGTH),
  description: z.string().max(SYSTEM_LIMITS.MAX_DESCRIPTION_LENGTH).optional().default(''),
  slug: z.string().max(SYSTEM_LIMITS.MAX_SLUG_LENGTH).optional(),
  videoUrl: z.string().url().optional(),
  embedUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  categoryIds: z.array(z.string()).max(SYSTEM_LIMITS.MAX_CATEGORIES_PER_VIDEO).optional().default([]),
  tagIds: z.array(z.string()).max(SYSTEM_LIMITS.MAX_TAGS_PER_VIDEO).optional().default([]),
  performerIds: z.array(z.string()).max(SYSTEM_LIMITS.MAX_PERFORMERS_PER_VIDEO).optional().default([]),
  channelId: z.string().optional(),
});

const updateVideoSchema = createVideoSchema.partial();

// GET /content/videos
content.get('/videos', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c);
  const status = c.req.query('status');
  const search = c.req.query('search');
  const categoryId = c.req.query('category_id');

  let where = 'v.tenant_id = ?';
  const params: unknown[] = [tenantId];

  if (status) {
    where += ' AND v.status = ?';
    params.push(status);
  }

  if (search) {
    where += ' AND vt.title LIKE ?';
    params.push(`%${search}%`);
  }

  if (categoryId) {
    where += ' AND EXISTS (SELECT 1 FROM video_categories vc WHERE vc.video_id = v.id AND vc.category_id = ?)';
    params.push(categoryId);
  }

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE ${where}`,
    [locale, ...params],
  );
  const total = countResult?.total ?? 0;

  const videos = await db.query<{
    id: string;
    slug: string;
    status: string;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    video_url: string | null;
    embed_url: string | null;
    view_count: number;
    is_featured: number;
    published_at: string | null;
    created_at: string;
    title: string | null;
    description: string | null;
  }>(
    `SELECT v.id, v.slug, v.status, v.duration_seconds, v.thumbnail_url,
            v.video_url, v.embed_url, v.view_count, v.is_featured,
            v.published_at, v.created_at,
            vt.title, vt.description
     FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE ${where}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [locale, ...params, limit, offset],
  );

  return c.json({
    data: videos.map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title ?? '(sem título)',
      description: v.description ?? '',
      status: v.status,
      durationSeconds: v.duration_seconds,
      thumbnailUrl: v.thumbnail_url,
      videoUrl: v.video_url,
      embedUrl: v.embed_url,
      viewCount: v.view_count,
      isFeatured: v.is_featured === 1,
      publishedAt: v.published_at,
      createdAt: v.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /content/videos
content.post('/videos', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createVideoSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const videoId = generateUlid();
  const translationId = generateUlid();
  const rawSlug = data.slug ? slugify(data.slug) : slugify(data.title);
  const slug = await ensureUniqueSlug(db, 'videos', tenantId, rawSlug || `video-${videoId.slice(0, 8).toLowerCase()}`);

  const publishedAt = data.status === 'published' ? "datetime('now')" : null;

  const queries: Array<{ sql: string; params?: unknown[] }> = [
    {
      sql: `INSERT INTO videos (id, tenant_id, slug, status, duration_seconds, thumbnail_url, video_url, embed_url, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${data.status === 'published' ? "datetime('now')" : 'NULL'})`,
      params: [
        videoId, tenantId, slug, data.status,
        data.durationSeconds ?? null,
        data.thumbnailUrl ?? null,
        data.videoUrl ?? null,
        data.embedUrl ?? null,
      ],
    },
    {
      sql: `INSERT INTO video_translations (id, video_id, locale, title, description)
            VALUES (?, ?, ?, ?, ?)`,
      params: [translationId, videoId, locale, data.title, data.description ?? ''],
    },
  ];

  // Category associations
  for (const catId of data.categoryIds) {
    queries.push({
      sql: 'INSERT OR IGNORE INTO video_categories (video_id, category_id) VALUES (?, ?)',
      params: [videoId, catId],
    });
  }

  // Tag associations
  for (const tagId of data.tagIds) {
    queries.push({
      sql: 'INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)',
      params: [videoId, tagId],
    });
  }

  // Performer associations
  for (const perfId of data.performerIds) {
    queries.push({
      sql: 'INSERT OR IGNORE INTO video_performers (video_id, performer_id) VALUES (?, ?)',
      params: [videoId, perfId],
    });
  }

  // Channel association
  if (data.channelId) {
    queries.push({
      sql: 'INSERT OR IGNORE INTO video_channels (video_id, channel_id) VALUES (?, ?)',
      params: [videoId, data.channelId],
    });
  }

  await db.batch(queries);

  return c.json({ id: videoId, slug }, 201);
});

// GET /content/videos/:id
content.get('/videos/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const videoId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const video = await db.queryOne<{
    id: string; slug: string; status: string; duration_seconds: number | null;
    thumbnail_url: string | null; video_url: string | null; embed_url: string | null;
    source_url: string | null; view_count: number; like_count: number;
    is_featured: number; published_at: string | null; created_at: string;
    title: string | null; description: string | null;
  }>(
    `SELECT v.*, vt.title, vt.description
     FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE v.id = ? AND v.tenant_id = ?`,
    [locale, videoId, tenantId],
  );

  if (!video) throw new NotFoundError('Video', videoId);

  // Fetch associations
  const categories = await db.query<{ id: string; name: string }>(
    `SELECT c.id, ct.name FROM video_categories vc
     JOIN categories c ON c.id = vc.category_id
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE vc.video_id = ?`,
    [locale, videoId],
  );

  const tags = await db.query<{ id: string; name: string }>(
    `SELECT t.id, tt.name FROM video_tags vt
     JOIN tags t ON t.id = vt.tag_id
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE vt.video_id = ?`,
    [locale, videoId],
  );

  const performers = await db.query<{ id: string; name: string }>(
    `SELECT p.id, pt.name FROM video_performers vp
     JOIN performers p ON p.id = vp.performer_id
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE vp.video_id = ?`,
    [locale, videoId],
  );

  const channels = await db.query<{ id: string; name: string }>(
    `SELECT ch.id, cht.name FROM video_channels vc
     JOIN channels ch ON ch.id = vc.channel_id
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE vc.video_id = ?`,
    [locale, videoId],
  );

  return c.json({
    id: video.id,
    slug: video.slug,
    title: video.title ?? '',
    description: video.description ?? '',
    status: video.status,
    durationSeconds: video.duration_seconds,
    thumbnailUrl: video.thumbnail_url,
    videoUrl: video.video_url,
    embedUrl: video.embed_url,
    viewCount: video.view_count,
    likeCount: video.like_count,
    isFeatured: video.is_featured === 1,
    publishedAt: video.published_at,
    createdAt: video.created_at,
    categories,
    tags,
    performers,
    channel: channels[0] ?? null,
  });
});

// PUT /content/videos/:id
content.put('/videos/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const videoId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateVideoSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string; slug: string; status: string }>(
    'SELECT id, slug, status FROM videos WHERE id = ? AND tenant_id = ?',
    [videoId, tenantId],
  );
  if (!existing) throw new NotFoundError('Video', videoId);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  // Update video fields
  const videoUpdates: string[] = [];
  const videoParams: unknown[] = [];

  if (data.status !== undefined) {
    videoUpdates.push('status = ?');
    videoParams.push(data.status);
    if (data.status === 'published' && existing.status !== 'published') {
      videoUpdates.push("published_at = datetime('now')");
    }
  }
  if (data.durationSeconds !== undefined) { videoUpdates.push('duration_seconds = ?'); videoParams.push(data.durationSeconds); }
  if (data.thumbnailUrl !== undefined) { videoUpdates.push('thumbnail_url = ?'); videoParams.push(data.thumbnailUrl); }
  if (data.videoUrl !== undefined) { videoUpdates.push('video_url = ?'); videoParams.push(data.videoUrl); }
  if (data.embedUrl !== undefined) { videoUpdates.push('embed_url = ?'); videoParams.push(data.embedUrl); }

  if (data.slug !== undefined) {
    const newSlug = await ensureUniqueSlug(db, 'videos', tenantId, slugify(data.slug), videoId);
    videoUpdates.push('slug = ?');
    videoParams.push(newSlug);
  }

  if (videoUpdates.length > 0) {
    queries.push({
      sql: `UPDATE videos SET ${videoUpdates.join(', ')} WHERE id = ?`,
      params: [...videoParams, videoId],
    });
  }

  // Update translations
  if (data.title !== undefined || data.description !== undefined) {
    const existingTranslation = await db.queryOne<{ id: string }>(
      'SELECT id FROM video_translations WHERE video_id = ? AND locale = ?',
      [videoId, locale],
    );

    if (existingTranslation) {
      const tUpdates: string[] = [];
      const tParams: unknown[] = [];
      if (data.title !== undefined) { tUpdates.push('title = ?'); tParams.push(data.title); }
      if (data.description !== undefined) { tUpdates.push('description = ?'); tParams.push(data.description); }
      if (tUpdates.length > 0) {
        queries.push({
          sql: `UPDATE video_translations SET ${tUpdates.join(', ')} WHERE id = ?`,
          params: [...tParams, existingTranslation.id],
        });
      }
    } else {
      queries.push({
        sql: `INSERT INTO video_translations (id, video_id, locale, title, description) VALUES (?, ?, ?, ?, ?)`,
        params: [generateUlid(), videoId, locale, data.title ?? '', data.description ?? ''],
      });
    }
  }

  // Update category associations
  if (data.categoryIds !== undefined) {
    queries.push({ sql: 'DELETE FROM video_categories WHERE video_id = ?', params: [videoId] });
    for (const catId of data.categoryIds) {
      queries.push({
        sql: 'INSERT OR IGNORE INTO video_categories (video_id, category_id) VALUES (?, ?)',
        params: [videoId, catId],
      });
    }
  }

  // Update tag associations
  if (data.tagIds !== undefined) {
    queries.push({ sql: 'DELETE FROM video_tags WHERE video_id = ?', params: [videoId] });
    for (const tagId of data.tagIds) {
      queries.push({
        sql: 'INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)',
        params: [videoId, tagId],
      });
    }
  }

  // Update performer associations
  if (data.performerIds !== undefined) {
    queries.push({ sql: 'DELETE FROM video_performers WHERE video_id = ?', params: [videoId] });
    for (const perfId of data.performerIds) {
      queries.push({
        sql: 'INSERT OR IGNORE INTO video_performers (video_id, performer_id) VALUES (?, ?)',
        params: [videoId, perfId],
      });
    }
  }

  // Update channel association
  if (data.channelId !== undefined) {
    queries.push({ sql: 'DELETE FROM video_channels WHERE video_id = ?', params: [videoId] });
    if (data.channelId) {
      queries.push({
        sql: 'INSERT OR IGNORE INTO video_channels (video_id, channel_id) VALUES (?, ?)',
        params: [videoId, data.channelId],
      });
    }
  }

  if (queries.length > 0) {
    await db.batch(queries);
  }

  return c.json({ success: true });
});

// DELETE /content/videos/:id
content.delete('/videos/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const videoId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM videos WHERE id = ? AND tenant_id = ?',
    [videoId, tenantId],
  );
  if (!existing) throw new NotFoundError('Video', videoId);

  // Cascade deletes handle associations
  await db.execute('DELETE FROM videos WHERE id = ?', [videoId]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  slug: z.string().max(150).optional(),
  description: z.string().max(2000).optional().default(''),
  imageUrl: z.string().url().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const updateCategorySchema = createCategorySchema.partial();

// GET /content/categories
content.get('/categories', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM categories WHERE tenant_id = ?',
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const categories = await db.query<{
    id: string; slug: string; parent_id: string | null; sort_order: number;
    is_active: number; created_at: string; name: string | null; description: string | null;
  }>(
    `SELECT c.id, c.slug, c.parent_id, c.sort_order, c.is_active, c.created_at,
            ct.name, ct.description
     FROM categories c
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.tenant_id = ?
     ORDER BY c.sort_order ASC, c.created_at ASC
     LIMIT ? OFFSET ?`,
    [locale, tenantId, limit, offset],
  );

  return c.json({
    data: categories.map((cat) => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name ?? cat.slug,
      description: cat.description ?? '',
      parentId: cat.parent_id,
      sortOrder: cat.sort_order,
      isActive: cat.is_active === 1,
      createdAt: cat.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /content/categories
content.post('/categories', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const categoryId = generateUlid();
  const translationId = generateUlid();
  const rawSlug = data.slug ? slugify(data.slug) : slugify(data.name);
  const slug = await ensureUniqueSlug(db, 'categories', tenantId, rawSlug || `cat-${categoryId.slice(0, 8).toLowerCase()}`);

  await db.batch([
    {
      sql: `INSERT INTO categories (id, tenant_id, slug, parent_id, sort_order)
            VALUES (?, ?, ?, ?, ?)`,
      params: [categoryId, tenantId, slug, data.parentId ?? null, data.sortOrder],
    },
    {
      sql: `INSERT INTO category_translations (id, category_id, locale, name, description)
            VALUES (?, ?, ?, ?, ?)`,
      params: [translationId, categoryId, locale, data.name, data.description ?? ''],
    },
  ]);

  return c.json({ id: categoryId, slug }, 201);
});

// PUT /content/categories/:id
content.put('/categories/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const categoryId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM categories WHERE id = ? AND tenant_id = ?',
    [categoryId, tenantId],
  );
  if (!existing) throw new NotFoundError('Category', categoryId);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const catUpdates: string[] = [];
  const catParams: unknown[] = [];
  if (data.slug !== undefined) {
    const newSlug = await ensureUniqueSlug(db, 'categories', tenantId, slugify(data.slug), categoryId);
    catUpdates.push('slug = ?');
    catParams.push(newSlug);
  }
  if (data.parentId !== undefined) { catUpdates.push('parent_id = ?'); catParams.push(data.parentId ?? null); }
  if (data.sortOrder !== undefined) { catUpdates.push('sort_order = ?'); catParams.push(data.sortOrder); }

  if (catUpdates.length > 0) {
    queries.push({
      sql: `UPDATE categories SET ${catUpdates.join(', ')} WHERE id = ?`,
      params: [...catParams, categoryId],
    });
  }

  if (data.name !== undefined || data.description !== undefined) {
    const existingT = await db.queryOne<{ id: string }>(
      'SELECT id FROM category_translations WHERE category_id = ? AND locale = ?',
      [categoryId, locale],
    );

    if (existingT) {
      const tUpdates: string[] = [];
      const tParams: unknown[] = [];
      if (data.name !== undefined) { tUpdates.push('name = ?'); tParams.push(data.name); }
      if (data.description !== undefined) { tUpdates.push('description = ?'); tParams.push(data.description); }
      if (tUpdates.length > 0) {
        queries.push({
          sql: `UPDATE category_translations SET ${tUpdates.join(', ')} WHERE id = ?`,
          params: [...tParams, existingT.id],
        });
      }
    } else {
      queries.push({
        sql: `INSERT INTO category_translations (id, category_id, locale, name, description) VALUES (?, ?, ?, ?, ?)`,
        params: [generateUlid(), categoryId, locale, data.name ?? '', data.description ?? ''],
      });
    }
  }

  if (queries.length > 0) await db.batch(queries);

  return c.json({ success: true });
});

// DELETE /content/categories/:id
content.delete('/categories/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const categoryId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM categories WHERE id = ? AND tenant_id = ?',
    [categoryId, tenantId],
  );
  if (!existing) throw new NotFoundError('Category', categoryId);

  await db.execute('DELETE FROM categories WHERE id = ?', [categoryId]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════════════════════════════════════

const createTagSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  slug: z.string().max(100).optional(),
});

const bulkCreateTagsSchema = z.object({
  names: z.array(z.string().min(1).max(100)).min(1).max(50),
});

// GET /content/tags
content.get('/tags', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);
  const search = c.req.query('search');

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  let where = 't.tenant_id = ?';
  const params: unknown[] = [tenantId];

  if (search) {
    where += ' AND tt.name LIKE ?';
    params.push(`%${search}%`);
  }

  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE ${where}`,
    [locale, ...params],
  );
  const total = countResult?.total ?? 0;

  const tags = await db.query<{
    id: string; slug: string; created_at: string; name: string | null;
  }>(
    `SELECT t.id, t.slug, t.created_at, tt.name
     FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE ${where}
     ORDER BY tt.name ASC
     LIMIT ? OFFSET ?`,
    [locale, ...params, limit, offset],
  );

  return c.json({
    data: tags.map((t) => ({ id: t.id, slug: t.slug, name: t.name ?? t.slug, createdAt: t.created_at })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /content/tags
content.post('/tags', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createTagSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const tagId = generateUlid();
  const rawSlug = data.slug ? slugify(data.slug) : slugify(data.name);
  const slug = await ensureUniqueSlug(db, 'tags', tenantId, rawSlug || `tag-${tagId.slice(0, 8).toLowerCase()}`);

  await db.batch([
    {
      sql: 'INSERT INTO tags (id, tenant_id, slug) VALUES (?, ?, ?)',
      params: [tagId, tenantId, slug],
    },
    {
      sql: 'INSERT INTO tag_translations (id, tag_id, locale, name) VALUES (?, ?, ?, ?)',
      params: [generateUlid(), tagId, locale, data.name],
    },
  ]);

  return c.json({ id: tagId, slug }, 201);
});

// POST /content/tags/bulk
content.post('/tags/bulk', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = bulkCreateTagsSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const db = new D1Client(c.env.DB);
  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const created: Array<{ id: string; slug: string; name: string }> = [];
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  for (const name of parsed.data.names) {
    const tagId = generateUlid();
    const rawSlug = slugify(name);
    const slug = await ensureUniqueSlug(db, 'tags', tenantId, rawSlug || `tag-${tagId.slice(0, 8).toLowerCase()}`);

    queries.push(
      { sql: 'INSERT INTO tags (id, tenant_id, slug) VALUES (?, ?, ?)', params: [tagId, tenantId, slug] },
      { sql: 'INSERT INTO tag_translations (id, tag_id, locale, name) VALUES (?, ?, ?, ?)', params: [generateUlid(), tagId, locale, name.trim()] },
    );
    created.push({ id: tagId, slug, name: name.trim() });
  }

  if (queries.length > 0) await db.batch(queries);

  return c.json({ created }, 201);
});

// DELETE /content/tags/:id
content.delete('/tags/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const tagId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM tags WHERE id = ? AND tenant_id = ?',
    [tagId, tenantId],
  );
  if (!existing) throw new NotFoundError('Tag', tagId);

  await db.execute('DELETE FROM tags WHERE id = ?', [tagId]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMERS
// ═══════════════════════════════════════════════════════════════════════════════

const createPerformerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  slug: z.string().max(150).optional(),
  bio: z.string().max(5000).optional().default(''),
  imageUrl: z.string().url().optional(),
});

const updatePerformerSchema = createPerformerSchema.partial();

// GET /content/performers
content.get('/performers', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM performers WHERE tenant_id = ?',
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const performers = await db.query<{
    id: string; slug: string; image_url: string | null; is_active: number;
    created_at: string; name: string | null; bio: string | null;
  }>(
    `SELECT p.id, p.slug, p.image_url, p.is_active, p.created_at, pt.name, pt.bio
     FROM performers p
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ?
     ORDER BY pt.name ASC
     LIMIT ? OFFSET ?`,
    [locale, tenantId, limit, offset],
  );

  return c.json({
    data: performers.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name ?? p.slug,
      bio: p.bio ?? '',
      imageUrl: p.image_url,
      isActive: p.is_active === 1,
      createdAt: p.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /content/performers
content.post('/performers', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createPerformerSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);
  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const performerId = generateUlid();
  const rawSlug = data.slug ? slugify(data.slug) : slugify(data.name);
  const slug = await ensureUniqueSlug(db, 'performers', tenantId, rawSlug || `performer-${performerId.slice(0, 8).toLowerCase()}`);

  await db.batch([
    {
      sql: 'INSERT INTO performers (id, tenant_id, slug, image_url) VALUES (?, ?, ?, ?)',
      params: [performerId, tenantId, slug, data.imageUrl ?? null],
    },
    {
      sql: 'INSERT INTO performer_translations (id, performer_id, locale, name, bio) VALUES (?, ?, ?, ?, ?)',
      params: [generateUlid(), performerId, locale, data.name, data.bio ?? ''],
    },
  ]);

  return c.json({ id: performerId, slug }, 201);
});

// PUT /content/performers/:id
content.put('/performers/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const performerId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updatePerformerSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM performers WHERE id = ? AND tenant_id = ?',
    [performerId, tenantId],
  );
  if (!existing) throw new NotFoundError('Performer', performerId);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const pUpdates: string[] = [];
  const pParams: unknown[] = [];
  if (data.slug !== undefined) {
    const newSlug = await ensureUniqueSlug(db, 'performers', tenantId, slugify(data.slug), performerId);
    pUpdates.push('slug = ?');
    pParams.push(newSlug);
  }
  if (data.imageUrl !== undefined) { pUpdates.push('image_url = ?'); pParams.push(data.imageUrl ?? null); }

  if (pUpdates.length > 0) {
    queries.push({
      sql: `UPDATE performers SET ${pUpdates.join(', ')} WHERE id = ?`,
      params: [...pParams, performerId],
    });
  }

  if (data.name !== undefined || data.bio !== undefined) {
    const existingT = await db.queryOne<{ id: string }>(
      'SELECT id FROM performer_translations WHERE performer_id = ? AND locale = ?',
      [performerId, locale],
    );
    if (existingT) {
      const tUpdates: string[] = [];
      const tParams: unknown[] = [];
      if (data.name !== undefined) { tUpdates.push('name = ?'); tParams.push(data.name); }
      if (data.bio !== undefined) { tUpdates.push('bio = ?'); tParams.push(data.bio); }
      if (tUpdates.length > 0) {
        queries.push({
          sql: `UPDATE performer_translations SET ${tUpdates.join(', ')} WHERE id = ?`,
          params: [...tParams, existingT.id],
        });
      }
    } else {
      queries.push({
        sql: 'INSERT INTO performer_translations (id, performer_id, locale, name, bio) VALUES (?, ?, ?, ?, ?)',
        params: [generateUlid(), performerId, locale, data.name ?? '', data.bio ?? ''],
      });
    }
  }

  if (queries.length > 0) await db.batch(queries);

  return c.json({ success: true });
});

// DELETE /content/performers/:id
content.delete('/performers/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const performerId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM performers WHERE id = ? AND tenant_id = ?',
    [performerId, tenantId],
  );
  if (!existing) throw new NotFoundError('Performer', performerId);

  await db.execute('DELETE FROM performers WHERE id = ?', [performerId]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════════════════════════════

const createChannelSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  slug: z.string().max(150).optional(),
  description: z.string().max(2000).optional().default(''),
  logoUrl: z.string().url().optional(),
});

const updateChannelSchema = createChannelSchema.partial();

// GET /content/channels
content.get('/channels', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM channels WHERE tenant_id = ?',
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const channels = await db.query<{
    id: string; slug: string; logo_url: string | null; is_active: number;
    created_at: string; name: string | null; description: string | null;
  }>(
    `SELECT ch.id, ch.slug, ch.logo_url, ch.is_active, ch.created_at, cht.name, cht.description
     FROM channels ch
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE ch.tenant_id = ?
     ORDER BY cht.name ASC
     LIMIT ? OFFSET ?`,
    [locale, tenantId, limit, offset],
  );

  return c.json({
    data: channels.map((ch) => ({
      id: ch.id,
      slug: ch.slug,
      name: ch.name ?? ch.slug,
      description: ch.description ?? '',
      logoUrl: ch.logo_url,
      isActive: ch.is_active === 1,
      createdAt: ch.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /content/channels
content.post('/channels', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createChannelSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);
  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const channelId = generateUlid();
  const rawSlug = data.slug ? slugify(data.slug) : slugify(data.name);
  const slug = await ensureUniqueSlug(db, 'channels', tenantId, rawSlug || `channel-${channelId.slice(0, 8).toLowerCase()}`);

  await db.batch([
    {
      sql: 'INSERT INTO channels (id, tenant_id, slug, logo_url) VALUES (?, ?, ?, ?)',
      params: [channelId, tenantId, slug, data.logoUrl ?? null],
    },
    {
      sql: 'INSERT INTO channel_translations (id, channel_id, locale, name, description) VALUES (?, ?, ?, ?, ?)',
      params: [generateUlid(), channelId, locale, data.name, data.description ?? ''],
    },
  ]);

  return c.json({ id: channelId, slug }, 201);
});

// PUT /content/channels/:id
content.put('/channels/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const channelId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateChannelSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM channels WHERE id = ? AND tenant_id = ?',
    [channelId, tenantId],
  );
  if (!existing) throw new NotFoundError('Channel', channelId);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const chUpdates: string[] = [];
  const chParams: unknown[] = [];
  if (data.slug !== undefined) {
    const newSlug = await ensureUniqueSlug(db, 'channels', tenantId, slugify(data.slug), channelId);
    chUpdates.push('slug = ?');
    chParams.push(newSlug);
  }
  if (data.logoUrl !== undefined) { chUpdates.push('logo_url = ?'); chParams.push(data.logoUrl ?? null); }

  if (chUpdates.length > 0) {
    queries.push({
      sql: `UPDATE channels SET ${chUpdates.join(', ')} WHERE id = ?`,
      params: [...chParams, channelId],
    });
  }

  if (data.name !== undefined || data.description !== undefined) {
    const existingT = await db.queryOne<{ id: string }>(
      'SELECT id FROM channel_translations WHERE channel_id = ? AND locale = ?',
      [channelId, locale],
    );
    if (existingT) {
      const tUpdates: string[] = [];
      const tParams: unknown[] = [];
      if (data.name !== undefined) { tUpdates.push('name = ?'); tParams.push(data.name); }
      if (data.description !== undefined) { tUpdates.push('description = ?'); tParams.push(data.description); }
      if (tUpdates.length > 0) {
        queries.push({
          sql: `UPDATE channel_translations SET ${tUpdates.join(', ')} WHERE id = ?`,
          params: [...tParams, existingT.id],
        });
      }
    } else {
      queries.push({
        sql: 'INSERT INTO channel_translations (id, channel_id, locale, name, description) VALUES (?, ?, ?, ?, ?)',
        params: [generateUlid(), channelId, locale, data.name ?? '', data.description ?? ''],
      });
    }
  }

  if (queries.length > 0) await db.batch(queries);

  return c.json({ success: true });
});

// DELETE /content/channels/:id
content.delete('/channels/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const channelId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM channels WHERE id = ? AND tenant_id = ?',
    [channelId, tenantId],
  );
  if (!existing) throw new NotFoundError('Channel', channelId);

  await db.execute('DELETE FROM channels WHERE id = ?', [channelId]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════════════════

const createPageSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  slug: z.string().max(150).optional(),
  content: z.string().max(50000).optional().default(''),
  isPublished: z.boolean().optional().default(false),
});

const updatePageSchema = createPageSchema.partial();

// GET /content/pages
content.get('/pages', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const pages = await db.query<{
    id: string; slug: string; is_published: number; created_at: string;
    updated_at: string; title: string | null; content: string | null;
  }>(
    `SELECT p.id, p.slug, p.is_published, p.created_at, p.updated_at, pt.title, pt.content
     FROM pages p
     LEFT JOIN page_translations pt ON pt.page_id = p.id AND pt.locale = ?
     WHERE p.tenant_id = ?
     ORDER BY p.created_at ASC`,
    [locale, tenantId],
  );

  return c.json({
    data: pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title ?? p.slug,
      content: p.content ?? '',
      isPublished: p.is_published === 1,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })),
  });
});

// POST /content/pages
content.post('/pages', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createPageSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);
  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const pageId = generateUlid();
  const rawSlug = data.slug ? slugify(data.slug) : slugify(data.title);
  const slug = await ensureUniqueSlug(db, 'pages', tenantId, rawSlug || `page-${pageId.slice(0, 8).toLowerCase()}`);

  await db.batch([
    {
      sql: 'INSERT INTO pages (id, tenant_id, slug, is_published) VALUES (?, ?, ?, ?)',
      params: [pageId, tenantId, slug, data.isPublished ? 1 : 0],
    },
    {
      sql: 'INSERT INTO page_translations (id, page_id, locale, title, content) VALUES (?, ?, ?, ?, ?)',
      params: [generateUlid(), pageId, locale, data.title, data.content ?? ''],
    },
  ]);

  return c.json({ id: pageId, slug }, 201);
});

// PUT /content/pages/:id
content.put('/pages/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const pageId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updatePageSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM pages WHERE id = ? AND tenant_id = ?',
    [pageId, tenantId],
  );
  if (!existing) throw new NotFoundError('Page', pageId);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const pUpdates: string[] = [];
  const pParams: unknown[] = [];
  if (data.slug !== undefined) {
    const newSlug = await ensureUniqueSlug(db, 'pages', tenantId, slugify(data.slug), pageId);
    pUpdates.push('slug = ?');
    pParams.push(newSlug);
  }
  if (data.isPublished !== undefined) { pUpdates.push('is_published = ?'); pParams.push(data.isPublished ? 1 : 0); }

  if (pUpdates.length > 0) {
    queries.push({
      sql: `UPDATE pages SET ${pUpdates.join(', ')} WHERE id = ?`,
      params: [...pParams, pageId],
    });
  }

  if (data.title !== undefined || data.content !== undefined) {
    const existingT = await db.queryOne<{ id: string }>(
      'SELECT id FROM page_translations WHERE page_id = ? AND locale = ?',
      [pageId, locale],
    );
    if (existingT) {
      const tUpdates: string[] = [];
      const tParams: unknown[] = [];
      if (data.title !== undefined) { tUpdates.push('title = ?'); tParams.push(data.title); }
      if (data.content !== undefined) { tUpdates.push('content = ?'); tParams.push(data.content); }
      if (tUpdates.length > 0) {
        queries.push({
          sql: `UPDATE page_translations SET ${tUpdates.join(', ')} WHERE id = ?`,
          params: [...tParams, existingT.id],
        });
      }
    } else {
      queries.push({
        sql: 'INSERT INTO page_translations (id, page_id, locale, title, content) VALUES (?, ?, ?, ?, ?)',
        params: [generateUlid(), pageId, locale, data.title ?? '', data.content ?? ''],
      });
    }
  }

  if (queries.length > 0) await db.batch(queries);

  return c.json({ success: true });
});

// DELETE /content/pages/:id
content.delete('/pages/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const pageId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM pages WHERE id = ? AND tenant_id = ?',
    [pageId, tenantId],
  );
  if (!existing) throw new NotFoundError('Page', pageId);

  await db.execute('DELETE FROM pages WHERE id = ?', [pageId]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS (tenant_configs)
// ═══════════════════════════════════════════════════════════════════════════════

const ALLOWED_SETTINGS = [
  'site_name', 'site_logo_url', 'site_favicon_url',
  'color_primary', 'color_secondary',
  'google_analytics_id',
  'custom_css', 'custom_head_scripts', 'custom_body_scripts',
] as const;

const updateSettingsSchema = z.object({
  siteName: z.string().max(200).optional(),
  siteLogoUrl: z.string().url().or(z.literal('')).optional(),
  siteFaviconUrl: z.string().url().or(z.literal('')).optional(),
  colorPrimary: z.string().max(20).optional(),
  colorSecondary: z.string().max(20).optional(),
  googleAnalyticsId: z.string().max(50).optional(),
  customCss: z.string().max(50000).optional(),
  customHeadScripts: z.string().max(10000).optional(),
  customBodyScripts: z.string().max(10000).optional(),
});

// GET /content/settings
content.get('/settings', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const configs = await db.query<{ config_key: string; config_value: string }>(
    'SELECT config_key, config_value FROM tenant_configs WHERE tenant_id = ?',
    [tenantId],
  );

  const settings: Record<string, string> = {};
  for (const cfg of configs) {
    settings[cfg.config_key] = cfg.config_value;
  }

  return c.json({
    siteName: settings['site_name'] ?? '',
    siteLogoUrl: settings['site_logo_url'] ?? '',
    siteFaviconUrl: settings['site_favicon_url'] ?? '',
    colorPrimary: settings['color_primary'] ?? '#8b5cf6',
    colorSecondary: settings['color_secondary'] ?? '#6366f1',
    googleAnalyticsId: settings['google_analytics_id'] ?? '',
    customCss: settings['custom_css'] ?? '',
    customHeadScripts: settings['custom_head_scripts'] ?? '',
    customBodyScripts: settings['custom_body_scripts'] ?? '',
  });
});

// PUT /content/settings
content.put('/settings', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const keyMap: Record<string, string> = {
    siteName: 'site_name',
    siteLogoUrl: 'site_logo_url',
    siteFaviconUrl: 'site_favicon_url',
    colorPrimary: 'color_primary',
    colorSecondary: 'color_secondary',
    googleAnalyticsId: 'google_analytics_id',
    customCss: 'custom_css',
    customHeadScripts: 'custom_head_scripts',
    customBodyScripts: 'custom_body_scripts',
  };

  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  for (const [camelKey, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const dbKey = keyMap[camelKey];
    if (!dbKey) continue;

    queries.push({
      sql: `INSERT INTO tenant_configs (id, tenant_id, config_key, config_value)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tenant_id, config_key) DO UPDATE SET config_value = excluded.config_value`,
      params: [generateUlid(), tenantId, dbKey, value],
    });
  }

  if (queries.length > 0) await db.batch(queries);

  return c.json({ success: true });
});

export { content };
