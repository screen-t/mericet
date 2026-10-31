-- Migration 36: Living Graph Automation Worker, Lease Locking, and Audit History
-- 
-- 1. worker_locks: distributed lease/locking to prevent overlapping worker jobs
-- 2. living_graph_sync_runs: audit log of worker execution, duration, counts, errors
-- 3. Partial unique index for atomic achievement deduplication on vault_items
-- 4. Query performance indexes and RLS configuration

-- 1. Create worker_locks table (for concurrency lease control without Redis)
CREATE TABLE IF NOT EXISTS worker_locks (
    lock_key TEXT PRIMARY KEY,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    acquired_by TEXT NOT NULL
);

-- 2. Create living_graph_sync_runs table (for audit trail and observability)
CREATE TABLE IF NOT EXISTS living_graph_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    duration_ms INT,
    total_tools_checked INT DEFAULT 0,
    synced_tools INT DEFAULT 0,
    highlights_created INT DEFAULT 0,
    highlights_updated INT DEFAULT 0,
    highlights_filtered INT DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    diagnostics JSONB DEFAULT '{}'::jsonb
);

-- 3. Partial unique index on vault_items for atomic deduplication of external milestones
-- Ensures that the same external milestone event (e.g. github:repo:123 or credly:badge:abc)
-- cannot be duplicated for the same user at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_items_user_external_id
ON vault_items (user_id, (metadata->>'external_id'))
WHERE (metadata->>'external_id') IS NOT NULL;

-- 4. Query performance indexes
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON living_graph_sync_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON living_graph_sync_runs (status);
CREATE INDEX IF NOT EXISTS idx_worker_locks_expires_at ON worker_locks (expires_at);

-- 5. Service-role access configuration (consistent with migration 30 and 35)
ALTER TABLE worker_locks DISABLE ROW LEVEL SECURITY;
ALTER TABLE living_graph_sync_runs DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
