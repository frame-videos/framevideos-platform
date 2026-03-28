-- ============================================================================
-- Frame Videos — Migration 004: Analytics tables
-- page_views + daily_stats (previously created via curl in Sprint 9)
-- ============================================================================

-- Page views — raw tracking data
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  device_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_page_views_tenant_created ON page_views(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_path ON page_views(tenant_id, path);

-- Daily aggregated stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  pageviews INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  top_pages_json TEXT,
  top_referrers_json TEXT,
  devices_json TEXT,
  countries_json TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_tenant_date ON daily_stats(tenant_id, date);

-- Registrar migração
INSERT INTO _migrations (name) VALUES ('004_analytics');
