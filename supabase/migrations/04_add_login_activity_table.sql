-- Updated: 2026-01-31
-- Purpose: Add login_activity table for tracking user authentication sessions
-- This table stores login attempts, device info, and session management data

-- Create login_activity table
CREATE TABLE IF NOT EXISTS login_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device TEXT,
  browser TEXT,
  ip_address TEXT,
  status TEXT DEFAULT 'success',
  session_id TEXT,
  is_active BOOLEAN DEFAULT true,
  login_at TIMESTAMP DEFAULT NOW(),
  logout_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_activity_user_id ON login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_session_id ON login_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_login_at ON login_activity(login_at);
CREATE INDEX IF NOT EXISTS idx_login_activity_is_active ON login_activity(is_active);

-- Add RLS policies (optional - can be disabled for development)
ALTER TABLE login_activity ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend operations)
-- Note: Postgres has no "CREATE POLICY IF NOT EXISTS" syntax — drop-then-create
-- is the standard idempotent pattern for policies.
DROP POLICY IF EXISTS "Allow service role full access to login_activity" ON login_activity;
CREATE POLICY "Allow service role full access to login_activity"
ON login_activity FOR ALL
USING (auth.role() = 'service_role');

-- Allow users to read their own login activity
DROP POLICY IF EXISTS "Users can view own login activity" ON login_activity;
CREATE POLICY "Users can view own login activity"
ON login_activity FOR SELECT
USING (auth.uid() = user_id);

-- Verification queries (run manually after applying):
-- SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name='login_activity' ORDER BY ordinal_position;
-- SELECT * FROM login_activity LIMIT 5;

-- Notes:
-- This table tracks user authentication sessions for:
-- - Security monitoring (unusual login patterns)
-- - User experience (session management)
-- - Analytics (login frequency, device usage)
-- - Audit trail (compliance requirements)