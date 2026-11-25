import hashlib
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from fastapi.testclient import TestClient

from app.main import app
from app.services.verification_service import VerificationService, VerificationTier
from app.deps import get_work_experience_repo, get_work_verification_repo, get_user_repo
from app.middleware.auth import require_auth, optional_auth


def _make_ed25519_sig(request_id: str, key_image: str) -> dict:
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    msg = f"mericet:p2p:{request_id}:{key_image}".encode("utf-8")
    sig_bytes = private_key.sign(msg)
    return {
        "algorithm": "ed25519",
        "public_key": "0x" + public_bytes.hex(),
        "sig": "0x" + sig_bytes.hex(),
    }


def _make_ring_closure_sig(request_id: str, key_image: str, ring: list[str], c_0: str, s_vals: list[str]) -> dict:
    canonical_msg = f"mericet:p2p:{request_id}:{key_image}".encode("utf-8")
    h_m = hashlib.sha256(canonical_msg).hexdigest()
    cur = c_0.strip().lower()
    for pk, s_val in zip(ring, s_vals):
        cur = hashlib.sha256(f"{h_m}:{pk}:{cur}:{s_val}".encode("utf-8")).hexdigest()
    return {
        "ring": ring,
        "c_0": c_0,
        "s": s_vals,
        "closure_hash": cur,
    }


# ==================== TASK 6: LOCAL ZKP VERIFICATION UNIT TESTS ====================

def test_zkp_client_semantic_score_cannot_award_silver_tier():
    """Client-supplied semantic_score and structural Groth16 fields must NOT award Silver (mid) tier
    without actual server-side pairing verification."""
    poseidon_hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    evidence = {
        "poseidon_hash": poseidon_hash,
        "semantic_score": 0.99,
        "proof": {
            "protocol": "groth16",
            "curve": "bn128",
            "pi_a": ["0x1", "0x2", "1"],
            "pi_b": [["0x1", "0x0"], ["0x0", "0x1"], ["0x1", "0x1"]],
            "pi_c": ["0x3", "0x4", "1"],
        },
        "public_signals": [poseidon_hash, "9900", "claim-123", "8500"],
    }

    result = VerificationService.verify_cryptographic_proof(evidence, stored_poseidon_hash=None)
    assert result.verified is True
    assert result.tier == VerificationTier.weak
    assert result.tier != VerificationTier.mid
    assert result.details["zkp_status"] == "pairing_verification_pending_vk"
    assert result.details["client_reported_semantic_score"] == 0.99


def test_zkp_poseidon_commitment_bronze_tier_when_semantic_score_below_threshold():
    """When Poseidon commitment has semantic score below 85% (< 0.85),
    VerificationService awards Weak (Bronze) tier."""
    evidence = {
        "poseidon_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "semantic_score": 0.65,
        "proof": {
            "protocol": "groth16",
            "curve": "bn128",
            "pi_a": ["0x1", "0x2", "1"],
            "pi_b": [["0x1", "0x0"], ["0x0", "0x1"], ["0x1", "0x1"]],
            "pi_c": ["0x3", "0x4", "1"],
        },
    }

    result = VerificationService.verify_cryptographic_proof(evidence, stored_poseidon_hash=None)
    assert result.verified is True
    assert result.tier == VerificationTier.weak
    assert result.tier.value == "weak"


def test_zkp_rejects_stored_hash_and_public_signal_mismatch():
    """Mismatched stored_poseidon_hash or public_signals[0] fails closed."""
    poseidon_hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    stored_other = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"

    res_stored_mismatch = VerificationService.verify_cryptographic_proof(
        {"poseidon_hash": poseidon_hash},
        stored_poseidon_hash=stored_other,
    )
    assert res_stored_mismatch.verified is False
    assert res_stored_mismatch.tier == VerificationTier.none

    res_signal_mismatch = VerificationService.verify_cryptographic_proof(
        {
            "poseidon_hash": poseidon_hash,
            "proof": {"protocol": "groth16", "curve": "bn128"},
            "public_signals": ["0xdeadbeef", "9000"],
        },
        stored_poseidon_hash=None,
    )
    assert res_signal_mismatch.verified is False
    assert res_signal_mismatch.tier == VerificationTier.none


