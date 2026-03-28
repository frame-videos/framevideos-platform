-- ============================================================================
-- Frame Videos — Migration 005: Email, Newsletter, Monitoring tables
-- Previously created via curl in Sprint 9
-- ============================================================================

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  template_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant_type ON email_templates(tenant_id, template_type);

-- Email log
CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  template_type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  sendgrid_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_log_tenant_created ON email_log(tenant_id, created_at);

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  confirm_token TEXT,
  subscribed_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subs_tenant_email ON newsletter_subscribers(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subs_token ON newsletter_subscribers(confirm_token);

-- Newsletter campaigns (for future use)
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at TEXT,
  sent_at TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_tenant ON newsletter_campaigns(tenant_id);

-- Newsletter sends (tracking per-recipient delivery)
CREATE TABLE IF NOT EXISTS newsletter_sends (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
  sent_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_campaign ON newsletter_sends(campaign_id);

-- Monitoring: health checks
CREATE TABLE IF NOT EXISTS monitoring_checks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  is_healthy INTEGER NOT NULL DEFAULT 1,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitoring_checks_tenant_checked ON monitoring_checks(tenant_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_tenant_domain ON monitoring_checks(tenant_id, domain);

-- Monitoring: incidents
CREATE TABLE IF NOT EXISTS monitoring_incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  alert_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitoring_incidents_tenant_status ON monitoring_incidents(tenant_id, status);

-- Registrar migração
INSERT INTO _migrations (name) VALUES ('005_email_newsletter');
