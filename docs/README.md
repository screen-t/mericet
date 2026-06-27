# Mericet Documentation

This directory contains documentation for the Mericet professional networking platform.

## Documentation Index

### Architecture

**[ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md)**
- Repository pattern and service layer design
- Dependency injection via `deps.py`
- How to swap database/storage/auth providers
- Scalability hardening (rate limiting, caching, atomic counters)

### Technical Reference

**[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)**
- Complete PostgreSQL schema (18 migrations)
- Column definitions and data types
- Indexes and foreign key relationships
- Row Level Security (RLS) policies
- Database triggers and functions

**[API_REQUIREMENTS.md](./API_REQUIREMENTS.md)**
- All API endpoint specifications
- Request/response formats
- Authentication flows
- Error handling

**[FRONTEND_DATA_MODELS.md](./FRONTEND_DATA_MODELS.md)**
- TypeScript interfaces for all data models
- TanStack Query patterns
- Component props patterns
- Validation schemas

**[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)**
- Backend integration instructions
- Authentication implementation
- Critical endpoint priorities
- Testing procedures

### Process & Team

**[TEAM_STRUCTURE.md](./TEAM_STRUCTURE.md)**
- Roles and responsibilities
- Reporting structure
- Onboarding procedures

**[WORKFLOW.md](./WORKFLOW.md)**
- Git branching strategy
- Code review process
- Pull request guidelines
- Commit message standards

**[COMMUNICATION_PLAN.md](./COMMUNICATION_PLAN.md)**
- Communication channels and tools
- Meeting schedule and structure
- Escalation procedures

### Quality & Security

**[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)**
- Testing types and coverage targets
- Unit, integration, E2E testing
- Test tools and frameworks
- Quality gates

**[SECURITY_AUDIT.md](./SECURITY_AUDIT.md)**
- Security architecture
- Authentication and authorization
- Input validation
- Data protection
- Incident response

**[RELEASE_PLAN.md](./RELEASE_PLAN.md)**
- Versioning strategy (SemVer)
- Release process and procedures
- Rollback and hotfix procedures

### Reference

**[TOOLS.md](./TOOLS.md)**
- Complete technology stack
- Development tools
- Project management tools

## Architecture Overview

```
Frontend (React + TypeScript)
    │
    │ REST API
    │
FastAPI Backend
    ├── Routes (business logic)
    │     ↓ Depends()
    ├── deps.py (DI wiring)
    │     ↓
    ├── Repositories (data access)
    │     ↓
    └── Supabase / PostgreSQL
```

All data access goes through repository classes injected via `deps.py`. To switch providers, change `deps.py` and add new repository implementations — routes stay untouched.

## Quick Start

1. Read the root [README.md](../README.md) for setup instructions
2. Read [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) to understand the codebase structure
3. Read [API_REQUIREMENTS.md](./API_REQUIREMENTS.md) for endpoint specs
4. Read [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the data model
