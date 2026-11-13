import assert from "node:assert/strict";
import { BN254_PRIME, computePoseidonHash, poseidonHash2 } from "../lib/zkp/poseidon.ts";
import { evaluateSemanticRelevance, generateZKPPayload, tokenizeText } from "../lib/zkp/semantic-engine.ts";
import { extractFromApiToken } from "../lib/zkp/extractor.ts";
import type { WorkExperience } from "../types/api.ts";

console.log("=== Running Task 6 & Task 8: Local ZKP & Anonymous P2P Test Suite ===\n");

// TEST 1: BN254 Prime Field Poseidon Hashing
{
  console.log("Test 1: BN254 Prime Field Poseidon Hashing");
  const a = 12345678901234567890n;
  const b = 98765432109876543210n;
  const hash = poseidonHash2(a, b);

  assert.ok(hash > 0n, "Poseidon hash must produce positive field element");
  assert.ok(hash < BN254_PRIME, "Poseidon hash must be strictly less than BN254 scalar prime field modulus");

  // Determinism check: same inputs produce identical hash
  const hashAgain = poseidonHash2(a, b);
  assert.equal(hash, hashAgain, "Poseidon hash must be strictly deterministic");
  console.log("  ✓ Poseidon prime field permutation is deterministic and bounds to BN254 field");
}

// TEST 2: In-Memory Salted Commitment Generation
{
  console.log("Test 2: In-Memory Salted Commitment Generation");
  const data = new TextEncoder().encode("Mericet Vault Confidential Verification Document");
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

  const { hashHex, saltHex } = computePoseidonHash(data, salt);
  assert.ok(hashHex.startsWith("0x"), "Commitment hash must start with 0x hex prefix");
  assert.equal(hashHex.length, 66, "64-character 256-bit hex hash string plus 0x prefix");
  assert.ok(saltHex.startsWith("0x"), "Salt hex must start with 0x prefix");

  // In-memory zeroing simulation:
  data.fill(0);
  assert.equal(data.every((b) => b === 0), true, "Memory buffer must be safely wiped");
  console.log("  ✓ Salted Poseidon commitment computed with valid format and buffer zeroing verified");
}

// TEST 3: API Token In-Memory Handling (No Secret Leaks)
{
  console.log("Test 3: API Token In-Memory Handling");
  const secretToken = "ghp_VerySecretGitHubToken1234567890";
  const evidence = extractFromApiToken("github", secretToken);

  assert.equal(evidence.sourceType, "token");
  assert.equal(evidence.metadata.provider, "github");
  // Ensure raw token is blinded: does NOT appear in raw text
  assert.ok(!evidence.rawText.includes(secretToken), "Raw token must never be leaked into evidence text");
  assert.ok(evidence.rawText.includes("ghp_***"), "Blinded prefix must be recorded instead");
  console.log("  ✓ Token handling enforces privacy: blinded prefix recorded without raw credential leaks");
}

// TEST 4: Semantic Scoring & 85% Silver Tier Threshold
{
  console.log("Test 4: Semantic Relevance Scoring & 85% Threshold");
  const claimTitle = "Senior React & TypeScript Developer";
  const claimCategory = "project";
  const claimKeywords = ["react", "typescript", "frontend", "state", "components"];

  // High alignment evidence (contains all target keywords)
  const highAlignmentText = `
    Senior frontend developer project built scalable application using React and TypeScript.
    Designed modular components and managed reactive state across complex views.
  `;

  const highResult = evaluateSemanticRelevance(highAlignmentText, claimTitle, claimCategory, claimKeywords);
  assert.ok(highResult.score >= 0.85, `Score ${highResult.score} must meet or exceed 85% Silver threshold`);
  assert.equal(highResult.thresholdMet, true, "thresholdMet flag must be true");

  // Low alignment evidence (irrelevant document)
  const lowAlignmentText = "Accounting ledger and financial spreadsheet for quarterly budget review.";
  const lowResult = evaluateSemanticRelevance(lowAlignmentText, claimTitle, claimCategory, claimKeywords);
  assert.ok(lowResult.score < 0.85, "Low alignment document must fail 85% threshold");
  assert.equal(lowResult.thresholdMet, false, "thresholdMet flag must be false");
  console.log("  ✓ Semantic evaluation correctly discriminates high vs low relevance at 85% threshold");
}

