-- ==============================================================================
-- Migration 37: AI-First Work Experience Verification & Anonymous P2P Signatures
-- Issue #63: Anonymous P2P coworker verification & ring-signature consensus
-- ==============================================================================

-- 1. Extend work_experience table with verification & employment fields
ALTER TABLE work_experience
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full-time'
    CHECK (employment_type IN ('Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance')),
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'AI_EVIDENCE_CHECKED', 'SOURCE_VERIFIED', 'P2P_REQUIRED', 'P2P_PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
  ADD COLUMN IF NOT EXISTS verification_type TEXT
    CHECK (verification_type IN ('auto_ai', 'company_admin', 'p2p_anonymous')),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS anonymous_proof JSONB DEFAULT '{}'::jsonb;

-- Index for querying company coworkers and verification status
CREATE INDEX IF NOT EXISTS idx_work_experience_company ON work_experience(lower(trim(company)));
CREATE INDEX IF NOT EXISTS idx_work_experience_status ON work_experience(verification_status);

-- 2. Create work_verification_requests table
CREATE TABLE IF NOT EXISTS work_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES work_experience(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  verification_type TEXT NOT NULL
    CHECK (verification_type IN ('auto_ai', 'company_admin', 'p2p_anonymous')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'AI_EVIDENCE_CHECKED', 'SOURCE_VERIFIED', 'P2P_REQUIRED', 'P2P_PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
  admin_approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approvals_required INT NOT NULL DEFAULT 3,
  approvals_received INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_work_verif_req_exp ON work_verification_requests(experience_id);
CREATE INDEX IF NOT EXISTS idx_work_verif_req_user ON work_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_work_verif_req_status ON work_verification_requests(status);

-- 3. Create work_p2p_peer_invites table
-- Tracks invited peers without linking them to final anonymous signatures
CREATE TABLE IF NOT EXISTS work_p2p_peer_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES work_verification_requests(id) ON DELETE CASCADE,
  peer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(request_id, peer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_work_p2p_peer_invites_peer ON work_p2p_peer_invites(peer_user_id);
CREATE INDEX IF NOT EXISTS idx_work_p2p_peer_invites_req ON work_p2p_peer_invites(request_id);

-- 4. Create work_p2p_blind_approvals table
-- Stores blinded ring-signature components and key images to prevent replay
-- CRITICAL ANONYMITY INVARIANT: Does NOT store coworker user_id!
CREATE TABLE IF NOT EXISTS work_p2p_blind_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES work_verification_requests(id) ON DELETE CASCADE,
  key_image TEXT NOT NULL UNIQUE,
  blind_signature JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_p2p_blind_req ON work_p2p_blind_approvals(request_id);

-- 5. Enable Row Level Security and restrict direct anon/authenticated access
-- All reads and writes go through the FastAPI backend using service_role.
ALTER TABLE work_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_p2p_peer_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_p2p_blind_approvals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE work_verification_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE work_p2p_peer_invites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE work_p2p_blind_approvals FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE work_verification_requests TO service_role;
GRANT ALL ON TABLE work_p2p_peer_invites TO service_role;
GRANT ALL ON TABLE work_p2p_blind_approvals TO service_role;

DROP POLICY IF EXISTS service_role_all_work_verification_requests ON work_verification_requests;
CREATE POLICY service_role_all_work_verification_requests
  ON work_verification_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_work_p2p_peer_invites ON work_p2p_peer_invites;
CREATE POLICY service_role_all_work_p2p_peer_invites
  ON work_p2p_peer_invites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_work_p2p_blind_approvals ON work_p2p_blind_approvals;
CREATE POLICY service_role_all_work_p2p_blind_approvals
  ON work_p2p_blind_approvals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
