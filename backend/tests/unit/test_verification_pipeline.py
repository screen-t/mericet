import pytest
from app.services.verification_service import VerificationService
from app.models.vault import VerificationTier
from app.services.living_graph import LivingGraphEngine


# ==================== ISSUE #58: AUTOMATED 3-TIER POLICY TESTS ====================

def test_text_relevance_exceeds_85_percent_grants_silver():
    """Mid (Silver): Server-computed text relevance score > 85%."""
    # Reference claim title and keywords
    claim_title = "Distributed High-Throughput Event Streaming Architecture"
    claim_keywords = ["kafka", "concurrency", "distributed", "event-driven", "latency"]

    # Evidence document text containing all key terms (>85% match)
    doc_text = """
    This system implements a distributed high-throughput event streaming architecture using
    Apache Kafka and asynchronous concurrency workers. It achieves sub-millisecond latency
    with an event-driven design and partitioned message distribution.
    """

    res = VerificationService.evaluate_text_relevance(
        evidence={"document_text": doc_text, "claim_keywords": claim_keywords},
        item_title=claim_title,
        item_category="project",
    )
    assert res.tier == VerificationTier.mid
    assert res.verified is True
    assert res.details.get("computed_score", 0) > 0.85
    assert "exceeds 85% threshold" in res.message


def test_text_relevance_borderline_grants_bronze():
    """Weak (Bronze): Claim/URL exists, but text relevance is borderline/generic (<= 85%)."""
    claim_title = "Distributed High-Throughput Event Streaming Architecture"
    claim_keywords = ["kafka", "concurrency", "distributed", "event-driven", "latency"]

    # Evidence text mentions 3 terms (~33% match, between 20% and 85%)
    doc_text = "This repository contains distributed architecture utilities and streaming helper scripts."

    res = VerificationService.evaluate_text_relevance(
        evidence={"document_text": doc_text, "claim_keywords": claim_keywords},
        item_title=claim_title,
        item_category="project",
    )
    assert res.tier == VerificationTier.weak
    assert res.verified is True
    assert res.details.get("computed_score", 0) <= 0.85
    assert "borderline" in res.message.lower() or "<= 85%" in res.message


def test_url_only_claim_grants_bronze():
    """Weak (Bronze): URL exists, but text relevance cannot be verified."""
    res = VerificationService.evaluate_text_relevance(
        evidence={"url": "https://screen-t.github.io/my-portfolio"},
        item_title="Software Portfolio",
        item_category="project",
    )
    assert res.tier == VerificationTier.weak
    assert res.verified is True
    assert "URL registered" in res.message


def test_client_forged_ai_score_is_ignored():
    """CRITICAL SECURITY: Never trust client-supplied AI scores or trust tiers."""
    # Client sends fake high score of 0.99 but provides irrelevant text
    res = VerificationService.evaluate_text_relevance(
        evidence={
            "score": 0.99,
            "ai_score": 0.99,
            "tier": "strong",
            "document_text": "Unrelated cooking recipe for apple pie with cinnamon.",
        },
        item_title="PostgreSQL Distributed Sharding Engine",
        item_category="project",
    )
    # Must NOT grant Silver or Gold based on client claim; computed score is < 0.20
    assert res.tier == VerificationTier.none
    assert res.verified is False


def test_p2p_ring_signature_valid_grants_silver():
    """Mid (Silver): Approved via cryptographically verified P2P ring signature."""
    # Deterministic ring setup
    msg = "User claim: Lead Architect of Protocol V2"
    ring = ["0x04abc123", "0x04def456", "0x04789abc"]
    # Provide valid closure components
    c_0 = "0xinitialhash"
    s_vals = ["s0_scalar", "s1_scalar", "s2_scalar"]

    # Compute expected closure
    import hashlib
    h_m = hashlib.sha256(msg.encode("utf-8")).hexdigest()
    cur = c_0.strip().lower()
    for i in range(len(ring)):
        cur = hashlib.sha256(f"{h_m}:{ring[i]}:{cur}:{s_vals[i]}".encode("utf-8")).hexdigest()

    res = VerificationService.verify_ring_signature({
        "message": msg,
        "ring": ring,
        "signature": {"c_0": c_0, "s": s_vals, "closure_hash": cur},
        "key_image": "0xkeyimage12345",
    })
    assert res.tier == VerificationTier.mid
    assert res.verified is True
    assert "P2P Ring Signature" in res.message


def test_p2p_ring_signature_closure_mismatch_fails_closed():
    """Invalid ring closure fails closed (returns none)."""
    res = VerificationService.verify_ring_signature({
        "message": "Forged claim",
        "ring": ["0xpk1", "0xpk2"],
        "signature": {"c_0": "0xc0", "s": ["s1", "s2"], "closure_hash": "0xWRONG_CLOSURE"},
    })
    assert res.tier == VerificationTier.none
    assert res.verified is False
    assert "mismatch" in res.message


def test_p2p_ring_signature_insufficient_ring_size():
    """Ring size < 2 fails closed."""
    res = VerificationService.verify_ring_signature({
        "message": "Solo claim",
        "ring": ["0xpk1"],
        "signature": {"c_0": "0xc0", "s": ["s1"]},
    })
    assert res.tier == VerificationTier.none
    assert res.verified is False


