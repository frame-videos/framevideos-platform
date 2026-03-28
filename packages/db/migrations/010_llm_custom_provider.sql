-- Migration 010: Create llm_config table with custom provider support
-- Enables configuring LLM providers (OpenAI, Anthropic, Groq, Together, Mistral, custom)

CREATE TABLE IF NOT EXISTS llm_config (
  id TEXT PRIMARY KEY,
  markup_percent INTEGER NOT NULL DEFAULT 150,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  api_key TEXT DEFAULT '',
  base_url TEXT DEFAULT '',
  provider_name TEXT DEFAULT '',
  max_tokens INTEGER DEFAULT 2048,
  temperature REAL DEFAULT 0.7,
  is_active INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registrar migração
INSERT INTO _migrations (name) VALUES ('010_llm_custom_provider');
