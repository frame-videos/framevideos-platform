/**
 * Security Audit Logger (D1-backed)
 * Logs all security-relevant events for monitoring and forensics
 */

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_RATE_LIMITED = 'LOGIN_RATE_LIMITED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  REGISTER_SUCCESS = 'REGISTER_SUCCESS',
  REGISTER_FAILED = 'REGISTER_FAILED',
  PASSWORD_WEAK = 'PASSWORD_WEAK',
  TOKEN_INVALID = 'TOKEN_INVALID',
  IP_BLOCKED = 'IP_BLOCKED',
}

export interface SecurityEvent {
  eventType: SecurityEventType;
  ipAddress?: string;
  email?: string;
  userId?: string;
  details?: Record<string, any>;
}

/**
 * Log a security event to D1
 */
export async function logSecurityEvent(db: any, event: SecurityEvent): Promise<void> {
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
        event.email || null,
        event.userId || null,
        event.details ? JSON.stringify(event.details) : null,
        now
      )
      .run();

    // Also log to console for real-time monitoring
    console.log(`[SECURITY_AUDIT] ${event.eventType}`, {
      timestamp: now,
      ip: event.ipAddress,
      email: event.email,
      userId: event.userId,
      details: event.details,
    });
  } catch (error) {
    // Don't let audit logging failures break the flow
    console.error('[SECURITY_AUDIT_ERROR] Failed to log event:', error);
  }
}

/**
 * Clean up old audit logs (older than 90 days)
 */
export async function cleanupAuditLogs(db: any): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare('DELETE FROM security_audit_log WHERE created_at < ?')
    .bind(cutoff)
    .run();
}
