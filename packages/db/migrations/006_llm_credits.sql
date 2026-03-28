-- ============================================================================
-- Frame Videos — Migration 006: LLM Credits tables
-- Extends the base llm_wallets/llm_transactions from 001 with usage logging
-- NOTE: llm_wallets and llm_transactions already exist in 001_initial_schema.sql
-- This migration adds the operation_type column and the llm_usage_log table
-- ============================================================================

-- Add operation_type column to llm_transactions if not exists
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a safe approach
-- The column was added via curl previously; this ensures it exists in fresh installs
ALTER TABLE llm_transactions ADD COLUMN operation_type TEXT;

-- LLM usage log — detailed tracking of LLM API calls
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_log_tenant ON llm_usage_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_log_tenant_created ON llm_usage_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_log_operation ON llm_usage_log(operation_type);

-- Registrar migração
INSERT INTO _migrations (name) VALUES ('006_llm_credits');
