/**
 * Web Worker for Local ZKP Verification Engine
 *
 * Runs off the main thread to prevent UI freezing during document processing,
 * arithmetic hashing, and proof synthesis.
 */

import { computePoseidonHash } from "@/lib/zkp/poseidon";
import { evaluateSemanticRelevance, generateZKPPayload, ZKPProofPayload, SemanticScoreResult } from "@/lib/zkp/semantic-engine";

export interface ZKPWorkerRequest {
  type: "VERIFY_EVIDENCE";
  claimId: string;
  claimTitle: string;
  claimCategory?: string;
  claimKeywords?: string[];
  evidenceText: string;
  rawBuffer?: ArrayBuffer;
}

export interface ZKPWorkerProgress {
  type: "PROGRESS";
  step: "EXTRACTING" | "SEMANTIC_EVALUATION" | "POSEIDON_COMMITMENT" | "SYNTHESIZING_PROOF" | "COMPLETE";
  percent: number;
  message: string;
}

export interface ZKPWorkerSuccess {
  type: "SUCCESS";
  claimId: string;
  semanticResult: SemanticScoreResult;
  proofPayload: ZKPProofPayload;
}

export interface ZKPWorkerError {
  type: "ERROR";
  error: string;
}

export type ZKPWorkerResponse = ZKPWorkerProgress | ZKPWorkerSuccess | ZKPWorkerError;

self.onmessage = async (e: MessageEvent<ZKPWorkerRequest>) => {
  const data = e.data;
  if (!data || data.type !== "VERIFY_EVIDENCE") {
    return;
  }

  const { claimId, claimTitle, claimCategory, claimKeywords, evidenceText, rawBuffer } = data;

  try {
    // Step 1: Progress - Extracting
    self.postMessage({
      type: "PROGRESS",
      step: "EXTRACTING",
      percent: 20,
      message: "Parsing in-memory evidence text and structures...",
    } as ZKPWorkerProgress);

    // Prepare bytes for Poseidon sponge hashing
    let bytes: Uint8Array;
    if (rawBuffer && rawBuffer.byteLength > 0) {
      bytes = new Uint8Array(rawBuffer);
    } else {
      const encoder = new TextEncoder();
      bytes = encoder.encode(evidenceText || claimTitle);
    }

    // Step 2: Progress - Semantic Evaluation
    self.postMessage({
      type: "PROGRESS",
      step: "SEMANTIC_EVALUATION",
      percent: 45,
      message: "Evaluating semantic relevance against claim keywords locally...",
    } as ZKPWorkerProgress);

    const semanticResult = evaluateSemanticRelevance(
      evidenceText,
      claimTitle,
      claimCategory || "",
      claimKeywords || []
    );

    // Step 3: Progress - Poseidon Commitment
    self.postMessage({
      type: "PROGRESS",
      step: "POSEIDON_COMMITMENT",
      percent: 70,
      message: "Computing salted Poseidon hash commitment over prime field BN254...",
    } as ZKPWorkerProgress);

    const { hashHex, saltHex } = computePoseidonHash(bytes);

    // Step 4: Progress - Synthesizing ZKP Payload
    self.postMessage({
      type: "PROGRESS",
      step: "SYNTHESIZING_PROOF",
      percent: 90,
      message: "Synthesizing Groth16 cryptographic proof payload...",
    } as ZKPWorkerProgress);

    const proofPayload = generateZKPPayload(bytes, claimId, semanticResult.score);

    // SECURITY: Zero out sensitive byte buffer immediately
    bytes.fill(0);

    // Step 5: Complete
    self.postMessage({
      type: "SUCCESS",
      claimId,
      semanticResult,
      proofPayload: {
        ...proofPayload,
        poseidon_hash: hashHex,
        salt_hash: saltHex,
      },
    } as ZKPWorkerSuccess);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to execute local ZKP verification";
    self.postMessage({
      type: "ERROR",
      error: errorMsg,
    } as ZKPWorkerError);
  }
};
