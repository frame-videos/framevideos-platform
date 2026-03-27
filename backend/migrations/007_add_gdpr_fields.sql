-- Migration: Add GDPR compliance fields
-- Created: 2026-03-27

-- Add GDPR fields to users table
ALTER TABLE users ADD COLUMN deleted_at TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN privacy_policy_accepted_at TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT DEFAULT NULL;

-- Create index for soft delete queries
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
