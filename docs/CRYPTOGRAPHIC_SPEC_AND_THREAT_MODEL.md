# Cryptographic Specification & Anonymity Threat Model

**Parent Issue:** #55 (Resume Profile Feature)  
**Task 6 (#61):** Local Zero-Knowledge Proof (ZKP) Verification Engine  
**Task 8 (#63):** AI-First Work Experience & Anonymous P2P Ring Verification  

---

## 1. Task #61: Local ZKP Verification Engine Specification

### 1.1 Architecture & Cryptographic Primitives
1. **Poseidon Sponge Permutation over BN254:**
   - Evaluated over the BN254 scalar field ($r = 21888242871839275222246405745257275088548364400416034343698204186575808495617$).
   - Full rounds $R_F = 8$, partial rounds $R_P = 57$, $x^5$ S-box, Cauchy MDS matrix.
   - Computes deterministic, salted commitments $C = \text{Poseidon}(B \parallel S)$ for evidence byte buffers $B$ and salt $S$.
   - Explicit memory zeroing (`Uint8Array.fill(0)`) is executed immediately after commitment generation to wipe plaintext evidence buffers from browser heap.
2. **Groth16 Proof Synthesis Envelope:**
   - Formats public signals:
     - `public_signals[0]`: Poseidon document hash commitment ($C$)
     - `public_signals[1]`: Scaled semantic score integer ($10000 \times \text{score}$)
     - `public_signals[2]`: Claim ID truncated identifier
     - `public_signals[3]`: Silver threshold baseline ($8500 = 85.00\%$)
   - Formats BN128 curve scalar elements for $G_1$ ($\pi_A$), $G_2$ ($\pi_B$), and $G_1$ ($\pi_C$).

### 1.2 Cryptographic Limitations & Honest Disclosure (zkML Distinction)
> [!IMPORTANT]
> **Honest Assessment on zkML vs Attestation Binding:**  
> The current client-side engine **does NOT perform in-circuit neural network inference or natural language evaluation (zkML)**.
> 
> True in-circuit execution of language model embeddings and transformer weights in zk-SNARKs requires millions of R1CS constraints, proving keys of hundreds of megabytes, and tens of minutes of compute time that cannot run natively in a client-side Web Worker without freezing client devices.
> 
> **What the system actually guarantees:**
> - The Poseidon commitment cryptographically binds the private document bytes without leaking the document plaintext.
> - The proof envelope mathematically binds the document commitment, the claimed identity, and the semantic score.
> - **Limitation:** The semantic relevance score is computed by the client-side JavaScript engine (`evaluateSemanticRelevance`) prior to proof synthesis. A malicious user with an altered JavaScript runtime could manipulate the numerical score passed into `generateZKPPayload`. Consequently, Silver Tier verification awards trust based on cryptographic commitment and client-side proof construction, but cannot be treated as a zero-knowledge proof of honest AI execution.

---

## 2. Task #63: Anonymous P2P Verification Threat Model

### 2.1 Protocol Overview (Option B: 3-of-3 Anonymous Ring Consensus)
Users seeking work experience verification can invite 3 verified coworkers from the same company. The coworkers submit blinded approval signatures. Once all 3 peers approve, the backend aggregates the responses into a ring signature object and marks the experience as `VERIFIED`.

### 2.2 Threat Model & Privacy Invariants

| Attack Vector / Threat | Threat Description | Mitigation & Invariant | Status |
| :--- | :--- | :--- | :--- |
| **1. Database De-anonymization** | An attacker with database read access inspects `work_experience` to identify which specific coworkers approved a colleague. | **Strict Table Isolation:** `work_p2p_blind_approvals` stores only `key_image` and `blind_signature`. Neither `work_experience.anonymous_proof` nor `work_experience.verification_metadata` contains coworker user IDs. | **Mitigated** |
| **2. Double-Voting & Sybil Attacks** | An invited peer submits multiple approvals to inflate vote count or approve on behalf of others. | **Replay Protection via Key Images:** Every blinded approval requires a unique cryptographic `key_image`. The database enforces `UNIQUE(key_image)`. The route verifies `existing_approvals` and rejects duplicate key images with HTTP 400. | **Mitigated** |
| **3. Self-Approval** | A user invites themselves to approve their own work experience. | **Identity Guard:** The backend route `request_p2p_verification` strictly checks `if user_id in peer_ids: raise HTTPException(400)`. | **Mitigated** |
| **4. Unverified Coworker Collusion** | A user invites arbitrary platform users who do not work at the company. | **Peer Eligibility Validation:** `request_p2p_verification` queries `search_coworkers` and validates that all 3 invited peer IDs have the exact company listed in their own verified work history. | **Mitigated** |
| **5. Client-Side Privilege Escalation** | A malicious user submits `PUT /profile/work-experience/{id}` with `{"verification_status": "VERIFIED"}`. | **Model Field Whitelisting:** `WorkExperienceUpdate` model strictly excludes `verification_status`. Pydantic strips any client-supplied status overrides; status transitions happen exclusively in backend logic. | **Mitigated** |
| **6. Timing & Server Log Correlation** | An observer inspects HTTP access logs to correlate peer approval POST timestamps with the `approvals_received` counter increment. | **Residual Threat:** If server logs record `POST /profile/work-experience/p2p/respond` with the peer's bearer token and timestamp, an internal sysadmin could correlate access logs with invite timestamps. **Recommended Future Hardening:** Batch processing or delayed threshold publication. | **Documented Residual** |
| **7. Invite Tracking Association** | `work_p2p_peer_invites` records which peers were *invited* to verify a request. | **Known Scope Boundary:** The database knows which 3 peers were *invited*, but cannot determine which specific peer generated which specific `blind_signature` / `key_image` in `work_p2p_blind_approvals`. Since all 3 must approve for consensus, anonymity across the 3-peer set is preserved. | **Documented Invariant** |

---

## 3. Verification & Auditing Commands

To run the automated verification suites for Tasks #61 and #63:

```bash
# Frontend ZKP, P2P, and Environment Isolation Tests:
cd frontend
npm test

# Backend Cryptographic and Work Verification Test Suite:
cd backend
.venv/Scripts/python -m pytest tests/unit/test_zkp_and_work_verification.py -v
```
