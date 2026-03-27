/**
 * Audit Logs API
 * SuperAdmin-only endpoint to view audit logs
 */

import { Hono } from 'hono';
import { queryAuditLogs, getAuditStats, AuditEventType } from '../audit';
import { requireSuperAdmin } from '../middleware/auth';

const audit = new Hono();

/**
 * GET /api/v1/audit/logs
 * Query audit logs with filters
 */
audit.get('/logs', requireSuperAdmin, async (c) => {
  try {
    const db = c.env.DB;

    // Parse query parameters
    const eventType = c.req.query('event_type') as AuditEventType | undefined;
    const userId = c.req.query('user_id');
    const tenantId = c.req.query('tenant_id');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    const logs = await queryAuditLogs(db, {
      eventType,
      userId,
      tenantId,
      startDate,
      endDate,
      limit,
      offset,
    });

    return c.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        count: logs.length,
      },
    });
  } catch (error: any) {
    console.error('[AUDIT_LOGS_ERROR]', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch audit logs',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /api/v1/audit/stats
 * Get audit log statistics
 */
audit.get('/stats', requireSuperAdmin, async (c) => {
  try {
    const db = c.env.DB;

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const stats = await getAuditStats(db, {
      startDate,
      endDate,
    });

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[AUDIT_STATS_ERROR]', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch audit stats',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /api/v1/audit/event-types
 * List all available event types
 */
audit.get('/event-types', requireSuperAdmin, async (c) => {
  return c.json({
    success: true,
    data: Object.values(AuditEventType),
  });
});

export default audit;
