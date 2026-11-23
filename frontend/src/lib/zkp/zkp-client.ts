/**
 * Client-Side Orchestrator for Local ZKP Verification Engine
 *
 * Coordinates in-memory extraction, Web Worker AI scoring & Poseidon hashing,
 * and backend submission without leaking raw documents or tokens.
 */

import { extractFromDocument, extractFromUrl, extractFromApiToken, ExtractedEvidence } from "./extractor.ts";
import { evaluateSemanticRelevance, generateZKPPayload, ZKPProofPayload, SemanticScoreResult } from "./semantic-engine.ts";
import { ZKPWorkerProgress, ZKPWorkerResponse } from "@/workers/zkp.worker";

export interface VerificationProgressCallback {
  (progress: { step: string; percent: number; message: string }): void;
}

export interface VerificationExecutionResult {
  sourceType: "document" | "url" | "token";
  semanticResult: SemanticScoreResult;
  proofPayload: ZKPProofPayload;
}

/**
 * Executes full client-side ZKP proof generation pipeline
 */
export async function executeLocalZKPVerification(
  input: {
    type: "document" | "url" | "token";
    file?: File;
    url?: string;
    token?: string;
    tokenProvider?: string;
  },
  claim: {
    id: string;
    title: string;
    category?: string;
    keywords?: string[];
  },
  onProgress?: VerificationProgressCallback
): Promise<VerificationExecutionResult> {
  // Step 1: In-memory extraction
  onProgress?.({
    step: "EXTRACTING",
    percent: 15,
    message: "Extracting text into secure memory buffer...",
  });

  let evidence: ExtractedEvidence;
  let rawBuffer: ArrayBuffer | undefined;

  if (input.type === "document" && input.file) {
    evidence = await extractFromDocument(input.file);
  } else if (input.type === "url" && input.url) {
    evidence = await extractFromUrl(input.url);
  } else if (input.type === "token" && input.token) {
    evidence = extractFromApiToken(input.tokenProvider || "github", input.token);
  } else {
    throw new Error("Invalid evidence input configuration");
  }

  // Step 2-4: Execute via Web Worker if available, or fallback gracefully in test/SSR
  if (typeof Worker !== "undefined") {
    try {
      const result = await runWithWorker(claim, evidence.rawText, rawBuffer, onProgress);
      return {
        sourceType: input.type,
        semanticResult: result.semanticResult,
        proofPayload: result.proofPayload,
      };
    } catch {
      // Fallback to inline computation if Worker instantiation fails (e.g. in some sandboxed iframes)
    }
  }

  // Fallback inline computation
  onProgress?.({
    step: "SEMANTIC_EVALUATION",
    percent: 45,
    message: "Analyzing semantic relevance against claim keywords...",
  });

  const semanticResult = evaluateSemanticRelevance(
    evidence.rawText,
    claim.title,
    claim.category,
    claim.keywords
  );

  onProgress?.({
    step: "POSEIDON_COMMITMENT",
    percent: 75,
    message: "Generating salted Poseidon hash commitment...",
  });

  const encoder = new TextEncoder();
  const bytes = encoder.encode(evidence.rawText || claim.title);
  const proofPayload = generateZKPPayload(bytes, claim.id, semanticResult.score);

  // Security zeroing
  bytes.fill(0);

  onProgress?.({
    step: "COMPLETE",
    percent: 100,
    message: "Cryptographic proof successfully generated in-memory.",
  });

  return {
    sourceType: input.type,
    semanticResult,
    proofPayload,
  };
}

function runWithWorker(
  claim: { id: string; title: string; category?: string; keywords?: string[] },
  evidenceText: string,
  rawBuffer?: ArrayBuffer,
  onProgress?: VerificationProgressCallback
): Promise<{ semanticResult: SemanticScoreResult; proofPayload: ZKPProofPayload }> {
  return new Promise((resolve, reject) => {
    try {
      // Vite web worker syntax
      const worker = new Worker(
        new URL("../../workers/zkp.worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (e: MessageEvent<ZKPWorkerResponse>) => {
        const msg = e.data;
        if (msg.type === "PROGRESS") {
          onProgress?.({
            step: msg.step,
            percent: msg.percent,
            message: msg.message,
          });
        } else if (msg.type === "SUCCESS") {
          worker.terminate();
          resolve({
            semanticResult: msg.semanticResult,
            proofPayload: msg.proofPayload,
          });
        } else if (msg.type === "ERROR") {
          worker.terminate();
          reject(new Error(msg.error));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || "Worker error"));
      };

      worker.postMessage({
        type: "VERIFY_EVIDENCE",
        claimId: claim.id,
        claimTitle: claim.title,
        claimCategory: claim.category,
        claimKeywords: claim.keywords,
        evidenceText,
        rawBuffer,
      });
    } catch (e) {
      reject(e);
    }
  });
}
