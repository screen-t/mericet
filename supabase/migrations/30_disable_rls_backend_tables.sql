-- All data access goes through the FastAPI backend (service_role key).
-- The frontend never calls Supabase directly for table data, only for Auth.
-- Disabling RLS removes the dependency on auth.role() = 'service_role' policies
-- working correctly in the PostgREST layer.

ALTER TABLE posts                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_media             DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes             DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_polls             DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_poll_options      DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_poll_votes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE reposts                DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts            DISABLE ROW LEVEL SECURITY;
ALTER TABLE save_folders           DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments               DISABLE ROW LEVEL SECURITY;
ALTER TABLE connections            DISABLE ROW LEVEL SECURITY;
ALTER TABLE connection_notes       DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_experience        DISABLE ROW LEVEL SECURITY;
ALTER TABLE education              DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills            DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          DISABLE ROW LEVEL SECURITY;
ALTER TABLE login_activity         DISABLE ROW LEVEL SECURITY;
ALTER TABLE follows                DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports                DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE users                  DISABLE ROW LEVEL SECURITY;