def test_zkp_rejects_malformed_poseidon_hash():
    """Malformed non-prime-field string is rejected (fails closed)."""
    evidence = {
        "poseidon_hash": "invalid-symbols!@#$%",
    }
    result = VerificationService.verify_cryptographic_proof(evidence, stored_poseidon_hash=None)
    assert result.verified is False
    assert result.tier == VerificationTier.none


# ==================== TASK 8: WORK EXPERIENCE & P2P UNIT TESTS ====================

@pytest.fixture
def auth_user():
    return "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def mock_work_repos(auth_user):
    mock_work = MagicMock()
    mock_verif = MagicMock()
    mock_user = MagicMock()

    app.dependency_overrides[require_auth] = lambda: auth_user
    app.dependency_overrides[optional_auth] = lambda: auth_user
    app.dependency_overrides[get_work_experience_repo] = lambda: mock_work
    app.dependency_overrides[get_work_verification_repo] = lambda: mock_verif
    app.dependency_overrides[get_user_repo] = lambda: mock_user

    yield mock_work, mock_verif, mock_user

    app.dependency_overrides.clear()


def test_search_coworkers_enforces_company_match(mock_work_repos, auth_user):
    """GET /profile/work-experience/coworkers/search returns matching company coworkers."""
    _, mock_verif, _ = mock_work_repos
    mock_verif.search_coworkers.return_value = [
        {"id": "user-2", "username": "bob", "first_name": "Bob", "last_name": "Builder", "company": "Acme Corp", "title": "Staff Engineer"},
        {"id": "user-3", "username": "carol", "first_name": "Carol", "last_name": "Danvers", "company": "Acme Corp", "title": "VP Tech"},
    ]

    client = TestClient(app)
    res = client.get("/profile/work-experience/coworkers/search?company=Acme%20Corp")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["company"] == "Acme Corp"
    assert data[0]["username"] == "bob"
    mock_verif.search_coworkers.assert_called_once_with(company="Acme Corp", exclude_user_id=auth_user)


def test_p2p_verification_requires_exactly_three_peers(mock_work_repos):
    """POST /profile/work-experience/{id}/verify/p2p rejects requests with fewer or more than 3 peers."""
    client = TestClient(app)

    # 2 peers instead of 3 -> 422 Unprocessable Entity
    res = client.post(
        "/profile/work-experience/exp-123/verify/p2p",
        json={"peer_ids": ["peer-1", "peer-2"]},
    )
    assert res.status_code == 422


def test_p2p_verification_rejects_self_as_peer(mock_work_repos, auth_user):
    """Caller cannot include themselves as an anonymous verification peer."""
    mock_work, mock_verif, _ = mock_work_repos
    mock_work.get_owner.return_value = auth_user
    mock_verif.get_by_id.return_value = {"id": "exp-123", "company": "Acme Corp"}

    client = TestClient(app)
    res = client.post(
        "/profile/work-experience/exp-123/verify/p2p",
        json={"peer_ids": [auth_user, "peer-2", "peer-3"]},
    )
    assert res.status_code == 400
    assert "yourself" in res.json()["detail"].lower()


def test_p2p_three_approvals_finalize_to_verified(mock_work_repos, auth_user):
    """When the 3rd coworker submits a valid cryptographic signature, status advances to VERIFIED."""
    mock_work, mock_verif, _ = mock_work_repos

    mock_verif.get_verification_request.return_value = {
        "id": "req-999",
        "experience_id": "exp-123",
        "status": "P2P_PENDING",
        "approvals_required": 3,
        "approvals_received": 2,
    }
    mock_verif.get_peer_invite.return_value = {
        "id": "invite-3",
        "status": "PENDING",
    }
    mock_verif.get_blind_approvals.return_value = [
        {"key_image": "img-1"},
        {"key_image": "img-2"},
    ]

    valid_sig = _make_ed25519_sig("req-999", "key_image_peer_003")

    client = TestClient(app)
    res = client.post(
        "/profile/work-experience/p2p/respond",
        json={
            "request_id": "req-999",
            "key_image": "key_image_peer_003",
            "signature": valid_sig,
        },
    )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VERIFIED"
    assert data["approvals_received"] == 3
    assert data["is_verified"] is True

    mock_work.update.assert_called_once()
    call_args = mock_work.update.call_args[0]
    assert call_args[0] == "exp-123"
    assert call_args[1]["verification_status"] == "VERIFIED"
    assert call_args[1]["anonymous_proof"]["protocol"] == "RingSignature-3of3"
    assert "peer_id" not in call_args[1]["anonymous_proof"]
    assert auth_user not in str(call_args[1]["anonymous_proof"])


