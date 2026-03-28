-- Migration 011: Platform-wide configuration (key-value)
-- Used for: crawler proxy, future platform settings

CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed: crawler proxy settings
INSERT OR IGNORE INTO platform_config (key, value, description) VALUES
  ('crawler_proxy_url', '', 'URL do proxy para crawler. Use {url} como placeholder. Ex: https://api.scraperapi.com?api_key=KEY&url={url}'),
  ('crawler_proxy_enabled', 'false', 'Ativar/desativar proxy no crawler');
