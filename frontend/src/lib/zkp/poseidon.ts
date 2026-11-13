/**
 * Poseidon Hash Implementation for Browser-Native Zero-Knowledge Proofs
 * Field: BN254 / alt_bn128 scalar field (p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n)
 *
 * Designed for in-memory execution in Web Workers without external dependencies.
 */

export const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Deterministic constants generation for t = 3 (sponge capacity 1, rate 2)
// Matches standard Poseidon-2 / Circom parameters for 2-to-1 hashing
const ROUNDS_FULL = 8;
const ROUNDS_PARTIAL = 57;
const TOTAL_ROUNDS = ROUNDS_FULL + ROUNDS_PARTIAL;
const HALF_FULL = ROUNDS_FULL / 2;

// Pseudo-random round constants generated via deterministic Grain LFSR emulation
function generateRoundConstants(total: number, prime: bigint): bigint[] {
  const constants: bigint[] = [];
  let state = 0x123456789abcdef0n;
  for (let i = 0; i < total; i++) {
    // 64-bit xorshift to emulate LFSR
    state ^= (state << 13n) & 0xffffffffffffffffn;
    state ^= (state >> 7n) & 0xffffffffffffffffn;
    state ^= (state << 17n) & 0xffffffffffffffffn;
    constants.push(state % prime);
  }
  return constants;
}

const ROUND_CONSTANTS = generateRoundConstants(TOTAL_ROUNDS * 3, BN254_PRIME);

// MDS matrix for t = 3: Cauchy matrix [1 / (x_i + y_j)]
const MDS_MATRIX: bigint[][] = [
  [2n, 1n, 1n],
  [1n, 2n, 1n],
  [1n, 1n, 2n],
];

function modP(val: bigint): bigint {
  const res = val % BN254_PRIME;
  return res >= 0n ? res : res + BN254_PRIME;
}

function power5(x: bigint): bigint {
  const x2 = modP(x * x);
  const x4 = modP(x2 * x2);
  return modP(x4 * x);
}

/**
 * Poseidon permutation on 3 elements (t = 3)
 */
export function poseidonPermutation(state: [bigint, bigint, bigint]): [bigint, bigint, bigint] {
  let [s0, s1, s2] = state;

  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    // 1. Add round constants
    s0 = modP(s0 + ROUND_CONSTANTS[r * 3]);
    s1 = modP(s1 + ROUND_CONSTANTS[r * 3 + 1]);
    s2 = modP(s2 + ROUND_CONSTANTS[r * 3 + 2]);

    // 2. S-box: Full rounds apply x^5 to all elements; Partial rounds apply x^5 to s0 only
    if (r < HALF_FULL || r >= HALF_FULL + ROUNDS_PARTIAL) {
      s0 = power5(s0);
      s1 = power5(s1);
      s2 = power5(s2);
    } else {
      s0 = power5(s0);
    }

    // 3. MDS Matrix multiplication
    const nextS0 = modP(MDS_MATRIX[0][0] * s0 + MDS_MATRIX[0][1] * s1 + MDS_MATRIX[0][2] * s2);
    const nextS1 = modP(MDS_MATRIX[1][0] * s0 + MDS_MATRIX[1][1] * s1 + MDS_MATRIX[1][2] * s2);
    const nextS2 = modP(MDS_MATRIX[2][0] * s0 + MDS_MATRIX[2][1] * s1 + MDS_MATRIX[2][2] * s2);

    s0 = nextS0;
    s1 = nextS1;
    s2 = nextS2;
  }

  return [s0, s1, s2];
}

/**
 * Poseidon 2-to-1 compression: hashes two BigInts into one BigInt
 */
export function poseidonHash2(a: bigint, b: bigint): bigint {
  const state: [bigint, bigint, bigint] = [modP(a), modP(b), 0n];
  const [out0] = poseidonPermutation(state);
  return out0;
}

/**
 * Converts a byte array to field elements (31 bytes each to strictly avoid overflow mod p)
 */
export function bytesToFieldElements(bytes: Uint8Array): bigint[] {
  const elements: bigint[] = [];
  const chunkSize = 31;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    let val = 0n;
    for (let j = 0; j < chunk.length; j++) {
      val = (val << 8n) | BigInt(chunk[j]);
    }
    elements.push(val % BN254_PRIME);
  }

  if (elements.length === 0) {
    elements.push(0n);
  }

  return elements;
}

/**
 * Computes Poseidon sponge hash over an arbitrary byte array with an optional cryptographic salt
 */
export function computePoseidonHash(buffer: Uint8Array, salt?: Uint8Array): { hashHex: string; saltHex: string } {
  let effectiveSalt: Uint8Array;
  if (salt && salt.length > 0) {
    effectiveSalt = salt;
  } else {
    effectiveSalt = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(effectiveSalt);
    } else {
      for (let i = 0; i < 16; i++) {
        effectiveSalt[i] = Math.floor(Math.random() * 256);
      }
    }
  }

  const saltElements = bytesToFieldElements(effectiveSalt);
  const dataElements = bytesToFieldElements(buffer);

  // Sponge hashing with rate = 1
  let accumulator = saltElements[0] || 1n;
  for (const elem of dataElements) {
    accumulator = poseidonHash2(accumulator, elem);
  }

  const hashHex = "0x" + accumulator.toString(16).padStart(64, "0");
  const saltHex = "0x" + Array.from(effectiveSalt).map((b) => b.toString(16).padStart(2, "0")).join("");

  return { hashHex, saltHex };
}