def test_p2p_rejects_empty_and_invalid_signatures(mock_work_repos):
    """Empty, tampered, or mismatched cryptographic signatures are rejected with HTTP 400."""
    mock_work, mock_verif, _ = mock_work_repos
    mock_verif.get_verification_request.return_value = {
        "id": "req-999",
        "experience_id": "exp-123",
        "status": "P2P_PENDING",
        "approvals_required": 3,
        "approvals_received": 0,
    }
    mock_verif.get_peer_invite.return_value = {"id": "invite-1", "status": "PENDING"}
    mock_verif.get_blind_approvals.return_value = []

    client = TestClient(app)

    # 1. Empty signature dict
    res_empty = client.post(
        "/profile/work-experience/p2p/respond",
        json={"request_id": "req-999", "key_image": "key_image_001", "signature": {}},
    )
    assert res_empty.status_code == 400
    assert "signature" in res_empty.json()["detail"].lower()

    # 2. Forged Ed25519 signature (signed for wrong request_id)
    wrong_req_sig = _make_ed25519_sig("req-OTHER", "key_image_001")
    res_forged = client.post(
        "/profile/work-experience/p2p/respond",
        json={"request_id": "req-999", "key_image": "key_image_001", "signature": wrong_req_sig},
    )
    assert res_forged.status_code == 400

    # 3. Ring signature with tampered closure_hash
    bad_ring_sig = _make_ring_closure_sig(
        "req-999", "key_image_001", ["pk1", "pk2", "pk3"], "0x01", ["s1", "s2", "s3"]
    )
    bad_ring_sig["closure_hash"] = "0x" + "0" * 64
    res_bad_ring = client.post(
        "/profile/work-experience/p2p/respond",
        json={"request_id": "req-999", "key_image": "key_image_001", "signature": bad_ring_sig},
    )
    assert res_bad_ring.status_code == 400

    # 4. Valid ring closure succeeds
    good_ring_sig = _make_ring_closure_sig(
        "req-999", "key_image_001", ["pk1", "pk2", "pk3"], "0x01", ["s1", "s2", "s3"]
    )
    res_good_ring = client.post(
        "/profile/work-experience/p2p/respond",
        json={"request_id": "req-999", "key_image": "key_image_001", "signature": good_ring_sig},
    )
    assert res_good_ring.status_code == 200
    assert res_good_ring.json()["approvals_received"] == 1
    mock_work.update.assert_not_called()


# ==================== SECURITY REGRESSION TESTS: TAMPERING, PRIVACY, MIGRATION ====================

@pytest.mark.parametrize(
    "payload",
    [
        {"company": "Spoofed Google"},
        {"title": "Principal Architect"},
        {"start_date": "2020-01-01"},
        {"end_date": "2024-06-01"},
        {"is_current": True},
    ],
)
def test_work_experience_edit_invalidates_verified_status(mock_work_repos, auth_user, payload):
    """Changing company, title, start_date, or end_date on a VERIFIED work experience
    must reset verification_status to PENDING and clear verification_type, verified_at, and anonymous_proof."""
    mock_work, _, _ = mock_work_repos
    mock_work.get_owner.return_value = auth_user
    mock_work.get_by_id.return_value = {
        "id": "exp-123",
        "user_id": auth_user,
        "company": "Small Startup",
        "title": "Junior Engineer",
        "start_date": "2022-01-01",
        "end_date": "2023-01-01",
        "is_current": False,
        "verification_status": "VERIFIED",
        "verification_type": "p2p_anonymous",
        "verified_at": "2026-01-01T00:00:00Z",
        "anonymous_proof": {"protocol": "RingSignature-3of3"},
    }
    mock_work.update.side_effect = lambda exp_id, data: {"id": exp_id, **data}

    client = TestClient(app)
    res = client.put("/profile/work-experience/exp-123", json=payload)
    assert res.status_code == 200

    update_sent = mock_work.update.call_args[0][1]
    assert update_sent["verification_status"] == "PENDING"
    assert update_sent["verification_type"] is None
    assert update_sent["verified_at"] is None
    assert update_sent["anonymous_proof"] is None
    assert update_sent["verification_metadata"]["reverification_required"] is True


