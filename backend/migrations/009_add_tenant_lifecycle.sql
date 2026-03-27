-- Migration: Add Tenant Lifecycle Fields
-- Task: 3.5 - Tenant Lifecycle
-- Date: 2026-03-27

-- Add status and lifecycle fields to tenants table
ALTER TABLE tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'cancelled', 'pending'));
ALTER TABLE tenants ADD COLUMN suspended_at TEXT;
ALTER TABLE tenants ADD COLUMN suspended_reason TEXT;
ALTER TABLE tenants ADD COLUMN cancelled_at TEXT;
ALTER TABLE tenants ADD COLUMN cancelled_reason TEXT;
ALTER TABLE tenants ADD COLUMN reactivated_at TEXT;
ALTER TABLE tenants ADD COLUMN updated_at TEXT;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_updated_at ON tenants(updated_at DESC);

-- Create tenant lifecycle audit log
CREATE TABLE IF NOT EXISTS tenant_lifecycle_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('created', 'activated', 'suspended', 'cancelled', 'reactivated')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  performed_by TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_tenant ON tenant_lifecycle_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_action ON tenant_lifecycle_log(action);
CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_created ON tenant_lifecycle_log(created_at DESC);
