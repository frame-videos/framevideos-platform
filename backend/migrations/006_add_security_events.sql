-- Migration: Add security_events table for audit logging
-- Date: 2026-03-27

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_type TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resource ON security_events(resource_type, resource_id);
