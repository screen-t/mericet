-- Add metadata column for rich message content (shared posts, etc.)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB;
