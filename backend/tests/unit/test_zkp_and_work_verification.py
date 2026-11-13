import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.verification_service import VerificationService, VerificationTier
from app.deps import get_work_experience_repo, get_work_verification_repo, get_user_repo
from app.middleware.auth import require_auth


# ==================== TASK 6: LOCAL ZKP VERIFICATION UNIT TESTS ====================

def test_zkp_poseidon_commitment_silver_tier_when_semantic_score_exceeds_threshold():
    """When a valid Poseidon commitment and Groth16 proof are provided with semantic score >= 0.85,
    VerificationService awards Mid (Silver) tier."""
    evidence = {
        "poseidon_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "semantic_score": 0.88,
        "proof": {
            "protocol": "groth16",
            "curve": "bn128",
            "pi_a": ["0x1", "0x2", "1"],
            "pi_b": [["0x1", "0x0"], ["0x0", "0x1"], ["0x1", "0x1"]],
            "pi_c": ["0x3", "0x4", "1"],
        },
        "public_signals": ["0x1234", "8800", "claim-123", "8500"],
    }

    result = VerificationService.verify_cryptographic_proof(evidence, stored_poseidon_hash=None)
    assert result.verified is True
    assert result.tier == VerificationTier.mid
    assert "exceeds 85% threshold" in result.message
    assert result.details["semantic_score"] == 0.88


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
    app.dependency_overrides[get_work_experience_repo] = lambda: mock_work
    app.dependency_overrides[get_work_verification_repo] = lambda: mock_verif
    app.dependency_overrides[get_user_repo] = lambda: mock_user

    yield mock_work, mock_verif, mock_user

    app.dependency_overrides.clear()


def test_search_coworkers_enforces_company_match(mock_work_repos, auth_user):
    """GET /profile/work-experience/coworkers/search returns matching company coworkers."""
    mock_work, mock_verif, _ = mock_work_repos
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


def test_p2p_verification_requires_exactly_three_peers(mock_work_repos, auth_user):
    """POST /profile/work-experience/{id}/verify/p2p rejects requests with fewer or more than 3 peers."""
    mock_work, mock_verif, _ = mock_work_repos
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
    """When the 3rd coworker submits their blinded approval, status advances to VERIFIED."""
    mock_work, mock_verif, _ = mock_work_repos

    # Current state: 2 approvals already received, approvals_required = 3
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

    client = TestClient(app)
    res = client.post(
        "/profile/work-experience/p2p/respond",
        json={
            "request_id": "req-999",
            "key_image": "key_image_peer_003",
            "signature": {"c_0": "0xabc", "s": ["0x1", "0x2", "0x3"]},
        },
    )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VERIFIED"
    assert data["approvals_received"] == 3
    assert data["is_verified"] is True

    # Assert work experience was updated to VERIFIED
    mock_work.update.assert_called_once()
    call_args = mock_work.update.call_args[0]
    assert call_args[0] == "exp-123"
    assert call_args[1]["verification_status"] == "VERIFIED"
    assert call_args[1]["anonymous_proof"]["protocol"] == "RingSignature-3of3"
    # Ensure individual coworker user ID is NOT stored in anonymous_proof (Anonymity invariant)
    assert "peer_id" not in call_args[1]["anonymous_proof"]
    assert auth_user not in str(call_args[1]["anonymous_proof"])
