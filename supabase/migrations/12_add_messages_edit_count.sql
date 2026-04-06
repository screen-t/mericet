-- Add edit_count to enforce max edit attempts per message
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;
