-- Crawler tables — Sprint 10
-- Sources: crawler configuration per tenant
-- Runs: execution history and results

-- Crawler sources
CREATE TABLE IF NOT EXISTS crawler_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  selectors TEXT NOT NULL DEFAULT '{}',
  schedule TEXT NOT NULL DEFAULT 'manual',
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Crawler runs
CREATE TABLE IF NOT EXISTS crawler_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES crawler_sources(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'pending',
  videos_found INTEGER NOT NULL DEFAULT 0,
  videos_new INTEGER NOT NULL DEFAULT 0,
  videos_duplicate INTEGER NOT NULL DEFAULT 0,
  errors TEXT DEFAULT '[]',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crawler_sources_tenant ON crawler_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crawler_runs_source ON crawler_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_crawler_runs_tenant ON crawler_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crawler_runs_started ON crawler_runs(started_at);
