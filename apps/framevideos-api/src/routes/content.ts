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

/** Decode cursor (base64 of last ULID) */
function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  try {
    return atob(cursor);
  } catch {
    return null;
  }
}

/** Encode cursor from ULID */
function encodeCursor(id: string): string {
  return btoa(id);
}

// ─── Upload constants ────────────────────────────────────────────────────────

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const UPLOAD_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const STORAGE_PUBLIC_URL = 'https://storage.framevideos.com';

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
// UPLOAD (R2)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /content/upload — multipart/form-data image upload to R2
content.post('/upload', async (c) => {
  const tenantId = c.get('tenantId')!;

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw new ValidationError('Content-Type deve ser multipart/form-data');
  }

  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
    throw new ValidationError('Campo "file" é obrigatório');
  }

  // Cast to File-like object (Cloudflare Workers FormData)
  const uploadFile = file as unknown as { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

  // Validate MIME type
  if (!ALLOWED_UPLOAD_TYPES.has(uploadFile.type)) {
    throw new ValidationError(
      `Tipo de arquivo não permitido: ${uploadFile.type}. Aceitos: ${[...ALLOWED_UPLOAD_TYPES].join(', ')}`,
    );
  }

  // Validate size
  if (uploadFile.size > UPLOAD_MAX_SIZE) {
    throw new ValidationError(`Arquivo muito grande (${(uploadFile.size / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB`);
  }

  const ext = MIME_TO_EXT[uploadFile.type] ?? 'bin';
  const fileId = generateUlid();
  const r2Key = `tenants/${tenantId}/thumbnails/${fileId}.${ext}`;

  // Upload to R2
  const arrayBuffer = await uploadFile.arrayBuffer();
  await c.env.STORAGE.put(r2Key, arrayBuffer, {
    httpMetadata: {
      contentType: uploadFile.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      tenantId,
      originalName: uploadFile.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  const publicUrl = `${STORAGE_PUBLIC_URL}/${r2Key}`;

  return c.json({
    key: r2Key,
    url: publicUrl,
    size: uploadFile.size,
    contentType: uploadFile.type,
  }, 201);
});

// GET /content/upload/:key+ — generate signed/public URL for a stored object
content.get('/upload/*', async (c) => {
  const tenantId = c.get('tenantId')!;
  const key = c.req.path.replace('/content/upload/', '');

  if (!key) {
    throw new ValidationError('Key é obrigatório');
  }

  // Security: only allow access to own tenant's files
  if (!key.startsWith(`tenants/${tenantId}/`)) {
    throw new ForbiddenError('Acesso negado a este arquivo');
  }

  // Check if object exists
  const head = await c.env.STORAGE.head(key);
  if (!head) {
    throw new NotFoundError('File', key);
  }

  // Return public URL (R2 custom domain or direct URL)
  const publicUrl = `${STORAGE_PUBLIC_URL}/${key}`;

  return c.json({
    key,
    url: publicUrl,
    size: head.size,
    contentType: head.httpMetadata?.contentType ?? 'application/octet-stream',
    uploaded: head.uploaded.toISOString(),
  });
});

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

// GET /content/videos — supports offset + cursor-based pagination, advanced filters, sorting
content.get('/videos', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c);

  // Cursor-based pagination (takes priority if provided)
  const cursorParam = c.req.query('cursor');
  const cursorId = decodeCursor(cursorParam);
  const useCursor = Boolean(cursorParam);

  // Filters
  const status = c.req.query('status');
  const search = c.req.query('search');
  const categoryId = c.req.query('category_id');
  const tagId = c.req.query('tag_id');
  const performerId = c.req.query('performer_id');
  const channelId = c.req.query('channel_id');
  const dateFrom = c.req.query('date_from');
  const dateTo = c.req.query('date_to');

  // Sorting
  const sort = c.req.query('sort') ?? 'newest';

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

  if (tagId) {
    where += ' AND EXISTS (SELECT 1 FROM video_tags vtg WHERE vtg.video_id = v.id AND vtg.tag_id = ?)';
    params.push(tagId);
  }

  if (performerId) {
    where += ' AND EXISTS (SELECT 1 FROM video_performers vp WHERE vp.video_id = v.id AND vp.performer_id = ?)';
    params.push(performerId);
  }

  if (channelId) {
    where += ' AND EXISTS (SELECT 1 FROM video_channels vch WHERE vch.video_id = v.id AND vch.channel_id = ?)';
    params.push(channelId);
  }

  if (dateFrom) {
    where += ' AND v.created_at >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    where += ' AND v.created_at <= ?';
    params.push(dateTo);
  }

  // Cursor filter (ULID is lexicographically sortable)
  if (useCursor && cursorId) {
    if (sort === 'oldest') {
      where += ' AND v.id > ?';
    } else {
      // For newest (default), views, title — use id < cursor for next page
      where += ' AND v.id < ?';
    }
    params.push(cursorId);
  }

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  // Count total (without cursor filter for accurate total)
  const countWhere = where.replace(/ AND v\.id [<>] \?$/, '');
  const countParams = useCursor && cursorId ? params.slice(0, -1) : [...params];
  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE ${countWhere}`,
    [locale, ...countParams],
  );
  const total = countResult?.total ?? 0;

  // Order clause
  let orderBy = 'v.created_at DESC, v.id DESC';
  switch (sort) {
    case 'oldest': orderBy = 'v.created_at ASC, v.id ASC'; break;
    case 'views': orderBy = 'v.view_count DESC, v.id DESC'; break;
    case 'title': orderBy = 'vt.title ASC, v.id ASC'; break;
    default: orderBy = 'v.created_at DESC, v.id DESC';
  }

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
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [locale, ...params, limit, useCursor ? 0 : offset],
  );

  const mapped = videos.map((v) => ({
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
  }));

  // Build cursor-based pagination response
  const lastItem = videos[videos.length - 1];
  const nextCursor = lastItem ? encodeCursor(lastItem.id) : null;
  const hasMore = videos.length === limit;

  return c.json({
    data: mapped,
    pagination: useCursor
      ? { cursor: nextCursor, hasMore, total, limit }
      : { page, limit, total, totalPages: Math.ceil(total / limit) },
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

// ─── Bulk Operations ─────────────────────────────────────────────────────────

const bulkVideoActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(50, 'Máximo de 50 itens por vez'),
  action: z.enum(['publish', 'draft', 'archive', 'delete']),
});

// POST /content/videos/bulk
content.post('/videos/bulk', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = bulkVideoActionSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const { ids, action } = parsed.data;
  const db = new D1Client(c.env.DB);

  let success = 0;
  let failed = 0;

  if (action === 'delete') {
    // Delete videos that belong to this tenant
    for (const videoId of ids) {
      try {
        const existing = await db.queryOne<{ id: string }>(
          'SELECT id FROM videos WHERE id = ? AND tenant_id = ?',
          [videoId, tenantId],
        );
        if (existing) {
          await db.execute('DELETE FROM videos WHERE id = ?', [videoId]);
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } else {
    // Map action to status
    const statusMap: Record<string, string> = {
      publish: 'published',
      draft: 'draft',
      archive: 'archived',
    };
    const newStatus = statusMap[action]!;

    for (const videoId of ids) {
      try {
        const existing = await db.queryOne<{ id: string; status: string }>(
          'SELECT id, status FROM videos WHERE id = ? AND tenant_id = ?',
          [videoId, tenantId],
        );
        if (existing) {
          const updates = [`status = '${newStatus}'`];
          if (newStatus === 'published' && existing.status !== 'published') {
            updates.push("published_at = datetime('now')");
          }
          await db.execute(
            `UPDATE videos SET ${updates.join(', ')} WHERE id = ?`,
            [videoId],
          );
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  }

  return c.json({ success, failed });
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

// GET /content/categories — supports offset + cursor pagination
content.get('/categories', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);
  const cursorParam = c.req.query('cursor');
  const cursorId = decodeCursor(cursorParam);
  const useCursor = Boolean(cursorParam);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  let where = 'c.tenant_id = ?';
  const params: unknown[] = [tenantId];

  if (useCursor && cursorId) {
    where += ' AND c.id > ?';
    params.push(cursorId);
  }

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
     WHERE ${where}
     ORDER BY c.sort_order ASC, c.created_at ASC
     LIMIT ? OFFSET ?`,
    [locale, ...params, limit, useCursor ? 0 : offset],
  );

  const lastItem = categories[categories.length - 1];

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
    pagination: useCursor
      ? { cursor: lastItem ? encodeCursor(lastItem.id) : null, hasMore: categories.length === limit, total, limit }
      : { page, limit, total, totalPages: Math.ceil(total / limit) },
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

// GET /content/tags — supports offset + cursor pagination
content.get('/tags', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);
  const search = c.req.query('search');
  const cursorParam = c.req.query('cursor');
  const cursorId = decodeCursor(cursorParam);
  const useCursor = Boolean(cursorParam);

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

  if (useCursor && cursorId) {
    where += ' AND t.id > ?';
    params.push(cursorId);
  }

  const countWhere = where.replace(/ AND t\.id > \?$/, '');
  const countParams = useCursor && cursorId ? params.slice(0, -1) : [...params];
  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM tags t
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE ${countWhere}`,
    [locale, ...countParams],
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
    [locale, ...params, limit, useCursor ? 0 : offset],
  );

  const lastItem = tags[tags.length - 1];

  return c.json({
    data: tags.map((t) => ({ id: t.id, slug: t.slug, name: t.name ?? t.slug, createdAt: t.created_at })),
    pagination: useCursor
      ? { cursor: lastItem ? encodeCursor(lastItem.id) : null, hasMore: tags.length === limit, total, limit }
      : { page, limit, total, totalPages: Math.ceil(total / limit) },
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

// GET /content/performers — supports offset + cursor pagination
content.get('/performers', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);
  const cursorParam = c.req.query('cursor');
  const cursorId = decodeCursor(cursorParam);
  const useCursor = Boolean(cursorParam);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  let where = 'p.tenant_id = ?';
  const params: unknown[] = [tenantId];

  if (useCursor && cursorId) {
    where += ' AND p.id > ?';
    params.push(cursorId);
  }

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
     WHERE ${where}
     ORDER BY pt.name ASC
     LIMIT ? OFFSET ?`,
    [locale, ...params, limit, useCursor ? 0 : offset],
  );

  const lastItem = performers[performers.length - 1];

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
    pagination: useCursor
      ? { cursor: lastItem ? encodeCursor(lastItem.id) : null, hasMore: performers.length === limit, total, limit }
      : { page, limit, total, totalPages: Math.ceil(total / limit) },
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

