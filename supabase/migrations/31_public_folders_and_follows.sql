-- Public folder sharing + folder follows

-- Add public-sharing columns to save_folders
ALTER TABLE save_folders
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

-- Backfill share_token for existing rows (DEFAULT only runs on INSERT)
UPDATE save_folders SET share_token = gen_random_uuid() WHERE share_token IS NULL;

ALTER TABLE save_folders
  ALTER COLUMN share_token SET NOT NULL,
  ADD CONSTRAINT save_folders_share_token_key UNIQUE (share_token);

-- Users who follow a public folder get notified when new posts are added
CREATE TABLE IF NOT EXISTS folder_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  folder_id UUID NOT NULL REFERENCES save_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_follows_user   ON folder_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_follows_folder ON folder_follows(folder_id);

-- All table access goes through the FastAPI backend (service_role key)
ALTER TABLE folder_follows DISABLE ROW LEVEL SECURITY;
