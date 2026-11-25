# Mericet Staging Environment Specification & Production-Safe Architecture

## 1. Environment Separation Architecture

To guarantee that untested features and preview builds never compromise production data, Mericet enforces three completely isolated environment tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LOCAL DEVELOPMENT                                                        │
│    Frontend: http://localhost:8080 (Vite)                                   │
│    Backend:  http://localhost:8000 (FastAPI local)                          │
│    Database: Local Docker Postgres or Supabase local branch                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ Isolated
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. VERCEL PREVIEW & STAGING                                                 │
│    Frontend: https://mericet-*-mericet.vercel.app (Preview branches)         │
│    Backend:  https://mericet-staging.onrender.com (Staging Web Service)     │
│    Database: Isolated Staging Supabase Project (Tables 01-37)               │
│    Invariant: Never connects to production; fails closed if unconfigured    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ Strict Isolation Boundary
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. LIVE PRODUCTION                                                          │
│    Frontend: https://mericet.vercel.app                                     │
│    Backend:  https://mericet.onrender.com                                   │
│    Database: Production Supabase Project (Main Branch)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Strict Security Rule on Fallbacks
The client application ([`frontend/src/lib/api.ts`](file:///d:/mercint/mericet/frontend/src/lib/api.ts) and [`frontend/src/lib/backend-api.ts`](file:///d:/mercint/mericet/frontend/src/lib/backend-api.ts)) strictly prohibits automatic fallback from preview or non-localhost origins to `https://mericet.onrender.com`.
If `VITE_BACKEND_URL` is omitted on a deployed preview environment, the client immediately throws a `ConfigurationError` and halts network activity rather than risking accidental mutations against the production database.

---

## 2. Dedicated Staging Backend Service (Render)

A dedicated staging backend Web Service must be provisioned on Render to serve Preview deployments of feature branches and `dev`.

### 2.1 Staging Web Service Configuration
- **Name:** `mericet-backend-staging`
- **Environment:** Python 3.11
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Target Branch:** `dev` (or feature branch for active review)
- **Health Check Path:** `/health` (Expects HTTP 200: `{"status": "healthy"}`)

### 2.2 Required Environment Variables (Staging Service)
| Variable | Value / Description | Sensitive |
| :--- | :--- | :--- |
| `SUPABASE_URL` | `https://<staging-project-id>.supabase.co` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging Service Role Secret Key | **Yes (Secret)** |
| `FRONTEND_URL` | `https://mericet-staging.vercel.app` | No |
| `ALLOWED_ORIGINS` | `https://mericet.vercel.app,https://*.vercel.app` | No |
| `BACKEND_URL` | `https://mericet-backend-staging.onrender.com` | No |
| `ENVIRONMENT` | `staging` | No |

### 2.3 CORS Configuration for Staging
The staging backend incorporates `allow_origin_regex=r"^https:\/\/.*\.vercel\.app$"` to allow dynamic Vercel preview URLs with credentials while rejecting unapproved domains.

### 2.4 Deployment & Rollback Procedure
1. **Deployment:** Automated via GitHub Webhook or Render Deploy Hook on pushes to `dev`.
2. **Rollback:** In Render Dashboard $\rightarrow$ `mericet-backend-staging` $\rightarrow$ **Deploys** $\rightarrow$ select the previous stable deployment and click **Rollback**.

---

## 3. Supabase Staging Migration Plan (Migration 37)

### 3.1 Provisioning Staging Supabase Project
1. Create a separate Supabase project (e.g. `mericet-staging`).
2. Record its project reference, URL, anon key, and service-role key.
3. Keep database credentials completely segregated from production credentials.

### 3.2 Sequential Migration Execution
Execute migrations in strict numerical sequence:
```
01_init.sql
...
30_disable_rls_backend_tables.sql
...
36_living_graph_production_readiness.sql
37_work_experience_verification_and_p2p.sql
```

### 3.3 Verification Checklist for Migration 37
Run the following SQL verification query in Staging SQL Editor:
```sql
-- 1. Verify extended columns on work_experience
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'work_experience'
  AND column_name IN ('employment_type', 'verification_status', 'verification_type', 'verified_at', 'verification_metadata', 'anonymous_proof');

-- 2. Verify new tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('work_verification_requests', 'work_p2p_peer_invites', 'work_p2p_blind_approvals');

-- 3. Verify unique anti-replay index on key_image
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'work_p2p_blind_approvals' AND indexname = 'work_p2p_blind_approvals_key_image_key';
```

### 3.4 Rollback Plan for Migration 37
If rollback is required on staging:
```sql
DROP TABLE IF EXISTS work_p2p_blind_approvals CASCADE;
DROP TABLE IF EXISTS work_p2p_peer_invites CASCADE;
DROP TABLE IF EXISTS work_verification_requests CASCADE;
ALTER TABLE work_experience
  DROP COLUMN IF EXISTS anonymous_proof,
  DROP COLUMN IF EXISTS verification_metadata,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verification_type,
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS employment_type;
```

---

## 4. Frontend Vercel Preview Configuration

In Vercel Dashboard under **Settings $\rightarrow$ Environment Variables**, configure the following variables specifically scoped to **Preview**:

| Environment Variable | Target Value | Environment Scope | Exposed to Client |
| :--- | :--- | :--- | :--- |
| `VITE_BACKEND_URL` | `https://mericet-backend-staging.onrender.com` | Preview | Yes |
| `VITE_SUPABASE_URL` | `https://<staging-project-id>.supabase.co` | Preview | Yes |
| `VITE_SUPABASE_ANON_KEY` | Staging Supabase Public Anon Key | Preview | Yes |

> [!CAUTION]
> **Never** expose `SUPABASE_SERVICE_ROLE_KEY` in frontend variables (`VITE_*`). Frontend bundles only use the public `VITE_SUPABASE_ANON_KEY`.

---

## 5. Google OAuth Configuration Checklist (Staging / Preview)

1. **Google Cloud Console (`https://console.cloud.google.com/`):**
   - In **APIs & Services $\rightarrow$ Credentials $\rightarrow$ OAuth 2.0 Client IDs**:
   - **Authorized JavaScript Origins:**
     - `http://localhost:8080`
     - `https://<staging-project-id>.supabase.co`
   - **Authorized Redirect URIs:**
     - `https://<staging-project-id>.supabase.co/auth/v1/callback`
2. **Supabase Staging Dashboard:**
   - In **Authentication $\rightarrow$ Providers $\rightarrow$ Google**:
     - Enable Google Provider.
     - Supply Google Client ID and Client Secret.
   - In **Authentication $\rightarrow$ URL Configuration**:
     - **Site URL:** `https://mericet-staging.vercel.app`
     - **Redirect URLs (Allowlist):**
       - `http://localhost:8080/auth/callback`
       - `http://localhost:5173/auth/callback`
       - `https://*-mericet.vercel.app/auth/callback`
       - `https://mericet-*.vercel.app/auth/callback`
