-- ============================================================================
-- Frame Videos — Schema Inicial (D1/SQLite)
-- Migração 001: Tabelas core + content + billing + ads + crawler
-- ============================================================================

-- Tabela de controle de migrações
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- CORE: Tenants, Users, Sessions, Domains
-- ============================================================================

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  plan_id TEXT NOT NULL,
  owner_user_id TEXT,
  default_locale TEXT NOT NULL DEFAULT 'pt_BR',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_owner ON tenants(owner_user_id);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tenant_user' CHECK (role IN ('super_admin', 'tenant_admin', 'tenant_user', 'advertiser')),
  is_active INTEGER NOT NULL DEFAULT 1,
  email_verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_refresh ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'active', 'failed', 'removed')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  ssl_status TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_domains_tenant ON domains(tenant_id);
CREATE INDEX idx_domains_domain ON domains(domain);

-- ============================================================================
-- CONTENT: Videos, Categories, Tags, Performers, Channels, Pages
-- ============================================================================

CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'published', 'archived')),
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  video_url TEXT,
  embed_url TEXT,
  source_url TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_videos_tenant ON videos(tenant_id);
CREATE INDEX idx_videos_tenant_status ON videos(tenant_id, status);
CREATE INDEX idx_videos_tenant_slug ON videos(tenant_id, slug);
CREATE INDEX idx_videos_published ON videos(tenant_id, published_at);
CREATE INDEX idx_videos_featured ON videos(tenant_id, is_featured) WHERE is_featured = 1;

CREATE TABLE video_translations (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE(video_id, locale)
);

CREATE INDEX idx_video_translations_video ON video_translations(video_id);
CREATE INDEX idx_video_translations_locale ON video_translations(video_id, locale);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE category_translations (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, locale)
);

CREATE INDEX idx_category_translations_cat ON category_translations(category_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_tags_tenant ON tags(tenant_id);

CREATE TABLE tag_translations (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(tag_id, locale)
);

CREATE INDEX idx_tag_translations_tag ON tag_translations(tag_id);

-- Tabelas de relacionamento N:N
CREATE TABLE video_categories (
  video_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (video_id, category_id),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX idx_video_categories_video ON video_categories(video_id);
CREATE INDEX idx_video_categories_cat ON video_categories(category_id);

CREATE TABLE video_tags (
  video_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (video_id, tag_id),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_video_tags_video ON video_tags(video_id);
CREATE INDEX idx_video_tags_tag ON video_tags(tag_id);

-- Performers
CREATE TABLE performers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_performers_tenant ON performers(tenant_id);

CREATE TABLE performer_translations (
  id TEXT PRIMARY KEY,
  performer_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  bio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (performer_id) REFERENCES performers(id) ON DELETE CASCADE,
  UNIQUE(performer_id, locale)
);

CREATE INDEX idx_performer_translations_perf ON performer_translations(performer_id);

CREATE TABLE video_performers (
  video_id TEXT NOT NULL,
  performer_id TEXT NOT NULL,
  PRIMARY KEY (video_id, performer_id),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (performer_id) REFERENCES performers(id) ON DELETE CASCADE
);

CREATE INDEX idx_video_performers_video ON video_performers(video_id);
CREATE INDEX idx_video_performers_perf ON video_performers(performer_id);

-- Channels
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_channels_tenant ON channels(tenant_id);

CREATE TABLE channel_translations (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  UNIQUE(channel_id, locale)
);

CREATE INDEX idx_channel_translations_ch ON channel_translations(channel_id);

CREATE TABLE video_channels (
  video_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  PRIMARY KEY (video_id, channel_id),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX idx_video_channels_video ON video_channels(video_id);
CREATE INDEX idx_video_channels_ch ON video_channels(channel_id);

-- Pages
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_pages_tenant ON pages(tenant_id);

CREATE TABLE page_translations (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  UNIQUE(page_id, locale)
);

CREATE INDEX idx_page_translations_page ON page_translations(page_id);

-- ============================================================================
-- BILLING: Plans, Subscriptions, LLM Wallets
-- ============================================================================

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug IN ('free', 'pro', 'business', 'enterprise')),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  max_videos INTEGER NOT NULL,
  max_domains INTEGER NOT NULL,
  max_languages INTEGER NOT NULL,
  llm_credits_monthly INTEGER NOT NULL,
  features_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

CREATE TABLE llm_wallets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_credited INTEGER NOT NULL DEFAULT 0,
  total_debited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_llm_wallets_tenant ON llm_wallets(tenant_id);

CREATE TABLE llm_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund')),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('plan_allocation', 'translation', 'seo_generation', 'description_generation', 'tag_suggestion', 'content_moderation', 'manual_adjustment', 'bonus')),
  description TEXT,
  reference_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES llm_wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_llm_transactions_wallet ON llm_transactions(wallet_id);
CREATE INDEX idx_llm_transactions_tenant ON llm_transactions(tenant_id);
CREATE INDEX idx_llm_transactions_type ON llm_transactions(type);

-- ============================================================================
-- ADS: Campaigns, Creatives
-- ============================================================================

CREATE TABLE ad_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (advertiser_id) REFERENCES users(id)
);

CREATE INDEX idx_ad_campaigns_tenant ON ad_campaigns(tenant_id);
CREATE INDEX idx_ad_campaigns_advertiser ON ad_campaigns(advertiser_id);
CREATE INDEX idx_ad_campaigns_status ON ad_campaigns(status);

CREATE TABLE ad_creatives (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'active', 'paused')),
  creative_type TEXT NOT NULL,
  content_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_ad_creatives_campaign ON ad_creatives(campaign_id);
CREATE INDEX idx_ad_creatives_tenant ON ad_creatives(tenant_id);

-- ============================================================================
-- CRAWLER: Sources, Runs
-- ============================================================================

CREATE TABLE crawler_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  crawler_type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_crawler_sources_tenant ON crawler_sources(tenant_id);

CREATE TABLE crawler_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'failed', 'paused')),
  videos_found INTEGER NOT NULL DEFAULT 0,
  videos_imported INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  log_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES crawler_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_crawler_runs_source ON crawler_runs(source_id);
