-- Add edited_at field for message edit tracking
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;
