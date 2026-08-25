-- Add service_role bypass policies for all messaging tables.
-- conversations and conversation_participants had policies in migration 07
-- that may not have been applied; messages never had a service_role policy.

DO $$
BEGIN
  -- conversations: service_role full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversations' AND policyname='conversations_service_all') THEN
    CREATE POLICY conversations_service_all ON conversations FOR ALL USING (auth.role() = 'service_role');
  END IF;

  -- conversations: participants can select their own conversations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversations' AND policyname='conversations_participant') THEN
    CREATE POLICY conversations_participant ON conversations FOR SELECT
      USING (EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid()::uuid));
  END IF;

  -- conversation_participants: service_role full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversation_participants' AND policyname='conv_participants_service_all') THEN
    CREATE POLICY conv_participants_service_all ON conversation_participants FOR ALL USING (auth.role() = 'service_role');
  END IF;

  -- conversation_participants: users can see their own participant rows
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversation_participants' AND policyname='conv_participants_self') THEN
    CREATE POLICY conv_participants_self ON conversation_participants FOR SELECT USING (user_id = auth.uid()::uuid);
  END IF;

  -- messages: service_role full access (was missing entirely)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_service_all') THEN
    CREATE POLICY messages_service_all ON messages FOR ALL USING (auth.role() = 'service_role');
  END IF;

  -- notifications: service_role full access (backend creates notifications on behalf of users)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_service_all') THEN
    CREATE POLICY notifications_service_all ON notifications FOR ALL USING (auth.role() = 'service_role');
  END IF;
END$$;
