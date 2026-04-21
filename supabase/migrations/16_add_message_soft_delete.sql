ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ NULL;

CREATE INDEX idx_messages_is_deleted ON messages(conversation_id, is_deleted);
