import pytest
from app.services.verification_service import VerificationService
from app.models.vault import VerificationTier
from app.services.living_graph import LivingGraphEngine


def test_issuer_credential_credly_valid():
    res = VerificationService.verify_issuer_credential({
        "credential_url": "https://www.credly.com/badges/12345678-abcd-1234-abcd-1234567890ab",
        "issuer": "Credly"
    })
    assert res.tier == VerificationTier.strong
    assert res.verified is True
    assert "Credly" in res.message


def test_issuer_credential_accredited_domain():
    res = VerificationService.verify_issuer_credential({
        "credential_url": "https://credentials.mit.edu/verify/987654321",
    })
    assert res.tier == VerificationTier.strong
    assert res.verified is True


def test_issuer_credential_unrecognized_domain():
    res = VerificationService.verify_issuer_credential({
        "credential_url": "https://myfakecerts.xyz/cert123",
    })
    assert res.tier == VerificationTier.none
    assert res.verified is False
    assert "Unrecognized" in res.message


def test_issuer_credential_missing():
    res = VerificationService.verify_issuer_credential({})
    assert res.tier == VerificationTier.none
    assert res.verified is False


def test_cryptographic_proof_commitment_with_snark_structure():
    res = VerificationService.verify_cryptographic_proof(
        evidence={
            "poseidon_hash": "0x1234567890abcdef",
            "proof": {
                "pi_a": ["0x1", "0x2"],
                "pi_b": [["0x3", "0x4"], ["0x5", "0x6"]],
                "pi_c": ["0x7", "0x8"],
                "protocol": "groth16",
                "curve": "bn128"
            }
        },
        stored_poseidon_hash="0x1234567890abcdef"
    )
    # Verification without VK pairing engine grants Weak tier commitment, not Strong
    assert res.tier == VerificationTier.weak
    assert res.verified is True
    assert res.details.get("zkp_status") == "pairing_verification_pending_vk"


def test_cryptographic_proof_local_commitment_only():
    res = VerificationService.verify_cryptographic_proof(
        evidence={},
        stored_poseidon_hash="0xabcdef1234567890"
    )
    assert res.tier == VerificationTier.weak
    assert res.verified is True
    assert "Tamper-evident commitment" in res.message


def test_cryptographic_proof_malformed_hash():
    res = VerificationService.verify_cryptographic_proof(
        evidence={"poseidon_hash": "malformed invalid hash with spaces"},
        stored_poseidon_hash=None
    )
    assert res.tier == VerificationTier.none
    assert res.verified is False


def test_proof_of_work_github_repo_and_commit():
    res = VerificationService.verify_proof_of_work({
        "repo_url": "https://github.com/screen-t/mericet",
        "commit_hash": "6e7dfe36e7dfe36e7dfe36e7dfe36e7dfe36e7df",
        "author": "screen-t",
        "live_url": "https://mericet.vercel.app"
    })
    assert res.tier == VerificationTier.mid
    assert res.verified is True
    assert "screen-t/mericet" in res.message


def test_proof_of_work_repo_only():
    res = VerificationService.verify_proof_of_work({
        "repo_url": "https://github.com/torvalds/linux"
    })
    assert res.tier == VerificationTier.weak
    assert res.verified is True


def test_proof_of_work_live_url_only():
    res = VerificationService.verify_proof_of_work({
        "live_url": "https://my-live-project.com"
    })
    assert res.tier == VerificationTier.weak
    assert res.verified is True


def test_proof_of_work_missing():
    res = VerificationService.verify_proof_of_work({})
    assert res.tier == VerificationTier.none
    assert res.verified is False


def test_connected_service_supported_and_unsupported():
    res_github = VerificationService.verify_connected_service({
        "provider": "github",
        "handle": "alice",
        "metrics": {"repos": 5}
    })
    assert res_github.tier == VerificationTier.mid
    assert res_github.verified is True

    res_unsupported = VerificationService.verify_connected_service({
        "provider": "unsupported_unknown_platform",
        "handle": "alice"
    })
    assert res_unsupported.tier == VerificationTier.none
    assert res_unsupported.verified is False


def test_living_graph_sanitize_logs():
    data = {"secret_token": "SUPER_SECRET_VALUE", "user": "alice", "api_key": "KEY123"}
    sanitized = LivingGraphEngine._sanitize_for_logging(data)
    assert "SUPER_SECRET_VALUE" not in sanitized
    assert "KEY123" not in sanitized
    assert "alice" in sanitized
