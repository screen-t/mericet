-- Allow messages from anyone (default FALSE = connections only)
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_messages_from_anyone BOOLEAN DEFAULT FALSE;