def test_tlsnotary_session_valid_grants_gold():
    """Strong (Gold): Valid TLSNotary evidence verifies relevant API statistics."""
    evidence = {
        "server_name": "api.github.com",
        "notary_pubkey": "0x1234567890abcdef1234567890abcdef1234567890abcdef",
        "notary_signature": "0x" + "a" * 64,
        "extracted_stats": {"public_repos": 42, "total_commits": 1250},
    }
    res = VerificationService.verify_tlsnotary_proof(evidence)
    assert res.tier == VerificationTier.strong
    assert res.verified is True
    assert "TLSNotary verified API statistics" in res.message
    assert "Gold" in res.message


def test_tlsnotary_untrusted_domain_fails_closed():
    """TLSNotary proof for untrusted domain is rejected."""
    evidence = {
        "server_name": "evil-untrusted-server.com",
        "notary_pubkey": "0x1234567890abcdef1234567890abcdef1234567890abcdef",
        "notary_signature": "0x" + "a" * 64,
        "extracted_stats": {"repos": 10},
    }
    res = VerificationService.verify_tlsnotary_proof(evidence)
    assert res.tier == VerificationTier.none
    assert res.verified is False
    assert "not in the trusted verifier domain registry" in res.message


def test_vector_code_originality_high_complexity_grants_gold():
    """Strong (Gold): Supabase Vector / code originality analysis confirms complex codebase."""
    # High-entropy unique code sample (>25 lines, complex algorithms, diverse tokens)
    code_sample = """
    class DistributedMerkleTree:
        def __init__(self, depth: int, hasher_cls: Any):
            self.depth = depth
            self.hasher = hasher_cls()
            self.nodes = [b"\\x00" * 32 for _ in range(2 ** depth)]
            self.commitments = {}

        def compute_leaf(self, secret_salt: bytes, identity_hash: bytes) -> bytes:
            preimage = secret_salt + identity_hash + struct.pack(">Q", self.depth)
            return self.hasher.digest(preimage)

        def insert_witness(self, index: int, leaf_data: bytes, accumulator: List[bytes]) -> bool:
            current_index = index
            current_hash = self.compute_leaf(leaf_data[:16], leaf_data[16:])
            for sibling in accumulator:
                parent_preimage = min(current_hash, sibling) + max(current_hash, sibling)
                current_hash = self.hasher.digest(parent_preimage)
                current_index //= 2
            self.commitments[index] = current_hash
            return current_hash in self.nodes

        def verify_inclusion_proof(self, root: bytes, leaf: bytes, path: List[Tuple[bytes, bool]]) -> bool:
            acc = leaf
            for sibling, is_left in path:
                acc = self.hasher.digest(sibling + acc if is_left else acc + sibling)
            return acc == root
    """
    res = VerificationService.verify_vector_originality({"code_sample": code_sample})
    assert res.tier == VerificationTier.strong
    assert res.verified is True
    assert "Gold" in res.message


def test_vector_code_originality_short_or_boilerplate_grants_bronze():
    """Code sample too short or boilerplate grants Bronze, not Gold."""
    short_code = """
    def add(a, b):
        return a + b
    """
    res = VerificationService.verify_vector_originality({"code_sample": short_code})
    assert res.tier == VerificationTier.weak
    assert res.verified is True


def test_issuer_credential_credly_valid():
    """Credly badges grant Strong (Gold) tier."""
    res = VerificationService.verify_issuer_credential({
        "credential_url": "https://www.credly.com/badges/12345678-abcd-1234-abcd-1234567890ab",
        "issuer": "Credly"
    })
    assert res.tier == VerificationTier.strong
    assert res.verified is True
    assert "Credly" in res.message


def test_issuer_credential_accredited_domain():
    """Accredited .edu domains grant Strong (Gold) tier."""
    res = VerificationService.verify_issuer_credential({
        "credential_url": "https://credentials.mit.edu/verify/987654321",
    })
    assert res.tier == VerificationTier.strong
    assert res.verified is True


def test_issuer_credential_unrecognized_domain():
    """Unrecognized domain fails closed."""
    res = VerificationService.verify_issuer_credential({
        "credential_url": "https://myfakecerts.xyz/cert123",
    })
    assert res.tier == VerificationTier.none
    assert res.verified is False


def test_cryptographic_proof_local_commitment_only():
    """Poseidon commitment registers Weak (Bronze) tamper-evident commitment."""
    res = VerificationService.verify_cryptographic_proof(
        evidence={},
        stored_poseidon_hash="0xabcdef1234567890"
    )
    assert res.tier == VerificationTier.weak
    assert res.verified is True
    assert "Tamper-evident commitment" in res.message


def test_unsupported_verification_path_fails_safely():
    """Unsupported proof type fails closed."""
    res = VerificationService.evaluate("unsupported_protocol", {})
    assert res.tier == VerificationTier.none
    assert res.verified is False


def test_living_graph_sanitize_logs():
    """Sensitive keys (tokens, secrets, passwords) are scrubbed from logs."""
    data = {"secret_token": "SUPER_SECRET_VALUE", "user": "alice", "api_key": "KEY123"}
    sanitized = LivingGraphEngine._sanitize_for_logging(data)
    assert "SUPER_SECRET_VALUE" not in sanitized
    assert "KEY123" not in sanitized
    assert "alice" in sanitized
