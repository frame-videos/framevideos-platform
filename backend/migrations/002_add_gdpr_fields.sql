-- GDPR Compliance Migration
-- Add fields for GDPR compliance: soft delete, privacy policy and terms acceptance

-- Add deleted_at for soft delete (right to be forgotten)
ALTER TABLE users ADD COLUMN deleted_at TEXT;

-- Add privacy policy acceptance timestamp
ALTER TABLE users ADD COLUMN privacy_policy_accepted_at TEXT;

-- Add terms of service acceptance timestamp
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Create index for GDPR compliance queries
CREATE INDEX IF NOT EXISTS idx_users_gdpr_acceptance ON users(privacy_policy_accepted_at, terms_accepted_at);
