-- Migration 35: Add Vault and 3-Tab Profile support
-- 
-- 1. verification_tier enum: none, weak, mid, strong
-- 2. vault_category enum: skill, work, education, project, achievement, tool, other
-- 3. vault_items table: stores user portfolio/vault entries with client-side Poseidon commitment hash
--    (SECURITY: RAW VERIFICATION DOCUMENTS ARE NEVER STORED ON THE SERVER)
-- 4. connected_tools table: stores connected external services (GitHub, LeetCode, Credly) metadata & highlights
--    (SECURITY: NO ACCESS TOKENS OR PRIVATE CREDENTIALS STORED)
-- 5. Conditional pgvector investigation & setup
-- 6. Indexes, constraints, and RLS configuration

-- 1. Create Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_tier') THEN
        CREATE TYPE verification_tier AS ENUM ('none', 'weak', 'mid', 'strong');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vault_category') THEN
        CREATE TYPE vault_category AS ENUM ('skill', 'work', 'education', 'project', 'achievement', 'tool', 'other');
    END IF;
END $$;

-- 2. Create vault_items table
CREATE TABLE IF NOT EXISTS vault_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category vault_category NOT NULL DEFAULT 'project',
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Store ONLY client-generated salted Poseidon hash commitment.
    -- RAW VERIFICATION DOCUMENTS ARE NEVER STORED ON THE SERVER.
    poseidon_hash TEXT,
    verification_tier verification_tier NOT NULL DEFAULT 'none',
    verification_metadata JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_title_not_empty CHECK (char_length(trim(title)) > 0)
);

-- 3. Create connected_tools table (for Living Graph automation engine)
CREATE TABLE IF NOT EXISTS connected_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- e.g. 'github', 'leetcode', 'credly'
    handle TEXT NOT NULL,   -- public username / handle
    auth_status TEXT NOT NULL DEFAULT 'connected', -- 'connected', 'unverified', 'disconnected'
    metadata JSONB DEFAULT '{}'::jsonb, -- public summary stats, highlights, metrics
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

-- 4. Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_vault_items_user ON vault_items (user_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_user_category ON vault_items (user_id, category);
CREATE INDEX IF NOT EXISTS idx_vault_items_user_tier ON vault_items (user_id, verification_tier);
CREATE INDEX IF NOT EXISTS idx_vault_items_poseidon ON vault_items (poseidon_hash) WHERE poseidon_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_items_created_at ON vault_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connected_tools_user ON connected_tools (user_id);

-- 5. Safe pgvector investigation and optional extension configuration
DO $$
BEGIN
    -- Check if vector extension is available in pg_available_extensions
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;
        -- If pgvector is enabled, add embedding column for semantic search over public vault highlights
        ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS embedding vector(384);
    ELSE
        RAISE NOTICE 'pgvector extension not installed or not available in this PostgreSQL instance; skipping vector column setup.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Vector extension setup skipped due to environment capabilities.';
END $$;

-- 6. Disable RLS for backend service_role access consistency (per migration 30)
ALTER TABLE vault_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE connected_tools DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
