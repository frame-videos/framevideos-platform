-- Migration 004: Add Themes Table
-- Editor de Temas (Task 4.4)

CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Colors
  primary_color TEXT NOT NULL DEFAULT '#ff6b00',
  secondary_color TEXT NOT NULL DEFAULT '#1a1a1a',
  background_color TEXT NOT NULL DEFAULT '#ffffff',
  text_color TEXT NOT NULL DEFAULT '#000000',
  accent_color TEXT NOT NULL DEFAULT '#ff8c00',
  
  -- Branding
  logo_url TEXT,
  favicon_url TEXT,
  
  -- Typography
  font_family TEXT NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
  font_size_base TEXT NOT NULL DEFAULT '16px',
  
  -- Layout
  layout_style TEXT NOT NULL DEFAULT 'grid' CHECK(layout_style IN ('grid', 'list', 'masonry')),
  grid_columns INTEGER NOT NULL DEFAULT 4,
  card_border_radius TEXT NOT NULL DEFAULT '8px',
  
  -- Custom CSS (opcional)
  custom_css TEXT,
  
  -- Status & Versioning
  is_active INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  parent_version_id TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_version_id) REFERENCES themes(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_themes_tenant ON themes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_themes_active ON themes(is_active);
CREATE INDEX IF NOT EXISTS idx_themes_version ON themes(version);

-- Apenas um tema ativo por tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_themes_tenant_active ON themes(tenant_id, is_active) WHERE is_active = 1;
