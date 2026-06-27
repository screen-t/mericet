-- Muted users: suppress notifications from specific users
CREATE TABLE IF NOT EXISTS muted_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    muted_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, muted_user_id)
);

CREATE INDEX IF NOT EXISTS idx_muted_users_user ON muted_users(user_id);

-- Notification preferences column on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preview BOOLEAN DEFAULT TRUE;
