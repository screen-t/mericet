# Mericet - Engineering Standards

This document defines how we write code, why we make the technical choices we do, and what we expect from every contributor. Read this before writing your first line of code.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript + Vite | Fast builds, type safety, large ecosystem |
| UI | Tailwind CSS + shadcn/ui | Consistent design, no custom CSS bloat |
| State | TanStack Query | Server state caching, optimistic updates, no Redux boilerplate |
| Backend | FastAPI (Python) | Fast, async-capable, automatic API docs, type validation via Pydantic |
| Database | PostgreSQL (via Supabase) | Mature, scalable, full SQL, row-level security |
| Auth | Supabase Auth | OAuth + email/password out of the box, JWT-based |
| Storage | Supabase Storage | File uploads with CDN, abstracted behind StorageService |
| Rate Limiting | slowapi | Protects endpoints from abuse |

## Provider Portability

**Core principle: no route should ever import a database client directly.**

We use Supabase today, but the codebase is built to switch providers (e.g., Neon, raw PostgreSQL, PlanetScale) without rewriting business logic. This is achieved through three layers:

1. **Protocol interfaces** (`repositories/protocols.py`, `services/protocols.py`) — define what methods exist, not how they work
2. **Implementations** (`repositories/supabase/`, `services/supabase/`) — the actual Supabase calls
3. **Dependency injection** (`deps.py`) — the single file that wires implementations to interfaces

To switch providers:
- Create new implementations (e.g., `repositories/neon/post_repo.py`)
- Change the imports in `deps.py`
- Routes stay untouched

This applies to all three external dependencies:
- **Database** — repositories (UserRepository, PostRepository, etc.)
- **Auth** — AuthService (signup, login, token validation)
- **Storage** — StorageService (upload, get URL, delete)

## Code We Accept

### Clean and focused
- Each function does one thing
- Routes handle HTTP concerns (validation, response codes). Repositories handle data access. No mixing.
- No dead code. If it's not used, delete it.
- No commented-out code blocks left behind

### Decoupled
- Routes inject dependencies via `Depends()`. Never instantiate repos/services directly in routes.
- No direct `supabase.table()` calls in routes or middleware
- Frontend components call `backendApi.*` methods, not Supabase client directly (except OAuth redirects which are inherently provider-specific)

### Efficient
- Use batch queries over per-item loops (e.g., `get_many_by_ids()` instead of N calls to `get_by_id()`)
- Enrich posts in bulk (`bulk_enrich_posts`) — 4-7 queries regardless of post count
- Cache hot data (user profiles: 120s TTL) and invalidate on writes
- Use atomic database operations for counters (RPCs, not read-then-write)

### Typed
- Backend: type hints on all function signatures, Pydantic models for request/response
- Frontend: TypeScript interfaces for all API responses, no `any` types in new code

### Minimal
- No abstractions for things that don't vary. Three similar lines are better than a premature helper.
- No feature flags or backwards-compatibility shims — change the code directly
- No comments explaining *what* code does. Only comment *why* when the reason is non-obvious.

## Code We Reject

- **Direct provider calls in routes** — always go through a repository or service
- **Read-then-write patterns for counters** — use atomic operations (RPCs or `sync_comment_count`)
- **N+1 query patterns** — if you're querying inside a loop, batch it
- **Catch-all error handlers that swallow errors silently** — log or re-raise
- **Unused imports, dead functions, or TODO comments without action** — clean up before merging
- **Frontend components importing Supabase directly** — use `backendApi.*` methods

## Caching Strategy

We use an **in-memory TTL cache** (`backend/app/lib/cache.py`) for hot read paths:

| Cache | TTL | What | Invalidation |
|-------|-----|------|-------------|
| `user_cache` | 120s | User profiles (get_by_id, get_by_username, get_many_by_ids) | On update/upsert |
| `post_cache` | 30s | Reserved for future post caching | On create/update/delete |

**Rules:**
- Cache reads, not writes
- Always invalidate on mutation (update, upsert, delete)
- Use `invalidate_prefix()` for broad invalidation (e.g., all cached fields for a user)
- When in doubt, skip the cache — correctness over speed

**Future:** When traffic grows, replace in-memory cache with Redis for multi-instance deployments. The `TTLCache` interface stays the same.

## Modularity Priorities

In order of importance:

1. **Decouple from external providers** — never let a provider's API leak into business logic
2. **Separate concerns** — routes (HTTP), repositories (data), services (external APIs), models (validation)
3. **Batch over loop** — design repository methods for bulk operations first
4. **Inject over import** — use `Depends()` so tests can swap implementations
5. **Delete over deprecate** — if something is replaced, remove the old version

## Rate Limiting

Applied via `slowapi` decorators on route functions:

| Category | Limit | Endpoints |
|----------|-------|-----------|
| Auth | 10/minute | signup, login, forgot-password, reset-password |
| Writes | 30/minute | create post, send message |
| Search | 20/minute | search users, search all |
| Uploads | 10/minute | media upload |
| Reads | No limit | feed, get post, get conversations (protected by auth) |

Limits are per IP address by default. Defined in `backend/app/middleware/rate_limit.py`.

## Counter Integrity

All engagement counters (likes, comments, reposts) are kept accurate through two mechanisms:

1. **Atomic RPCs** — `increment_post_likes`, `decrement_post_comments`, etc. These run `UPDATE SET count = count + 1` in a single SQL statement (no race conditions)
2. **Source-of-truth recalculation** — when enriching posts for display, `like_count` and `comment_count` are recalculated by counting actual rows in `post_likes` and `comments` tables, not trusting the cached column

If an RPC fails, the repository falls back to recalculating from source of truth.

## Adding New Features

When adding a new feature that involves data access:

1. Add methods to the appropriate repository protocol in `repositories/protocols.py`
2. Implement them in the Supabase repo (e.g., `repositories/supabase/xxx_repo.py`)
3. Wire the repo in `deps.py` if it's a new repository
4. Inject via `Depends()` in the route
5. Never import `supabase` directly in the route file

When adding a new API endpoint:

1. Add the Pydantic model in `models/`
2. Add the route in the appropriate `routes/*.py` file
3. Apply rate limiting if it's a write or search endpoint
4. Test that the app starts: `python -c "from app.main import app; print('OK')"`
