-- ============================================================================
-- Frame Videos — Migration 009: Ads System
-- Ad placements, impressions, clicks, daily stats, and revenue share tables
-- ============================================================================

-- Ad placements per tenant (where ads can be shown)
CREATE TABLE IF NOT EXISTS ad_placements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('header', 'sidebar', 'in_content', 'footer', 'overlay')),
  width INTEGER NOT NULL DEFAULT 728,
  height INTEGER NOT NULL DEFAULT 90,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_ad_placements_tenant ON ad_placements(tenant_id);
CREATE INDEX idx_ad_placements_tenant_active ON ad_placements(tenant_id, is_active);

-- Ad impressions (individual impression events)
CREATE TABLE IF NOT EXISTS ad_impressions (
  id TEXT PRIMARY KEY,
  creative_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  placement_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  page_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (placement_id) REFERENCES ad_placements(id) ON DELETE CASCADE
);

CREATE INDEX idx_ad_impressions_creative ON ad_impressions(creative_id);
CREATE INDEX idx_ad_impressions_tenant ON ad_impressions(tenant_id);
CREATE INDEX idx_ad_impressions_date ON ad_impressions(created_at);
CREATE INDEX idx_ad_impressions_dedup ON ad_impressions(creative_id, ip_hash, created_at);

-- Ad clicks (individual click events)
CREATE TABLE IF NOT EXISTS ad_clicks (
  id TEXT PRIMARY KEY,
  creative_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  placement_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (placement_id) REFERENCES ad_placements(id) ON DELETE CASCADE
);

CREATE INDEX idx_ad_clicks_creative ON ad_clicks(creative_id);
CREATE INDEX idx_ad_clicks_tenant ON ad_clicks(tenant_id);
CREATE INDEX idx_ad_clicks_date ON ad_clicks(created_at);

-- Ad daily stats (aggregated per creative per day)
CREATE TABLE IF NOT EXISTS ad_daily_stats (
  id TEXT PRIMARY KEY,
  creative_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_ad_daily_stats_unique ON ad_daily_stats(creative_id, tenant_id, date);
CREATE INDEX idx_ad_daily_stats_tenant_date ON ad_daily_stats(tenant_id, date);

-- Ad revenue share (monthly split between tenant and platform)
CREATE TABLE IF NOT EXISTS ad_revenue_share (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  month TEXT NOT NULL,
  total_revenue_cents INTEGER NOT NULL DEFAULT 0,
  tenant_share_cents INTEGER NOT NULL DEFAULT 0,
  platform_share_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_ad_revenue_share_unique ON ad_revenue_share(tenant_id, month);
CREATE INDEX idx_ad_revenue_share_tenant ON ad_revenue_share(tenant_id);

-- Register migration
INSERT INTO _migrations (name) VALUES ('009_ads_system');
