-- ============================================================================
-- Frame Videos — Migration 008: Auth Onboarding
-- Adds password reset and must_change_password columns to users table
-- ============================================================================

-- Add must_change_password flag (set to 1 when admin creates user with temp password)
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

-- Add password reset token (crypto random hex, 32 bytes)
ALTER TABLE users ADD COLUMN password_reset_token TEXT;

-- Add password reset token expiration
ALTER TABLE users ADD COLUMN password_reset_expires_at TEXT;

-- Index for fast token lookup during password reset
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- Register migration
INSERT INTO _migrations (name) VALUES ('008_auth_onboarding');
