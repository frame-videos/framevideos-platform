/**
 * Sistema de Audit Logging
 * Registra eventos importantes para auditoria e compliance
 */

export enum AuditEventType {
  // Auth events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  REGISTER_SUCCESS = 'register_success',
  REGISTER_FAILED = 'register_failed',
  
  // Video events
  VIDEO_UPLOAD = 'video_upload',
  VIDEO_DELETE = 'video_delete',
  VIDEO_UPDATE = 'video_update',
  
  // Tenant events
  TENANT_CREATE = 'tenant_create',
  TENANT_UPDATE = 'tenant_update',
  TENANT_DELETE = 'tenant_delete',
  TENANT_SUSPEND = 'tenant_suspend',
  TENANT_REACTIVATE = 'tenant_reactivate',
  TENANT_CANCEL = 'tenant_cancel',
  
  // User events
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
}

export interface AuditEventData {
  eventType: AuditEventType | string;
  userId?: string;
  tenantId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditQueryFilters {
  eventType?: AuditEventType | string;
  userId?: string;
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStatsFilters {
  startDate?: string;
  endDate?: string;
}

/**
 * Loga um evento de auditoria no banco de dados
 * Compatível com Cloudflare Workers (D1)
 */
export async function logAuditEvent(db: any, data: AuditEventData): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    
    await db
      .prepare(`
        INSERT INTO security_events (
          event_type, user_id, tenant_id, resource_type, resource_id,
          details, ip_address, user_agent, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.eventType,
        data.userId || null,
        data.tenantId || null,
        data.resourceType || null,
        data.resourceId || null,
        data.details ? JSON.stringify(data.details) : null,
        data.ipAddress || null,
        data.userAgent || null,
        timestamp
      )
      .run();
  } catch (error) {
    // Não queremos que falhas de auditoria quebrem a aplicação
    console.error('Erro ao logar evento de auditoria:', error);
  }
}

/**
 * Consulta logs de auditoria com filtros
 */
export async function queryAuditLogs(db: any, filters: AuditQueryFilters): Promise<any[]> {
  try {
    let query = 'SELECT * FROM security_events WHERE 1=1';
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
      query += ' AND tenant_id = ?';
      params.push(filters.tenantId);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const result = await db.prepare(query).bind(...params).all();
    return result.results || [];
  } catch (error) {
    console.error('Erro ao consultar logs de auditoria:', error);
    return [];
  }
}

/**
 * Obtém estatísticas dos logs de auditoria
 */
export async function getAuditStats(db: any, filters: AuditStatsFilters): Promise<any> {
  try {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    // Total de eventos
    const totalQuery = `SELECT COUNT(*) as total FROM security_events ${whereClause}`;
    const totalResult = await db.prepare(totalQuery).bind(...params).first();

    // Eventos por tipo
    const byTypeQuery = `
      SELECT event_type, COUNT(*) as count
      FROM security_events
      ${whereClause}
      GROUP BY event_type
      ORDER BY count DESC
    `;
    const byTypeResult = await db.prepare(byTypeQuery).bind(...params).all();

    // Eventos por usuário (top 10)
    const byUserQuery = `
      SELECT user_id, COUNT(*) as count
      FROM security_events
      ${whereClause}
      AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `;
    const byUserResult = await db.prepare(byUserQuery).bind(...params).all();

    // Eventos por tenant (top 10)
    const byTenantQuery = `
      SELECT tenant_id, COUNT(*) as count
      FROM security_events
      ${whereClause}
      AND tenant_id IS NOT NULL
      GROUP BY tenant_id
      ORDER BY count DESC
      LIMIT 10
    `;
    const byTenantResult = await db.prepare(byTenantQuery).bind(...params).all();

    return {
      total: totalResult?.total || 0,
      byType: byTypeResult.results || [],
      byUser: byUserResult.results || [],
      byTenant: byTenantResult.results || [],
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas de auditoria:', error);
    return {
      total: 0,
      byType: [],
      byUser: [],
      byTenant: [],
    };
  }
}
