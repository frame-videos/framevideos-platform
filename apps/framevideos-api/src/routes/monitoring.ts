// Health monitoring routes — Sprint 9
// Domain uptime checks, incident tracking

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';
import { ValidationError } from '@frame-videos/shared/errors';

const monitoring = new Hono<AppContext>();

// ─── Auth middleware (all routes) ────────────────────────────────────────────

monitoring.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const checkSchema = z.object({
  domain: z.string().min(1).max(253),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function performHealthCheck(
  domain: string,
): Promise<{ statusCode: number; responseTimeMs: number; isHealthy: boolean }> {
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'FrameVideos-Monitor/1.0',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;
    const isHealthy = response.status >= 200 && response.status < 400;

    return { statusCode: response.status, responseTimeMs, isHealthy };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    return { statusCode: 0, responseTimeMs, isHealthy: false };
  }
}

async function handleIncident(
  db: D1Client,
  tenantId: string,
  domain: string,
  isHealthy: boolean,
  now: string,
): Promise<void> {
  // Check for open incident
  const openIncident = await db.queryOne<{ id: string; started_at: string }>(
    `SELECT id, started_at FROM incidents WHERE tenant_id = ? AND domain = ? AND status = 'open' LIMIT 1`,
    [tenantId, domain],
  );

  if (!isHealthy && !openIncident) {
    // Create new incident
    const id = generateUlid();
    await db.execute(
      `INSERT INTO incidents (id, tenant_id, domain, started_at, status, alert_sent)
       VALUES (?, ?, ?, ?, 'open', 0)`,
      [id, tenantId, domain, now],
    );
  } else if (isHealthy && openIncident) {
    // Resolve incident
    const startedAt = new Date(openIncident.started_at).getTime();
    const resolvedAt = new Date(now).getTime();
    const durationSeconds = Math.round((resolvedAt - startedAt) / 1000);

    await db.execute(
      `UPDATE incidents SET resolved_at = ?, duration_seconds = ?, status = 'resolved' WHERE id = ?`,
      [now, durationSeconds, openIncident.id],
    );
  }
}

// ─── GET /status — Current status of all tenant domains ──────────────────────

monitoring.get('/status', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  // Get tenant's domains
  const domains = await db.query<{ domain: string; is_primary: number }>(
    `SELECT domain, is_primary FROM domains WHERE tenant_id = ? AND status = 'active'`,
    [tenantId],
  );

  if (!domains || domains.length === 0) {
    return c.json({ domains: [], message: 'Nenhum domínio ativo encontrado.' });
  }

  // Get latest check for each domain
  const statuses = [];
  for (const d of domains) {
    const latestCheck = await db.queryOne<{
      status_code: number;
      response_time_ms: number;
      is_healthy: number;
      checked_at: string;
    }>(
      `SELECT status_code, response_time_ms, is_healthy, checked_at
       FROM health_checks
       WHERE tenant_id = ? AND domain = ?
       ORDER BY checked_at DESC
       LIMIT 1`,
      [tenantId, d.domain],
    );

    const openIncident = await db.queryOne<{ id: string; started_at: string }>(
      `SELECT id, started_at FROM incidents WHERE tenant_id = ? AND domain = ? AND status = 'open' LIMIT 1`,
      [tenantId, d.domain],
    );

    statuses.push({
      domain: d.domain,
      isPrimary: !!d.is_primary,
      lastCheck: latestCheck
        ? {
            statusCode: latestCheck.status_code,
            responseTimeMs: latestCheck.response_time_ms,
            isHealthy: !!latestCheck.is_healthy,
            checkedAt: latestCheck.checked_at,
          }
        : null,
      hasOpenIncident: !!openIncident,
      incidentStartedAt: openIncident?.started_at ?? null,
    });
  }

  return c.json({ domains: statuses });
});

// ─── GET /history — Health check history (paginated) ─────────────────────────

monitoring.get('/history', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const page = Math.max(parseInt(c.req.query('page') ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10), 1), 200);
  const offset = (page - 1) * limit;
  const domain = c.req.query('domain');

  let countSql = `SELECT COUNT(*) as total FROM health_checks WHERE tenant_id = ?`;
  let listSql = `SELECT id, domain, status_code, response_time_ms, is_healthy, checked_at FROM health_checks WHERE tenant_id = ?`;
  const params: unknown[] = [tenantId];

  if (domain) {
    countSql += ` AND domain = ?`;
    listSql += ` AND domain = ?`;
    params.push(domain);
  }

  const countResult = await db.queryOne<{ total: number }>(countSql, params);
  const total = countResult?.total ?? 0;

  listSql += ` ORDER BY checked_at DESC LIMIT ? OFFSET ?`;
  const checks = await db.query<{
    id: string;
    domain: string;
    status_code: number;
    response_time_ms: number;
    is_healthy: number;
    checked_at: string;
  }>(listSql, [...params, limit, offset]);

  return c.json({
    checks: (checks ?? []).map((ch) => ({
      ...ch,
      is_healthy: !!ch.is_healthy,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── GET /incidents — Incident history (paginated) ───────────────────────────

monitoring.get('/incidents', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const page = Math.max(parseInt(c.req.query('page') ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '25', 10), 1), 100);
  const offset = (page - 1) * limit;
  const status = c.req.query('status'); // open, resolved

  let countSql = `SELECT COUNT(*) as total FROM incidents WHERE tenant_id = ?`;
  let listSql = `SELECT id, domain, started_at, resolved_at, duration_seconds, status, alert_sent FROM incidents WHERE tenant_id = ?`;
  const params: unknown[] = [tenantId];

  if (status && ['open', 'resolved'].includes(status)) {
    countSql += ` AND status = ?`;
    listSql += ` AND status = ?`;
    params.push(status);
  }

  const countResult = await db.queryOne<{ total: number }>(countSql, params);
  const total = countResult?.total ?? 0;

  listSql += ` ORDER BY started_at DESC LIMIT ? OFFSET ?`;
  const incidents = await db.query<{
    id: string;
    domain: string;
    started_at: string;
    resolved_at: string | null;
    duration_seconds: number | null;
    status: string;
    alert_sent: number;
  }>(listSql, [...params, limit, offset]);

  return c.json({
    incidents: (incidents ?? []).map((inc) => ({
      ...inc,
      alert_sent: !!inc.alert_sent,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── POST /check — Manual health check ──────────────────────────────────────

monitoring.post('/check', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();
  const parsed = checkSchema.safeParse(body);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new ValidationError('Invalid check request', fields);
  }

  const { domain } = parsed.data;
  const db = new D1Client(c.env.DB);

  // Verify domain belongs to tenant
  const domainRecord = await db.queryOne<{ domain: string }>(
    `SELECT domain FROM domains WHERE tenant_id = ? AND domain = ? AND status = 'active'`,
    [tenantId, domain],
  );

  if (!domainRecord) {
    return c.json(
      { error: { code: 'DOMAIN_NOT_FOUND', message: 'Domínio não encontrado ou inativo.' } },
      404,
    );
  }

  const result = await performHealthCheck(domain);
  const id = generateUlid();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO health_checks (id, tenant_id, domain, status_code, response_time_ms, is_healthy, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, domain, result.statusCode, result.responseTimeMs, result.isHealthy ? 1 : 0, now],
  );

  // Handle incident creation/resolution
  await handleIncident(db, tenantId, domain, result.isHealthy, now);

  return c.json({
    domain,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    isHealthy: result.isHealthy,
    checkedAt: now,
  });
});

export { monitoring };