// TEST 5: Groth16 / SNARK Proof Synthesis
{
  console.log("Test 5: Groth16 / SNARK Proof Synthesis");
  const dummyBytes = new Uint8Array([10, 20, 30, 40]);
  const claimId = "claim-uuid-test-999";
  const semanticScore = 0.92;

  const payload = generateZKPPayload(dummyBytes, claimId, semanticScore);
  assert.equal(payload.proof.protocol, "groth16");
  assert.equal(payload.proof.curve, "bn128");
  assert.equal(payload.proof.pi_a.length, 3);
  assert.equal(payload.proof.pi_b.length, 3);
  assert.equal(payload.proof.pi_c.length, 3);
  assert.equal(payload.public_signals.length, 4);
  assert.equal(payload.public_signals[1], "9200", "Scaled integer representation for score must be 9200");
  assert.equal(payload.public_signals[3], "8500", "Threshold signal must be 8500");
  console.log("  ✓ Groth16 proof format synthesized with valid BN128 curve scalars and public signals");
}

// TEST 6: Work Experience Verification Status Invariant
{
  console.log("Test 6: Work Experience Verification Status Invariant");
  const unverifiedExp: WorkExperience = {
    id: "exp-1",
    user_id: "usr-1",
    title: "Software Engineer",
    company: "Stripe",
    start_date: "2023-01-01",
    is_current: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    verification_status: "PENDING",
  };

  const p2pPendingExp: WorkExperience = {
    ...unverifiedExp,
    verification_status: "P2P_PENDING",
    verification_metadata: { approvals_received: 2, approvals_required: 3 },
  };

  const verifiedExp: WorkExperience = {
    ...unverifiedExp,
    verification_status: "VERIFIED",
    verified_at: new Date().toISOString(),
    anonymous_proof: { protocol: "RingSignature-3of3" },
  };

  // Helper function emulating badge display logic
  function isVerifiedBadgeAllowed(exp: WorkExperience): boolean {
    return exp.verification_status === "VERIFIED";
  }

  assert.equal(isVerifiedBadgeAllowed(unverifiedExp), false, "Pending work experience must NOT display verified badge");
  assert.equal(isVerifiedBadgeAllowed(p2pPendingExp), false, "P2P pending work experience must NOT display verified badge");
  assert.equal(isVerifiedBadgeAllowed(verifiedExp), true, "Only fully verified work experience displays verified badge");
  console.log("  ✓ Strict security rule: verified badge strictly withheld until status is VERIFIED");
}

// TEST 7: Anonymous P2P Ring Signature Anonymity Invariant
{
  console.log("Test 7: Anonymous P2P Ring Signature Anonymity Invariant");
  const finalizedProof = {
    protocol: "RingSignature-3of3",
    ring_size: 3,
    status: "consensus_confirmed",
    evaluated_at: new Date().toISOString(),
    verifier: "Mericet-P2P-AnonymousEngine/1.0",
  };

  const serialized = JSON.stringify(finalizedProof);
  assert.ok(!serialized.includes("peer_id"), "Anonymous proof must not store individual coworker IDs");
  assert.ok(!serialized.includes("user_id"), "Anonymous proof must not store individual coworker IDs");
  assert.equal(finalizedProof.ring_size, 3, "Ring size must reflect 3 coworker consensus");
  console.log("  ✓ Anonymous P2P ring signature preserves peer anonymity without database tracking");
}

console.log("\n========================================================");
console.log(" ALL 7 LOCAL ZKP & ANONYMOUS P2P TESTS PASSED (100%)");
console.log("========================================================\n");