CREATE INDEX idx_crawler_runs_tenant ON crawler_runs(tenant_id);

-- ============================================================================
-- AUDIT & CONFIG
-- ============================================================================

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

CREATE TABLE tenant_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, config_key)
);

CREATE INDEX idx_tenant_configs_tenant ON tenant_configs(tenant_id);

-- ============================================================================
-- TRIGGERS: updated_at automático
-- ============================================================================

CREATE TRIGGER trg_tenants_updated AFTER UPDATE ON tenants
  BEGIN UPDATE tenants SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_users_updated AFTER UPDATE ON users
  BEGIN UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_domains_updated AFTER UPDATE ON domains
  BEGIN UPDATE domains SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_videos_updated AFTER UPDATE ON videos
  BEGIN UPDATE videos SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_video_translations_updated AFTER UPDATE ON video_translations
  BEGIN UPDATE video_translations SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_categories_updated AFTER UPDATE ON categories
  BEGIN UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_category_translations_updated AFTER UPDATE ON category_translations
  BEGIN UPDATE category_translations SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_performers_updated AFTER UPDATE ON performers
  BEGIN UPDATE performers SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_performer_translations_updated AFTER UPDATE ON performer_translations
  BEGIN UPDATE performer_translations SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_channels_updated AFTER UPDATE ON channels
  BEGIN UPDATE channels SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_channel_translations_updated AFTER UPDATE ON channel_translations
  BEGIN UPDATE channel_translations SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_pages_updated AFTER UPDATE ON pages
  BEGIN UPDATE pages SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_page_translations_updated AFTER UPDATE ON page_translations
  BEGIN UPDATE page_translations SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_plans_updated AFTER UPDATE ON plans
  BEGIN UPDATE plans SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_subscriptions_updated AFTER UPDATE ON subscriptions
  BEGIN UPDATE subscriptions SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_llm_wallets_updated AFTER UPDATE ON llm_wallets
  BEGIN UPDATE llm_wallets SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_ad_campaigns_updated AFTER UPDATE ON ad_campaigns
  BEGIN UPDATE ad_campaigns SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_ad_creatives_updated AFTER UPDATE ON ad_creatives
  BEGIN UPDATE ad_creatives SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_crawler_sources_updated AFTER UPDATE ON crawler_sources
  BEGIN UPDATE crawler_sources SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_tenant_configs_updated AFTER UPDATE ON tenant_configs
  BEGIN UPDATE tenant_configs SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- ============================================================================
-- SEED DATA: Planos
-- ============================================================================

INSERT INTO plans (id, slug, name, price_cents, currency, max_videos, max_domains, max_languages, llm_credits_monthly, features_json) VALUES
  ('plan_free', 'free', 'Free', 0, 'USD', 100, 1, 1, 50, '{"analytics":false,"custom_domain":false,"api_access":false,"priority_support":false}'),
  ('plan_pro', 'pro', 'Pro', 2900, 'USD', 5000, 3, 3, 500, '{"analytics":true,"custom_domain":true,"api_access":false,"priority_support":false}'),
  ('plan_business', 'business', 'Business', 9900, 'USD', 50000, 10, 10, 5000, '{"analytics":true,"custom_domain":true,"api_access":true,"priority_support":true}'),
  ('plan_enterprise', 'enterprise', 'Enterprise', 29900, 'USD', -1, -1, -1, 50000, '{"analytics":true,"custom_domain":true,"api_access":true,"priority_support":true,"dedicated_support":true,"sla":true}');

-- Registrar migração
INSERT INTO _migrations (name) VALUES ('001_initial_schema');
