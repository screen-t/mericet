-- Drop the old enum type constraint and use TEXT for flexibility
-- (enum can't be extended easily in Postgres without recreation)
ALTER TABLE notifications ALTER COLUMN type TYPE TEXT USING type::TEXT;
DROP TYPE IF EXISTS notification_type;

-- Add missing columns for actor, post, and link context
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS connection_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_preview TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
