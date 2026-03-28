// Crawler routes — Sprint 10
// CRUD for crawler sources + execution + run history

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@frame-videos/shared/errors';
import { executeCrawl } from '../services/crawler.js';

const crawler = new Hono<AppContext>();

// ─── Auth + admin guard ──────────────────────────────────────────────────────

crawler.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});
crawler.use('*', async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'tenant_admin' && role !== 'super_admin') {
    throw new ForbiddenError('Apenas administradores podem gerenciar o crawler');
  }
  await next();
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const selectorsSchema = z.object({
  videoLink: z.string().min(1, 'Seletor de link é obrigatório'),
  title: z.string().min(1, 'Seletor de título é obrigatório'),
  thumbnail: z.string().min(1, 'Seletor de thumbnail é obrigatório'),
  duration: z.string().optional(),
});

const createSourceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  url: z.string().url('URL inválida').max(2000),
  selectors: selectorsSchema,
  schedule: z.enum(['manual', 'daily', 'weekly']).default('manual'),
  active: z.boolean().default(true),
});

const updateSourceSchema = createSourceSchema.partial();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginationParams(c: { req: { query: (k: string) => string | undefined } }, defaultLimit = 20) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? String(defaultLimit), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// POST /crawler/sources — create a new crawler source
crawler.post('/sources', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = createSourceSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);
  const id = generateUlid();

  await db.execute(
    `INSERT INTO crawler_sources (id, tenant_id, name, base_url, config_json, crawler_type, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, data.name, data.url, JSON.stringify(data.selectors), data.schedule, data.active ? 1 : 0],
  );

  return c.json({ id, name: data.name }, 201);
});

// GET /crawler/sources — list all sources for tenant
crawler.get('/sources', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c);

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM crawler_sources WHERE tenant_id = ?',
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const sources = await db.query<{
    id: string; name: string; base_url: string; config_json: string;
    crawler_type: string; is_active: number; last_run_at: string | null;
    created_at: string; updated_at: string;
  }>(
    `SELECT id, name, base_url, config_json, crawler_type, is_active, last_run_at, created_at, updated_at
     FROM crawler_sources
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, limit, offset],
  );

  // Get last run status for each source
  const sourceIds = sources.map((s) => s.id);
  let lastRuns: Record<string, { status: string; videos_found: number; videos_new: number }> = {};

  if (sourceIds.length > 0) {
    const runs = await db.query<{
      source_id: string; status: string; videos_found: number; videos_imported: number;
    }>(
      `SELECT cr.source_id, cr.status, cr.videos_found, cr.videos_imported
       FROM crawler_runs cr
       INNER JOIN (
         SELECT source_id, MAX(started_at) as max_started
         FROM crawler_runs
         WHERE source_id IN (${sourceIds.map(() => '?').join(',')})
         GROUP BY source_id
       ) latest ON cr.source_id = latest.source_id AND cr.started_at = latest.max_started`,
      sourceIds,
    );

    for (const run of runs) {
      lastRuns[run.source_id] = {
        status: run.status,
        videos_found: run.videos_found,
        videos_new: run.videos_imported,
      };
    }
  }

  return c.json({
    data: sources.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.base_url,
      selectors: JSON.parse(s.config_json || '{}'),
      schedule: s.crawler_type,
      active: s.is_active === 1,
      lastRunAt: s.last_run_at,
      lastRun: lastRuns[s.id] ?? null,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// PUT /crawler/sources/:id — update a source
crawler.put('/sources/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const sourceId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateSourceSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }

  const data = parsed.data;
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM crawler_sources WHERE id = ? AND tenant_id = ?',
    [sourceId, tenantId],
  );
  if (!existing) throw new NotFoundError('Crawler Source', sourceId);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.url !== undefined) { updates.push('base_url = ?'); params.push(data.url); }
  if (data.selectors !== undefined) { updates.push('config_json = ?'); params.push(JSON.stringify(data.selectors)); }
  if (data.schedule !== undefined) { updates.push('crawler_type = ?'); params.push(data.schedule); }
  if (data.active !== undefined) { updates.push('is_active = ?'); params.push(data.active ? 1 : 0); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(sourceId);
    await db.execute(
      `UPDATE crawler_sources SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );
  }

  return c.json({ success: true });
});

// DELETE /crawler/sources/:id — delete a source
crawler.delete('/sources/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const sourceId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM crawler_sources WHERE id = ? AND tenant_id = ?',
    [sourceId, tenantId],
  );
  if (!existing) throw new NotFoundError('Crawler Source', sourceId);

  // Delete runs first (no cascade in D1)
  await db.execute('DELETE FROM crawler_runs WHERE source_id = ?', [sourceId]);
  await db.execute('DELETE FROM crawler_sources WHERE id = ?', [sourceId]);

  return c.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RUN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

// POST /crawler/sources/:id/run — execute a manual crawl
crawler.post('/sources/:id/run', async (c) => {
  const tenantId = c.get('tenantId')!;
  const sourceId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const source = await db.queryOne<{ id: string; is_active: number }>(
    'SELECT id, is_active FROM crawler_sources WHERE id = ? AND tenant_id = ?',
    [sourceId, tenantId],
  );
  if (!source) throw new NotFoundError('Crawler Source', sourceId);

  // Execute crawl
  const result = await executeCrawl(sourceId, tenantId, c.env);

  return c.json(result);
});

// ═══════════════════════════════════════════════════════════════════════════════
// RUN HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /crawler/runs — list run history for tenant
crawler.get('/runs', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c);

  const sourceId = c.req.query('source_id');

  let where = 'cr.tenant_id = ?';
  const params: unknown[] = [tenantId];

  if (sourceId) {
    where += ' AND cr.source_id = ?';
    params.push(sourceId);
  }

  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM crawler_runs cr WHERE ${where}`,
    params,
  );
  const total = countResult?.total ?? 0;

  const runs = await db.query<{
    id: string; source_id: string; status: string;
    videos_found: number; videos_imported: number;
    log_json: string; started_at: string; completed_at: string | null;
    source_name: string | null;
  }>(
    `SELECT cr.id, cr.source_id, cr.status, cr.videos_found, cr.videos_imported,
            cr.log_json, cr.started_at, cr.completed_at,
            cs.name as source_name
     FROM crawler_runs cr
     LEFT JOIN crawler_sources cs ON cs.id = cr.source_id
     WHERE ${where}
     ORDER BY cr.started_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return c.json({
    data: runs.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_name,
      status: r.status,
      videosFound: r.videos_found,
      videosNew: r.videos_imported,
      videosDuplicate: (r.videos_found ?? 0) - (r.videos_imported ?? 0),
      errors: JSON.parse(r.log_json || '[]'),
      startedAt: r.started_at,
      completedAt: r.completed_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /crawler/runs/:id — get run details
crawler.get('/runs/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const runId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const run = await db.queryOne<{
    id: string; source_id: string; status: string;
    videos_found: number; videos_imported: number;
    log_json: string; started_at: string; completed_at: string | null;
    source_name: string | null; source_url: string | null;
  }>(
    `SELECT cr.id, cr.source_id, cr.status, cr.videos_found, cr.videos_imported,
            cr.log_json, cr.started_at, cr.completed_at,
            cs.name as source_name, cs.base_url as source_url
     FROM crawler_runs cr
     LEFT JOIN crawler_sources cs ON cs.id = cr.source_id
     WHERE cr.id = ? AND cr.tenant_id = ?`,
    [runId, tenantId],
  );

  if (!run) throw new NotFoundError('Crawler Run', runId);

  return c.json({
    id: run.id,
    sourceId: run.source_id,
    sourceName: run.source_name,
    sourceUrl: run.source_url,
    status: run.status,
    videosFound: run.videos_found,
    videosNew: run.videos_imported,
    videosDuplicate: (run.videos_found ?? 0) - (run.videos_imported ?? 0),
    errors: JSON.parse(run.log_json || '[]'),
    startedAt: run.started_at,
    completedAt: run.completed_at,
  });
});

export { crawler };
