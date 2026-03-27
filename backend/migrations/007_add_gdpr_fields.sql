-- Migration: Add GDPR compliance fields
-- Date: 2026-03-27

-- Add GDPR fields to users table
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE users ADD COLUMN privacy_policy_accepted_at TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
