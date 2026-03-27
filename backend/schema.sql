-- Frame Videos Database Schema
-- SQLite (Cloudflare D1)

-- ============================================================================
-- Tenants
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  custom_domain TEXT,
  custom_domain_status TEXT DEFAULT 'none' CHECK(custom_domain_status IN ('none', 'pending', 'active', 'failed')),
  custom_domain_cloudflare_id TEXT,
  custom_domain_ssl_status TEXT,
  custom_domain_verified_at TEXT,
  custom_domain_created_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'cancelled', 'pending')),
  suspended_at TEXT,
  suspended_reason TEXT,
  cancelled_at TEXT,
  cancelled_reason TEXT,
  reactivated_at TEXT,
  updated_at TEXT
);

-- ============================================================================
-- Users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(email, tenant_id)
);

-- ============================================================================
-- Videos
-- ============================================================================

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  duration INTEGER,
  url TEXT,
  thumbnail_url TEXT,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================================================
-- Categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(slug, tenant_id)
);

-- ============================================================================
-- Tags
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(slug, tenant_id)
);

-- ============================================================================
-- Video Categories (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_categories (
  video_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (video_id, category_id),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ============================================================================
-- Video Tags (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_tags (
  video_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (video_id, tag_id),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ============================================================================
-- Analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================================================
-- Login Attempts (Rate Limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email TEXT,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  blocked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at);

-- ============================================================================
-- Account Lockouts
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_lockouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT NOT NULL,
  last_failed_at TEXT NOT NULL,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_user ON account_lockouts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_email ON account_lockouts(email);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked ON account_lockouts(locked_until);

-- ============================================================================
-- Security Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  email TEXT,
  user_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_audit_event ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_log(ip_address);

-- ============================================================================
-- Security Events (Audit Logging)
-- ============================================================================

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

-- ============================================================================
-- Tenant Lifecycle Log
-- ============================================================================

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

-- ============================================================================
-- Indexes
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Videos
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_tenant ON videos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_updated_at ON tenants(updated_at DESC);

-- Tenant Lifecycle Log
CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_tenant ON tenant_lifecycle_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_action ON tenant_lifecycle_log(action);
CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_created ON tenant_lifecycle_log(created_at DESC);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Tags
CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_video ON analytics(video_id);
CREATE INDEX IF NOT EXISTS idx_analytics_tenant ON analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at DESC);