// GET /content/channels — supports offset + cursor pagination
content.get('/channels', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);
  const cursorParam = c.req.query('cursor');
  const cursorId = decodeCursor(cursorParam);
  const useCursor = Boolean(cursorParam);

  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  let where = 'ch.tenant_id = ?';
  const params: unknown[] = [tenantId];

  if (useCursor && cursorId) {
    where += ' AND ch.id > ?';
    params.push(cursorId);
  }

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
     WHERE ${where}
     ORDER BY cht.name ASC
     LIMIT ? OFFSET ?`,
    [locale, ...params, limit, useCursor ? 0 : offset],
  );

  const lastItem = channels[channels.length - 1];

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
    pagination: useCursor
      ? { cursor: lastItem ? encodeCursor(lastItem.id) : null, hasMore: channels.length === limit, total, limit }
      : { page, limit, total, totalPages: Math.ceil(total / limit) },
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

// ═══════════════════════════════════════════════════════════════════════════════
// LOCALE SETTINGS (i18n)
// ═══════════════════════════════════════════════════════════════════════════════

const SUPPORTED_LOCALES = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ru', 'nl', 'pl', 'tr', 'ar'] as const;

const LOCALE_LABELS: Record<string, string> = {
  pt: 'Português', en: 'English', es: 'Español', fr: 'Français',
  de: 'Deutsch', it: 'Italiano', ja: '日本語', zh: '中文',
  ko: '한국어', ru: 'Русский', nl: 'Nederlands', pl: 'Polski',
  tr: 'Türkçe', ar: 'العربية',
};

// GET /content/settings/locales — get enabled locales for tenant
content.get('/settings/locales', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const enabledRow = await db.queryOne<{ config_value: string }>(
    "SELECT config_value FROM tenant_configs WHERE tenant_id = ? AND config_key = 'enabled_locales'",
    [tenantId],
  );
  const defaultRow = await db.queryOne<{ config_value: string }>(
    "SELECT config_value FROM tenant_configs WHERE tenant_id = ? AND config_key = 'default_locale'",
    [tenantId],
  );

  let enabledLocales: string[];
  try {
    enabledLocales = enabledRow ? JSON.parse(enabledRow.config_value) : ['pt'];
  } catch {
    enabledLocales = ['pt'];
  }
  const defaultLocale = defaultRow?.config_value ?? 'pt';

  return c.json({
    enabledLocales,
    defaultLocale,
    supportedLocales: SUPPORTED_LOCALES,
    localeLabels: LOCALE_LABELS,
  });
});

// PUT /content/settings/locales — update enabled locales for tenant
const updateLocalesSchema = z.object({
  enabledLocales: z.array(z.string()).min(1, 'Pelo menos um idioma deve estar habilitado'),
  defaultLocale: z.string().min(2).max(5),
});

content.put('/settings/locales', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = updateLocalesSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const { enabledLocales, defaultLocale } = parsed.data;

  // Validate all locales are supported
  for (const loc of enabledLocales) {
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(loc)) {
      throw new ValidationError(`Locale não suportado: ${loc}`);
    }
  }
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(defaultLocale)) {
    throw new ValidationError(`Locale padrão não suportado: ${defaultLocale}`);
  }
  if (!enabledLocales.includes(defaultLocale)) {
    throw new ValidationError('O locale padrão deve estar na lista de locales habilitados');
  }

  const db = new D1Client(c.env.DB);

  await db.batch([
    {
      sql: `INSERT INTO tenant_configs (id, tenant_id, config_key, config_value)
            VALUES (?, ?, 'enabled_locales', ?)
            ON CONFLICT(tenant_id, config_key) DO UPDATE SET config_value = excluded.config_value`,
      params: [generateUlid(), tenantId, JSON.stringify(enabledLocales)],
    },
    {
      sql: `INSERT INTO tenant_configs (id, tenant_id, config_key, config_value)
            VALUES (?, ?, 'default_locale', ?)
            ON CONFLICT(tenant_id, config_key) DO UPDATE SET config_value = excluded.config_value`,
      params: [generateUlid(), tenantId, defaultLocale],
    },
  ]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATION CRUD (i18n) — Generic for all content types
// ═══════════════════════════════════════════════════════════════════════════════

const translationSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(500),
  slug: z.string().max(300).optional(),
  description: z.string().max(10000).optional().default(''),
  seoTitle: z.string().max(200).optional().default(''),
  seoDescription: z.string().max(500).optional().default(''),
});

// Translation table config per content type
interface TranslationConfig {
  table: string;
  parentTable: string;
  parentIdColumn: string;
  fields: string[];
  hasContent?: boolean; // pages have 'content' instead of 'description'
}

const TRANSLATION_CONFIGS: Record<string, TranslationConfig> = {
  videos: {
    table: 'video_translations',
    parentTable: 'videos',
    parentIdColumn: 'video_id',
    fields: ['title', 'slug', 'description', 'seo_title', 'seo_description'],
  },
  categories: {
    table: 'category_translations',
    parentTable: 'categories',
    parentIdColumn: 'category_id',
    fields: ['name', 'slug', 'description', 'seo_title', 'seo_description'],
  },
  tags: {
    table: 'tag_translations',
    parentTable: 'tags',
    parentIdColumn: 'tag_id',
    fields: ['name', 'slug', 'seo_title', 'seo_description'],
  },
  performers: {
    table: 'performer_translations',
    parentTable: 'performers',
    parentIdColumn: 'performer_id',
    fields: ['name', 'slug', 'bio', 'seo_title', 'seo_description'],
  },
  channels: {
    table: 'channel_translations',
    parentTable: 'channels',
    parentIdColumn: 'channel_id',
    fields: ['name', 'slug', 'description', 'seo_title', 'seo_description'],
  },
  pages: {
    table: 'page_translations',
    parentTable: 'pages',
    parentIdColumn: 'page_id',
    fields: ['title', 'slug', 'content', 'seo_title', 'seo_description'],
    hasContent: true,
  },
};

/** Ensure unique slug in translation table per tenant+locale */
async function ensureUniqueTranslationSlug(
  db: D1Client,
  config: TranslationConfig,
  tenantId: string,
  locale: string,
  slug: string,
  excludeParentId?: string,
): Promise<string> {
  let candidate = slug;
  let counter = 0;
  const maxAttempts = 20;

  while (counter < maxAttempts) {
    const params: unknown[] = [locale, candidate, tenantId];
    let excludeClause = '';
    if (excludeParentId) {
      excludeClause = ` AND t.${config.parentIdColumn} != ?`;
      params.push(excludeParentId);
    }

    const existing = await db.queryOne<{ id: string }>(
      `SELECT t.id FROM ${config.table} t
       JOIN ${config.parentTable} p ON p.id = t.${config.parentIdColumn}
       WHERE t.locale = ? AND t.slug = ? AND p.tenant_id = ?${excludeClause}`,
      params,
    );

    if (!existing) return candidate;
    counter++;
    candidate = `${slug}-${counter}`;
  }

  return `${slug}-${Date.now().toString(36)}`;
}

// Register translation routes for each content type
for (const [contentType, config] of Object.entries(TRANSLATION_CONFIGS)) {
  const singularParam = contentType === 'categories' ? 'categories' : contentType;

  // GET /content/{type}/:id/translations — list all translations
  content.get(`/${contentType}/:id/translations`, async (c) => {
    const tenantId = c.get('tenantId')!;
    const parentId = c.req.param('id');
    const db = new D1Client(c.env.DB);

    // Verify parent exists and belongs to tenant
    const parent = await db.queryOne<{ id: string }>(
      `SELECT id FROM ${config.parentTable} WHERE id = ? AND tenant_id = ?`,
      [parentId, tenantId],
    );
    if (!parent) throw new NotFoundError(contentType, parentId);

    const translations = await db.query<Record<string, unknown>>(
      `SELECT * FROM ${config.table} WHERE ${config.parentIdColumn} = ?`,
      [parentId],
    );

    return c.json({
      data: translations.map((t) => {
        const result: Record<string, unknown> = {
          locale: t['locale'],
          title: t['title'] ?? t['name'] ?? '',
          slug: t['slug'] ?? '',
          description: t['description'] ?? t['bio'] ?? t['content'] ?? '',
          seoTitle: t['seo_title'] ?? '',
          seoDescription: t['seo_description'] ?? '',
        };
        return result;
      }),
    });
  });

  // PUT /content/{type}/:id/translations/:locale — create/update translation
  content.put(`/${contentType}/:id/translations/:locale`, async (c) => {
    const tenantId = c.get('tenantId')!;
    const parentId = c.req.param('id');
    const locale = c.req.param('locale');
    const db = new D1Client(c.env.DB);

    // Validate locale
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
      throw new ValidationError(`Locale não suportado: ${locale}`);
    }

    // Verify parent exists
    const parent = await db.queryOne<{ id: string }>(
      `SELECT id FROM ${config.parentTable} WHERE id = ? AND tenant_id = ?`,
      [parentId, tenantId],
    );
    if (!parent) throw new NotFoundError(contentType, parentId);

    const body = await c.req.json();
    const parsed = translationSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })));
    }

    const data = parsed.data;

    // Generate slug from title if not provided
    const rawSlug = data.slug ? slugify(data.slug) : slugify(data.title);
    const slug = await ensureUniqueTranslationSlug(db, config, tenantId, locale, rawSlug || `${contentType.slice(0, 3)}-${parentId.slice(0, 8).toLowerCase()}`, parentId);

    // Check if translation exists
    const existing = await db.queryOne<{ id: string }>(
      `SELECT id FROM ${config.table} WHERE ${config.parentIdColumn} = ? AND locale = ?`,
      [parentId, locale],
    );

    // Determine field names based on content type
    const nameField = config.fields.includes('title') ? 'title' : 'name';
    const descField = config.hasContent ? 'content' : (config.fields.includes('description') ? 'description' : (config.fields.includes('bio') ? 'bio' : null));

    if (existing) {
      const updates: string[] = [`${nameField} = ?`, 'slug = ?', 'seo_title = ?', 'seo_description = ?'];
      const params: unknown[] = [data.title, slug, data.seoTitle, data.seoDescription];

      if (descField) {
        updates.push(`${descField} = ?`);
        params.push(data.description);
      }

      params.push(existing.id);
      await db.execute(
        `UPDATE ${config.table} SET ${updates.join(', ')} WHERE id = ?`,
        params,
      );
    } else {
      const columns = ['id', config.parentIdColumn, 'locale', nameField, 'slug', 'seo_title', 'seo_description'];
      const values: unknown[] = [generateUlid(), parentId, locale, data.title, slug, data.seoTitle, data.seoDescription];

      if (descField) {
        columns.push(descField);
        values.push(data.description);
      }

      await db.execute(
        `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values,
      );
    }

    return c.json({ success: true, slug });
  });

  // DELETE /content/{type}/:id/translations/:locale — remove translation
  content.delete(`/${contentType}/:id/translations/:locale`, async (c) => {
    const tenantId = c.get('tenantId')!;
    const parentId = c.req.param('id');
    const locale = c.req.param('locale');
    const db = new D1Client(c.env.DB);

    // Verify parent exists
    const parent = await db.queryOne<{ id: string }>(
      `SELECT id FROM ${config.parentTable} WHERE id = ? AND tenant_id = ?`,
      [parentId, tenantId],
    );
    if (!parent) throw new NotFoundError(contentType, parentId);

    // Don't allow deleting the default locale translation
    const tenant = await db.queryOne<{ default_locale: string }>(
      'SELECT default_locale FROM tenants WHERE id = ?',
      [tenantId],
    );
    const defaultLocale = tenant?.default_locale ?? 'pt_BR';

    // Check against both old and new locale formats
    const defaultRow = await db.queryOne<{ config_value: string }>(
      "SELECT config_value FROM tenant_configs WHERE tenant_id = ? AND config_key = 'default_locale'",
      [tenantId],
    );
    const configDefaultLocale = defaultRow?.config_value ?? defaultLocale;

    if (locale === configDefaultLocale || locale === defaultLocale) {
      throw new ValidationError('Não é possível remover a tradução do idioma padrão');
    }

    await db.execute(
      `DELETE FROM ${config.table} WHERE ${config.parentIdColumn} = ? AND locale = ?`,
      [parentId, locale],
    );

    return c.json({ success: true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIRECTS
// ═══════════════════════════════════════════════════════════════════════════════

const createRedirectSchema = z.object({
  fromPath: z.string().min(1, 'Caminho de origem é obrigatório').max(500),
  toPath: z.string().min(1, 'Caminho de destino é obrigatório').max(500),
  statusCode: z.number().int().refine((v) => v === 301 || v === 302, 'Status deve ser 301 ou 302'),
});

const updateRedirectSchema = createRedirectSchema.partial();

// GET /content/redirects
content.get('/redirects', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c, 50);

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM redirects WHERE tenant_id = ?',
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const redirects = await db.query<{
    id: string; from_path: string; to_path: string; status_code: number; created_at: string;
  }>(
    `SELECT id, from_path, to_path, status_code, created_at
     FROM redirects WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, limit, offset],
  );

  return c.json({
    data: redirects.map((r) => ({
      id: r.id,
      fromPath: r.from_path,
      toPath: r.to_path,
      statusCode: r.status_code,
      createdAt: r.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /content/redirects
content.post('/redirects', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createRedirectSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const { fromPath, toPath, statusCode } = parsed.data;
  const db = new D1Client(c.env.DB);

  // Check for duplicate from_path
  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM redirects WHERE tenant_id = ? AND from_path = ?',
    [tenantId, fromPath],
  );
  if (existing) {
    throw new ConflictError(`Já existe um redirect para o caminho: ${fromPath}`);
  }

  const id = generateUlid();
  await db.execute(
    `INSERT INTO redirects (id, tenant_id, from_path, to_path, status_code) VALUES (?, ?, ?, ?, ?)`,
    [id, tenantId, fromPath, toPath, statusCode],
  );

  return c.json({ id }, 201);
});

// PUT /content/redirects/:id
content.put('/redirects/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const redirectId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateRedirectSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM redirects WHERE id = ? AND tenant_id = ?',
    [redirectId, tenantId],
  );
  if (!existing) throw new NotFoundError('Redirect', redirectId);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.fromPath !== undefined) { updates.push('from_path = ?'); params.push(data.fromPath); }
  if (data.toPath !== undefined) { updates.push('to_path = ?'); params.push(data.toPath); }
  if (data.statusCode !== undefined) { updates.push('status_code = ?'); params.push(data.statusCode); }

  if (updates.length > 0) {
    params.push(redirectId);
    await db.execute(`UPDATE redirects SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  return c.json({ success: true });
});

// DELETE /content/redirects/:id
content.delete('/redirects/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const redirectId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM redirects WHERE id = ? AND tenant_id = ?',
    [redirectId, tenantId],
  );
  if (!existing) throw new NotFoundError('Redirect', redirectId);

  await db.execute('DELETE FROM redirects WHERE id = ?', [redirectId]);

  return c.json({ success: true });
});

export { content };
