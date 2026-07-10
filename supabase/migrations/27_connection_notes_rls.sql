ALTER TABLE connection_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='connection_notes' AND policyname='connection_notes_service_all') THEN
    CREATE POLICY connection_notes_service_all ON connection_notes FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='connection_notes' AND policyname='connection_notes_owner_all') THEN
    CREATE POLICY connection_notes_owner_all ON connection_notes FOR ALL USING (user_id = auth.uid()::uuid);
  END IF;
END $$;
