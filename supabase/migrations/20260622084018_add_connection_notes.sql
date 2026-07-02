-- =========================================
-- Connection Notes (Private)
-- =========================================
CREATE TABLE IF NOT EXISTS connection_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_connection_owner UNIQUE(connection_id, owner_id)
);
CREATE INDEX IF NOT EXISTS idx_connection_notes_owner ON connection_notes(owner_id);
ALTER TABLE connection_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connection_notes_select_own" ON connection_notes FOR
SELECT USING (owner_id = auth.uid());
CREATE POLICY "connection_notes_insert_own" ON connection_notes FOR
INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "connection_notes_update_own" ON connection_notes FOR
UPDATE USING (owner_id = auth.uid());
CREATE POLICY "connection_notes_delete_own" ON connection_notes FOR DELETE USING (owner_id = auth.uid());