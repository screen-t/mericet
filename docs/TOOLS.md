# Mericet - Tools and Technology Stack

## Overview

This document catalogs all tools, technologies, and services used in the Mericet project, including who uses them, when, and how.

## Development Tools

### Version Control

**Git + GitHub**
- **Purpose:** Source code management, collaboration, code review
- **Used By:** All developers
- **When:** Throughout development for all code changes
- **Access:** All team members have repository access
- **Branches:** main, develop, feature/*, bugfix/*, hotfix/*, release/*
- **Key Features Used:**
  - Pull requests for code review
  - Issues for bug and task tracking
  - Projects for sprint management
  - Actions for CI/CD
  - Wiki for documentation
- **Training Required:** Git workflow training (Day 1)
- **Cost:** Free for public repos, $4/user/month for private

---

### Integrated Development Environments (IDEs)

**Visual Studio Code (Recommended)**
- **Purpose:** Primary code editor
- **Used By:** All developers
- **When:** All coding activities
- **Required Extensions:**
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - GitLens
  - Thunder Client (API testing)
  - Database Client (PostgreSQL)
- **Settings:** Shared settings.json in repository
- **Cost:** Free

**Alternative IDEs (Optional):**
- WebStorm (Frontend/Backend)
- Cursor (AI-powered coding)
- Zed (Performance-focused)

---

### Package Managers

**npm (Node Package Manager)**
- **Purpose:** JavaScript dependency management
- **Used By:** Frontend and Backend teams
- **When:** Installing and managing dependencies
- **Version:** 10.x or higher
- **Commands:**
  ```bash
  npm install           # Install dependencies
  npm run dev          # Start dev server
  npm run build        # Build for production
  npm test             # Run tests
  ```
- **Cost:** Free

**Bun (Optional Alternative)**
- **Purpose:** Faster JavaScript runtime and package manager
- **Used By:** Frontend team (optional)
- **When:** Development and testing
- **Benefits:** 3-4x faster than npm
- **Cost:** Free

---

## Frontend Technology Stack

### Core Framework

**React 18.3**
- **Purpose:** UI component library
- **Used By:** Frontend team
- **Key Features:** Concurrent rendering, automatic batching, transitions
- **Documentation:** https://react.dev

**TypeScript 5.8**
- **Purpose:** Type-safe JavaScript
- **Used By:** All developers
- **Configuration:** Strict mode enabled
- **Benefits:** Type safety, better IDE support, fewer runtime errors

---

### Build Tool

**Vite 5.4**
- **Purpose:** Fast development server and build tool
- **Used By:** Frontend team
- **Features:**
  - Instant hot module replacement (HMR)
  - Optimized production builds
  - Plugin ecosystem
- **Configuration:** vite.config.ts
- **Dev Server:** http://localhost:8080
- **Build Time:** ~30 seconds for production build

---

### UI Framework and Styling

**Tailwind CSS 3.4**
- **Purpose:** Utility-first CSS framework
- **Used By:** Frontend team
- **Configuration:** tailwind.config.ts
- **Benefits:** Fast styling, consistent design, small bundle size
- **JIT Mode:** Enabled for on-demand class generation

**shadcn/ui**
- **Purpose:** High-quality React component library
- **Used By:** Frontend team
- **Components:** 40+ pre-built accessible components
- **Customization:** Fully customizable with Tailwind
- **Documentation:** https://ui.shadcn.com

**Radix UI**
- **Purpose:** Unstyled, accessible UI primitives
- **Used By:** Frontend team (via shadcn/ui)
- **Benefits:** Accessibility, keyboard navigation, ARIA attributes

---

### State Management

**TanStack Query (React Query) 5.83**
- **Purpose:** Server state management, data fetching, caching
- **Used By:** Frontend team
- **Features:**
  - Automatic caching and refetching
  - Optimistic updates
  - Request deduplication
  - Pagination support
- **Configuration:** queryClient in App.tsx

**React Context + useState**
- **Purpose:** Local UI state management
- **Used By:** Frontend team
- **When:** For component-local state, theme, auth state

---

### Routing

**React Router v6.30**
- **Purpose:** Client-side routing
- **Used By:** Frontend team
- **Routes:**
  - / (Landing)
  - /login, /signup
  - /onboarding
  - /feed
  - /profile
  - /network
  - /messages
  - /notifications
  - /settings

---

### Form Handling

**React Hook Form 7.61**
- **Purpose:** Form state management and validation
- **Used By:** Frontend team
- **Benefits:** Performance, minimal re-renders, easy validation

**Zod 3.25**
- **Purpose:** Schema validation
- **Used By:** Frontend team
- **Integration:** With React Hook Form via @hookform/resolvers
- **Example:**
  ```typescript
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
  });
  ```

---

### Animation

**Framer Motion 12.24**
- **Purpose:** Animation library for React
- **Used By:** Frontend team
- **Use Cases:**
  - Page transitions
  - Component animations
  - Gesture interactions
- **Benefits:** Declarative API, smooth 60fps animations

---

### Date Handling

**date-fns 3.6**
- **Purpose:** Date manipulation and formatting
- **Used By:** Frontend team
- **Benefits:** Modular, tree-shakeable, immutable
- **Example:**
  ```typescript
  format(new Date(), 'PPP')  // "April 29, 2024"
  ```

---

### Icons

**Lucide React 0.462**
- **Purpose:** Icon library
- **Used By:** Frontend team
- **Icons Available:** 1000+ consistent icons
- **Benefits:** Tree-shakeable, consistent design, small bundle size

---

## Backend Technology Stack

### Backend-as-a-Service

**Supabase**
- **Purpose:** Backend infrastructure (Auth, Database, Storage, Realtime)
- **Used By:** Backend and Database teams
- **Components:**
  - **Auth:** User authentication and authorization
  - **Database:** PostgreSQL with Row Level Security
  - **Storage:** File uploads (images, videos)
  - **Realtime:** WebSocket subscriptions
  - **Edge Functions:** Serverless functions (if needed)
- **Plans:** 
  - Dev: Free tier (sufficient for development)
  - Staging: Pro ($25/month)
  - Production: Pro with add-ons ($25-100/month)
- **Dashboard:** https://app.supabase.com

---

### Database

**PostgreSQL 15**
- **Purpose:** Primary database
- **Used By:** Database team
- **Key Features:**
  - ACID compliance
  - JSON support
  - Full-text search
  - Row Level Security
  - Triggers and functions
- **Access:** Via Supabase Studio or direct connection
- **Backup:** Automated daily backups

**Supabase Studio**
- **Purpose:** Database management UI
- **Used By:** Database team, Backend team
- **Features:**
  - Table editor
  - SQL editor
  - RLS policy management
  - Real-time logs

---

## Testing Tools

### Unit Testing

**Vitest**
- **Purpose:** Unit testing framework
- **Used By:** Frontend and Backend teams
- **Benefits:** Fast, Vite-native, Jest-compatible API
- **Configuration:** vitest.config.ts

**React Testing Library**
- **Purpose:** React component testing
- **Used By:** Frontend team
- **Philosophy:** Test how users interact with components

---

### End-to-End Testing

**Playwright**
- **Purpose:** E2E browser automation
- **Used By:** QA team
- **Browsers:** Chromium, Firefox, WebKit
- **Features:**
  - Cross-browser testing
  - Mobile emulation
  - Screenshot/video recording
  - Test generator
- **Configuration:** playwright.config.ts

---

### API Testing

**Postman**
- **Purpose:** API development and testing
- **Used By:** Backend team, QA team
- **Features:**
  - Request collections
  - Environment variables
  - Automated tests
  - Documentation generation

**Newman**
- **Purpose:** CLI runner for Postman collections
- **Used By:** DevOps team (in CI/CD)
- **When:** Automated API testing in pipeline

---

### Performance Testing

**Lighthouse**
- **Purpose:** Frontend performance auditing
- **Used By:** Frontend team, QA team
- **Metrics:** Performance, Accessibility, Best Practices, SEO

**k6**
- **Purpose:** Load testing
- **Used By:** QA team, DevOps team
- **When:** Pre-launch load testing
- **Scenarios:** Normal load, peak load, stress testing

---

### Security Testing

**OWASP ZAP**
- **Purpose:** Security vulnerability scanning
- **Used By:** Security team, DevOps team
- **When:** Weekly automated scans, pre-release manual scan

**Snyk**
- **Purpose:** Dependency vulnerability scanning
- **Used By:** DevOps team
- **Integration:** GitHub Actions
- **When:** On every PR and weekly

**npm audit**
- **Purpose:** Check for known vulnerabilities in dependencies
- **Used By:** All developers
- **When:** Before committing dependency changes

---

## DevOps and Infrastructure

### Hosting and Deployment

**Vercel**
- **Purpose:** Frontend hosting and deployment
- **Used By:** DevOps team
- **Features:**
  - Automatic deployments from Git
  - Preview deployments for PRs
  - Edge network (CDN)
  - Analytics
- **Environments:**
  - Production: Connected to main branch
  - Staging: Connected to develop branch
- **Plan:** Pro ($20/month)

**Supabase Cloud**
- **Purpose:** Backend and database hosting
- **Used By:** DevOps team
- **Features:**
  - Managed PostgreSQL
  - Automatic backups
  - Scalability
  - Monitoring
- **Plan:** Pro ($25/month per project)

---

### CI/CD

**GitHub Actions**
- **Purpose:** Continuous Integration and Deployment
- **Used By:** DevOps team
- **Workflows:**
  - `test.yml` - Run tests on PR
  - `deploy-staging.yml` - Deploy to staging on merge to develop
  - `deploy-production.yml` - Deploy to production on merge to main
  - `security-scan.yml` - Weekly security scans
- **Cost:** Free for public repos, included in GitHub plan

---

### Monitoring and Logging

**Sentry**
- **Purpose:** Error tracking and monitoring
- **Used By:** All developers (view errors), DevOps team (manage)
- **Features:**
  - Real-time error alerts
  - Stack traces
  - Release tracking
  - Performance monitoring
- **Integration:** Frontend and Backend
- **Plan:** Team ($26/month) or Developer (Free with limitations)

**Supabase Logs**
- **Purpose:** Database and API logs
- **Used By:** Backend team, DevOps team
- **Access:** Via Supabase Dashboard
- **Retention:** 7 days (free), unlimited (Pro)

**Vercel Analytics**
- **Purpose:** Web analytics and performance
- **Used By:** Product team, DevOps team
- **Metrics:** Page views, performance, user demographics
- **Plan:** Included with Vercel Pro

---

### CDN and Assets

**Cloudflare**
- **Purpose:** CDN, DDoS protection, DNS
- **Used By:** DevOps team
- **Features:**
  - Global CDN
  - SSL/TLS
  - Web application firewall
  - Analytics
- **Plan:** Free or Pro ($20/month)

---

## Communication and Collaboration

### Team Communication

**Slack** or **Discord**
- **Purpose:** Team communication and collaboration
- **Used By:** Entire team
- **Channels:** See COMMUNICATION_PLAN.md
- **Integrations:**
  - GitHub (PR notifications, deployments)
  - Sentry (error alerts)
  - Vercel (deployment status)
  - Calendar (meeting reminders)
- **Response Time:** 2 hours during working hours
- **Cost:** Slack Standard ($7.25/user/month) or Discord (Free)

---

### Video Conferencing

**Zoom** or **Google Meet**
- **Purpose:** Video meetings, standups, reviews
- **Used By:** Entire team
- **When:** Daily standups, sprint meetings, demos
- **Features:**
  - Screen sharing
  - Recording
  - Breakout rooms
  - Polls
- **Cost:** Zoom Pro ($15/month/host) or Google Workspace included

---

### Project Management

**GitHub Projects** or **Jira**
- **Purpose:** Task tracking, sprint planning, progress monitoring
- **Used By:** Entire team
- **Features:**
  - Kanban boards
  - Sprint planning
  - Backlog management
  - Burndown charts
  - Reporting
- **Access:** All team members
- **Cost:** GitHub Projects (Free) or Jira Standard ($7.75/user/month)

---

### Documentation

**Notion** or **Confluence** (Optional)
- **Purpose:** Knowledge base, documentation, meeting notes
- **Used By:** Entire team
- **Content:**
  - Meeting notes
  - Technical documentation
  - Design docs
  - Runbooks
- **Cost:** Notion Plus ($10/user/month) or Confluence ($6/user/month)

**GitHub Wiki**
- **Purpose:** Technical documentation
- **Used By:** All developers
- **Content:**
  - Setup guides
  - Architecture docs
  - API documentation
- **Cost:** Free (included with GitHub)

---

### Design Tools

**Figma**
- **Purpose:** UI/UX design, prototyping
- **Used By:** UI/UX Designer, Frontend team (viewing)
- **Features:**
  - Design mockups
  - Prototyping
  - Component library
  - Developer handoff
- **Access:** Designer (edit), Developers (view)
- **Cost:** Professional ($15/editor/month)

---

## Development Environment Setup

### Required Software

**All Developers:**
1. Git (2.40+)
2. Node.js (18+)
3. npm (10+)
4. VS Code or preferred IDE
5. PostgreSQL client (pgAdmin or DBeaver)

**Frontend Developers:**
6. React DevTools (browser extension)
7. Tailwind CSS IntelliSense (VS Code extension)

**Backend Developers:**
6. Postman
7. Supabase CLI

**QA Engineers:**
6. Postman
7. Playwright browsers
8. OWASP ZAP

---

### Environment Variables

**Frontend (.env.local):**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:8000 (dev only)
```

**Backend/Database:**
```env
DATABASE_URL=postgresql://...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
```

---

## Tool Access and Permissions

### Access Matrix

| Tool | Project Manager | Technical Lead | Frontend Dev | Backend Dev | Database Admin | QA | Designer |
|------|----------------|----------------|--------------|-------------|----------------|-----|----------|
| GitHub | Admin | Admin | Write | Write | Write | Write | Read |
| Supabase | Admin | Admin | Read | Admin | Admin | Read | - |
| Vercel | Admin | Admin | Read | Read | - | Read | - |
| Slack | Member | Member | Member | Member | Member | Member | Member |
| Figma | View | View | View | View | - | View | Edit |
| Sentry | Admin | Admin | Member | Member | Member | Member | - |
| Postman | - | Admin | Read | Admin | Read | Admin | - |

---

## Tool Training Schedule

### Week 1 Onboarding

**Day 1: Core Tools**
- Git and GitHub workflow (2 hours)
- Slack/Discord setup and channels (30 min)
- Project management tool (1 hour)

**Day 2: Development Tools**
- Frontend: React, Vite, Tailwind (2 hours)
- Backend: Supabase, PostgreSQL (2 hours)
- Database: Schema, RLS, migrations (2 hours)

**Day 3: Testing Tools**
- Unit testing with Vitest (1 hour)
- E2E testing with Playwright (1 hour)
- API testing with Postman (1 hour)

**Day 4: DevOps and Monitoring**
- CI/CD with GitHub Actions (1 hour)
- Sentry error tracking (30 min)
- Deployment process (1 hour)

---

## Tool Budgets and Costs

### Monthly Recurring Costs

| Category | Service | Plan | Cost/Month | Annual Cost |
|----------|---------|------|------------|-------------|
| **Hosting** | Vercel | Pro | $20 | $240 |
| **Backend** | Supabase Dev | Pro | $25 | $300 |
| **Backend** | Supabase Prod | Pro | $25-100 | $300-1200 |
| **Monitoring** | Sentry | Team | $26 | $312 |
| **CDN** | Cloudflare | Pro | $20 | $240 |
| **Communication** | Slack | Standard | $73 (10 users) | $876 |
| **Project Mgmt** | Jira | Standard | $78 (10 users) | $936 |
| **Design** | Figma | Professional | $15 (1 editor) | $180 |
| **Video** | Zoom | Pro | $15 | $180 |
| **Domain** | Namecheap | - | $1 | $15 |
| **Total** | | | **$298-368** | **$3,579-4,479** |

Note: Costs estimated for 10-person team. Some tools have free tiers that may be sufficient.

---

## Tool Alternatives (Budget-Conscious Options)

### Free/Cheaper Alternatives

| Paid Tool | Free Alternative | Trade-offs |
|-----------|------------------|------------|
| Slack Standard | Discord | Less business features, but free |
| Jira | GitHub Projects | Simpler, but integrated with code |
| Notion | GitHub Wiki | Less features, but free |
| Figma Professional | Figma Free | Limited editors (3 files) |
| Sentry Team | Sentry Developer | Limited events |
| Zoom Pro | Google Meet | Requires Google Workspace |

---

## Tool Evaluation Criteria

When considering new tools:

1. **Cost:** Fits within budget
2. **Integration:** Works with existing stack
3. **Learning Curve:** Team can adopt quickly
4. **Support:** Good documentation and community
5. **Scalability:** Grows with project
6. **Security:** Meets security requirements
7. **Reliability:** High uptime and performance

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 20, 2026 | TBD | Initial tools document |
