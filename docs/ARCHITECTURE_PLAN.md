# Architecture Plan: Repository & Service Layer

## Why

The backend had 299 direct Supabase calls across 13 files with zero abstraction. Every route handler called `supabase.table()` directly. This made the code:
- **Impossible to port** — switching DB/auth/storage provider means rewriting every route
- **Hard to debug** — business logic and data access mixed in every function
- **Hard to test** — tests had to mock deep Supabase internals
- **Risky to scale** — no caching layer, no place to add one

## Architecture

```
Routes (business logic, HTTP concerns)
  → Repositories (data access, injected via Depends())
    → Supabase implementation (swappable)

Routes
  → AuthService (token validation, signup, login)
    → Supabase GoTrue implementation (swappable)

Routes
  → StorageService (file uploads)
    → Supabase Storage implementation (swappable)
```

To switch providers: change `deps.py` factory functions + add new implementations. Zero route changes.

## Directory Structure

```
backend/app/
├── deps.py                        — Central DI wiring (all factory functions)
├── repositories/
│   ├── protocols.py               — All repository Protocol interfaces
│   └── supabase/                  — Supabase implementations
│       ├── user_repo.py           (User, WorkExp, Education, Skill, LoginActivity)
│       ├── post_repo.py           (posts, media, polls, comments, engagement)
│       ├── connection_repo.py
│       ├── message_repo.py
│       ├── follow_repo.py
│       ├── save_repo.py
│       ├── notification_repo.py
│       └── report_repo.py
├── services/
│   ├── protocols.py               — AuthService + StorageService protocols
│   └── supabase/
│       ├── auth_service.py        — Wraps supabase.auth.*
│       └── storage_service.py     — Wraps supabase.storage.*
├── routes/
│   ├── media.py                   — /media/upload endpoint
│   └── (all existing routes)      — Use repos via Depends()
├── middleware/auth.py             — Uses AuthService
├── models/                        — Pydantic models (unchanged)
├── lib/supabase.py                — Client init (only imported by deps.py + repos)
└── main.py                        — Router registration
```

## Refactoring Phases (Part A — Complete)

| Phase | What | Calls migrated | Status |
|-------|------|----------------|--------|
| 1 | Scaffolding: protocols, deps.py | 0 | Done |
| 2 | Auth service + middleware | 14 | Done |
| 3 | Follow, notification, report repos | 25 | Done |
| 4 | User domain (profile, auth, oauth) | 54 | Done |
| 5 | Storage + media endpoint + frontend fix | 6 | Done |
| 6 | Connection, save, post, message repos | 165 | Done |
| 7 | Search (composes existing repos) | 26 | Done |
| 8 | Cleanup: remove dead code, final test | — | Done |

## Scalability Phases (Part B — Complete)

| Phase | What | Impact | Status |
|-------|------|--------|--------|
| 9 | Rate limiting (slowapi) | Auth 10/min, writes 30/min, search 20/min, uploads 10/min | Done |
| 10 | Atomic counters | Like/comment counts recalculated from source of truth | Done |
| 11 | Async routes | Deferred — sync `def` routes run in FastAPI thread pool (correct for sync Supabase client). Convert when adopting async DB client (e.g., asyncpg with Neon) | Deferred |
| 12 | Caching layer (in-memory TTL) | User profile lookups cached 120s with invalidation on writes | Done |

## Design Decisions

- **Protocol-based interfaces** — structural subtyping, no ABC inheritance
- **Repositories return `dict`** — matches existing route code, no parallel model layer
- **`lru_cache` singletons** — stateless wrappers, created once
- **Tests per phase** — never fly blind during migration
- **`enrich_post()` stays in routes** — it's presentation logic composing multiple repos
