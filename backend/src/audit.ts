/**
 * Audit Logging System
 * Logs all important events for compliance, monitoring, and forensics
 */

export enum AuditEventType {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  REGISTER_SUCCESS = 'REGISTER_SUCCESS',
  REGISTER_FAILED = 'REGISTER_FAILED',
  
  // Videos
  VIDEO_UPLOAD = 'VIDEO_UPLOAD',
  VIDEO_UPDATE = 'VIDEO_UPDATE',
  VIDEO_DELETE = 'VIDEO_DELETE',
  VIDEO_VIEW = 'VIDEO_VIEW',
  
  // Tenants
  TENANT_CREATE = 'TENANT_CREATE',
  TENANT_UPDATE = 'TENANT_UPDATE',
  TENANT_DELETE = 'TENANT_DELETE',
  
  // Admin Actions
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  USER_DELETE = 'USER_DELETE',
  USER_BAN = 'USER_BAN',
  USER_UNBAN = 'USER_UNBAN',
  
  // Security
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  IP_BLOCKED = 'IP_BLOCKED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // System
  ADMIN_ACTION = 'ADMIN_ACTION',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

export interface AuditEvent {
  eventType: AuditEventType;
  userId?: string;
  tenantId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event to D1
 */
export async function logAuditEvent(db: any, event: AuditEvent): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(`
        INSERT INTO security_audit_log (id, event_type, ip_address, email, user_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        event.eventType,
        event.ipAddress || null,
        null, // email não está no novo schema, mas mantém compatibilidade
        event.userId || null,
        JSON.stringify({
          tenantId: event.tenantId,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          userAgent: event.userAgent,
          ...event.details,
        }),
        now
      )
      .run();

    // Log to console for real-time monitoring
    console.log(`[AUDIT] ${event.eventType}`, {
      timestamp: now,
      userId: event.userId,
      tenantId: event.tenantId,
      resource: event.resourceType ? `${event.resourceType}:${event.resourceId}` : undefined,
      ip: event.ipAddress,
      details: event.details,
    });
  } catch (error) {
    // Don't let audit logging failures break the flow
    console.error('[AUDIT_ERROR] Failed to log event:', error);
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  db: any,
  filters: {
    eventType?: AuditEventType;
    userId?: string;
    tenantId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<any[]> {
  let query = 'SELECT * FROM security_audit_log WHERE 1=1';
  const params: any[] = [];

  if (filters.eventType) {
    query += ' AND event_type = ?';
    params.push(filters.eventType);
  }

  if (filters.userId) {
    query += ' AND user_id = ?';
    params.push(filters.userId);
  }

  if (filters.tenantId) {
    query += ' AND details LIKE ?';
    params.push(`%"tenantId":"${filters.tenantId}"%`);
  }

  if (filters.startDate) {
    query += ' AND created_at >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  query += ' ORDER BY created_at DESC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    query += ' OFFSET ?';
    params.push(filters.offset);
  }

  const result = await db.prepare(query).bind(...params).all();
  
  return result.results.map((row: any) => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null,
  }));
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(
  db: any,
  filters: {
    startDate?: string;
    endDate?: string;
  }
): Promise<Record<string, number>> {
  let query = 'SELECT event_type, COUNT(*) as count FROM security_audit_log WHERE 1=1';
  const params: any[] = [];

  if (filters.startDate) {
    query += ' AND created_at >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  query += ' GROUP BY event_type';

  const result = await db.prepare(query).bind(...params).all();
  
  const stats: Record<string, number> = {};
  for (const row of result.results) {
    stats[row.event_type] = row.count;
  }

  return stats;
}

/**
 * Clean up old audit logs (older than 90 days)
 */
export async function cleanupAuditLogs(db: any, daysToKeep: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
  const result = await db
    .prepare('DELETE FROM security_audit_log WHERE created_at < ?')
    .bind(cutoff)
    .run();

  console.log(`[AUDIT_CLEANUP] Deleted ${result.meta.changes} old audit logs`);
  return result.meta.changes || 0;
}
