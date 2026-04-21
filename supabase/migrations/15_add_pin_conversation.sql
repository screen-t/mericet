ALTER TABLE conversation_participants ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_conv_participants_pinned ON conversation_participants(user_id, is_pinned);
