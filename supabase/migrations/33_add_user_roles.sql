-- Scalable moderator access: a role column on users, replacing the need to
-- redeploy with a new env var every time someone should gain/lose access.
-- Existing rows automatically backfill to 'user' via the column default.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check
            CHECK (role IN ('user', 'moderator', 'admin'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE role != 'user';
