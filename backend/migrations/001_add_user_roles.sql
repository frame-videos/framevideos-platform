-- Add role column to users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing users to admin (assuming framevideos.com users are admins)
UPDATE users SET role = 'admin' WHERE role = 'user';
