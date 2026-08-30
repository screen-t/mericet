-- Three moderation-related additions:
-- 1. hidden_posts: a per-viewer "hide from my feed" preference (not moderation).
-- 2. posts.is_hidden: a moderator soft-removal, hidden from everyone except the
--    author (who sees a "removed by a moderator" state) and moderators/admins.
-- 3. users.suspended_at: account suspension, enforced on every authenticated
--    request (see require_auth), not just at login.

CREATE TABLE IF NOT EXISTS hidden_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_posts_user ON hidden_posts (user_id);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES users(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_posts_is_hidden ON posts (is_hidden) WHERE is_hidden = TRUE;

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_suspended ON users (suspended_at) WHERE suspended_at IS NOT NULL;

ALTER TABLE hidden_posts DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
