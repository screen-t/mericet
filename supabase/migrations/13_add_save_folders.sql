-- Migration: Add save_folders for organized knowledge storage
-- Users can group saved posts into named, colored folders.

-- =========================
-- SAVE FOLDERS
-- =========================
CREATE TABLE save_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    folder_name TEXT NOT NULL CHECK (char_length(folder_name) <= 100),
    description TEXT CHECK (char_length(description) <= 300),
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- LINK saved_posts → folders
-- =========================
ALTER TABLE saved_posts
    ADD COLUMN folder_id UUID REFERENCES save_folders(id) ON DELETE SET NULL;

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_save_folders_user       ON save_folders(user_id);
CREATE INDEX idx_saved_posts_folder      ON saved_posts(folder_id);
CREATE INDEX idx_saved_posts_user_folder ON saved_posts(user_id, folder_id);

-- =========================
-- ROW LEVEL SECURITY
-- =========================
ALTER TABLE save_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders"
    ON save_folders FOR SELECT
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own folders"
    ON save_folders FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own folders"
    ON save_folders FOR UPDATE
    USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own folders"
    ON save_folders FOR DELETE
    USING (auth.uid()::text = user_id::text);