def test_work_experience_non_core_edit_preserves_verified_status(mock_work_repos, auth_user):
    """Updating description or location only does not invalidate VERIFIED status."""
    mock_work, _, _ = mock_work_repos
    mock_work.get_owner.return_value = auth_user
    mock_work.get_by_id.return_value = {
        "id": "exp-123",
        "user_id": auth_user,
        "company": "Acme Corp",
        "title": "Backend Engineer",
        "start_date": "2022-01-01",
        "end_date": "2023-01-01",
        "verification_status": "VERIFIED",
        "verification_type": "p2p_anonymous",
        "verified_at": "2026-01-01T00:00:00Z",
        "anonymous_proof": {"protocol": "RingSignature-3of3"},
    }
    mock_work.update.side_effect = lambda exp_id, data: {"id": exp_id, **data}

    client = TestClient(app)
    res = client.put(
        "/profile/work-experience/exp-123",
        json={"description": "Updated project bullet points", "location": "Remote"},
    )
    assert res.status_code == 200
    update_sent = mock_work.update.call_args[0][1]
    assert "verification_status" not in update_sent
    assert "anonymous_proof" not in update_sent


def test_verification_status_requires_authentication():
    """GET /profile/work-experience/{id}/verification-status rejects unauthenticated requests with 401."""
    app.dependency_overrides.clear()
    client = TestClient(app)
    res = client.get("/profile/work-experience/exp-123/verification-status")
    assert res.status_code == 401


def test_verification_status_enforces_work_history_visible(mock_work_repos, auth_user):
    """Non-owners receive 403 when owner sets work_history_visible=False; metadata is redacted when public."""
    _, mock_verif, mock_user = mock_work_repos
    owner_id = "00000000-0000-0000-0000-000000000099"
    mock_verif.get_by_id.return_value = {
        "id": "exp-99",
        "user_id": owner_id,
        "verification_status": "VERIFIED",
        "verification_type": "p2p_anonymous",
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verification_metadata": {
            "verified": True,
            "document_hash": "secret-doc-hash",
            "p2p_request_id": "internal-req-id",
        },
    }
    mock_verif.get_latest_verification_request.return_value = {"approvals_required": 3, "approvals_received": 3}

    client = TestClient(app)

    # 1. Private work history -> 403
    mock_user.get_by_id.return_value = {"id": owner_id, "work_history_visible": False, "suspended_at": None}
    res_private = client.get("/profile/work-experience/exp-99/verification-status")
    assert res_private.status_code == 403

    # 2. Public work history -> 200 with internal metadata redacted for non-owner
    mock_user.get_by_id.return_value = {"id": owner_id, "work_history_visible": True, "suspended_at": None}
    res_public = client.get("/profile/work-experience/exp-99/verification-status")
    assert res_public.status_code == 200
    details = res_public.json()["details"]
    assert details["verified"] is True
    assert "document_hash" not in details
    assert "p2p_request_id" not in details


def test_get_user_work_experience_enforces_privacy_setting(mock_work_repos):
    """GET /profile/work-experience/{username} returns [] when work_history_visible is False for non-owners."""
    mock_work, _, mock_user = mock_work_repos
    target_id = "00000000-0000-0000-0000-000000000077"
    mock_user.get_by_username.return_value = {
        "id": target_id,
        "username": "alice",
        "work_history_visible": False,
        "suspended_at": None,
    }

    client = TestClient(app)
    res = client.get("/profile/work-experience/alice")
    assert res.status_code == 200
    assert res.json() == []
    mock_work.get_by_user.assert_not_called()


def test_migration_37_enables_rls_and_revokes_direct_access():
    """Migration 37 must enable RLS and revoke anon/authenticated privileges on all new P2P tables."""
    mig_path = Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "37_work_experience_verification_and_p2p.sql"
    sql = mig_path.read_text(encoding="utf-8")
    for table in ("work_verification_requests", "work_p2p_peer_invites", "work_p2p_blind_approvals"):
        assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;" in sql
        assert f"REVOKE ALL ON TABLE {table} FROM PUBLIC, anon, authenticated;" in sql
        assert f"GRANT ALL ON TABLE {table} TO service_role;" in sql
