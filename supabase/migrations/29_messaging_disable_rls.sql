-- The backend uses the service_role key exclusively for all DB operations
-- and enforces access control at the application layer.
-- Disabling RLS on messaging tables removes the dependency on JWT role
-- mapping working correctly in the PostgREST layer.

ALTER TABLE conversations              DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants  DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages                   DISABLE ROW LEVEL SECURITY;
