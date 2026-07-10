# Mericet - Professional Networking Platform

A modern professional networking platform built for entrepreneurs, innovators, and business leaders to connect, collaborate, and grow.

## Tech Stack

### Frontend
- **React 18.3** with TypeScript
- **Vite 5.4** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **TanStack Query** - Server state management
- **React Router v6** - Client-side routing
- **Framer Motion** - Smooth animations
- **React Hook Form + Zod** - Form validation

### Backend
- **FastAPI** - Modern Python web framework
- **Python 3.9+** with type hints
- **Uvicorn** - ASGI server
- **Supabase Client** - Database and auth integration
- **Pydantic** - Data validation and serialization
- **slowapi** - Rate limiting
- **Repository Pattern** - Database abstraction layer for provider portability
- **pytest** - Testing framework

### Database & Infrastructure
- **PostgreSQL** (via Supabase) - Database
- **Row Level Security** - Data protection
- **Supabase Auth** - Authentication (OAuth, email/password)
- **Supabase Storage** - File uploads (abstracted behind StorageService)

## Project Structure

```
mericet/
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── feed/           # Feed, PostCard, CreatePost, SaveToFolder
│   │   │   ├── layout/         # AppLayout, Navbar, Sidebar
│   │   │   ├── profile/        # Profile components
│   │   │   └── ui/             # shadcn/ui components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utilities (api, auth, supabase, backend-api)
│   │   ├── pages/              # Page components
│   │   └── types/              # TypeScript type definitions
│   └── package.json
├── backend/                    # FastAPI backend application
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── deps.py             # Dependency injection wiring (single swap point)
│   │   ├── lib/
│   │   │   ├── supabase.py     # Supabase client configuration
│   │   │   └── cache.py        # In-memory TTL cache
│   │   ├── middleware/
│   │   │   ├── auth.py         # Authentication middleware
│   │   │   └── rate_limit.py   # Rate limiting configuration
│   │   ├── models/             # Pydantic request/response models
│   │   ├── repositories/       # Data access layer
│   │   │   ├── protocols.py    # Repository interfaces (Protocol classes)
│   │   │   └── supabase/       # Supabase implementations
│   │   ├── services/           # External service abstractions
│   │   │   ├── protocols.py    # Service interfaces (AuthService, StorageService)
│   │   │   └── supabase/       # Supabase implementations
│   │   └── routes/             # API route handlers
│   │       ├── auth.py         # Authentication (signup, login, logout, refresh)
│   │       ├── oauth.py        # OAuth flows (Google, GitHub, LinkedIn)
│   │       ├── profile.py      # User profiles, avatar, work experience
│   │       ├── posts.py        # Posts, comments, polls, engagement
│   │       ├── messages.py     # Conversations, messages, reactions
│   │       ├── connections.py  # Connection requests, blocking
│   │       ├── follows.py      # Follow/unfollow
│   │       ├── notifications.py # Notifications
│   │       ├── search.py       # Search (users, posts, messages, companies)
│   │       ├── saves.py        # Saved posts and folders
│   │       ├── reports.py      # Content reporting and moderation
│   │       └── media.py        # File upload endpoint
│   ├── tests/
│   └── requirements.txt
├── supabase/
│   ├── config.toml
│   └── migrations/             # Database migrations (01-18)
├── docs/                       # Project documentation
└── README.md
```

## Architecture

The backend uses a **Repository Pattern** with **Dependency Injection** to decouple business logic from the database provider:

```
Routes (business logic)
  ↓ Depends()
deps.py (DI wiring — single swap point)
  ↓
Repositories / Services (data access)
  ↓
Supabase (current provider)
```

To switch database providers (e.g., Supabase → Neon/PostgreSQL), only `deps.py` and the repository implementations change. Routes remain untouched.

See [docs/ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md) for full details.

## Key Features

### Authentication & Security
- Email/password signup and login
- OAuth (Google, GitHub, LinkedIn)
- Login activity tracking
- Session management
- Rate limiting on auth endpoints (10/min)

### Profile Management
- Profile editing (4-tab interface)
- Account type switching (Professional/Business)
- Work history and education tracking
- Avatar and cover photo uploads
- Privacy settings with granular controls

### Social Feed
- **For You** and **Following** feed tabs
- Post creation with images, videos, polls, drafts, scheduling
- Post interactions (Like, Comment, Repost, Share, Save)
- Optimistic UI updates with TanStack Query

### Messaging
- Direct messaging with conversation management
- Message editing (15-min window) and soft delete
- Emoji reactions
- Conversation pinning
- Read receipts and unread counts
- Block/connection checks

### Saved Library
- Save posts to custom folders
- Folder management (create, rename, delete)
- Search within saved posts

### Search
- Search users, posts, messages, saved posts, companies
- Autocomplete suggestions
- Trending posts

### Connections & Follows
- Connection requests (send, accept, decline)
- Block/unblock users
- Mutual connections
- Connection suggestions
- Follow/unfollow (separate from connections)

### Notifications
- In-app notifications with unread counts
- Mark read/unread, bulk clear

### Moderation
- Content reporting system
- Moderation queue for admins

## Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.9+
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd mericet
   ```

2. **Set up Backend**
   ```bash
   cd backend
   python -m venv .venv

   # Activate virtual environment
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Set up Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**

   **Backend** — copy `backend/.env.example` to `backend/.env` and fill in:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   FRONTEND_URL=http://localhost:8080
   BACKEND_URL=http://localhost:8000
   REPORT_MODERATOR_EMAILS=your-email@example.com
   REPORT_MODERATOR_USERNAMES=your-username
   ```

   **Frontend** — copy `frontend/.env.example` to `frontend/.env.local` and fill in:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_BASE_URL=http://localhost:8000
   ```

5. **Run database migrations**
   ```bash
   cd ../supabase
   supabase db push
   ```

6. **Start development servers**

   **Backend (Terminal 1):**
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   **Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```

   - Backend API: `http://localhost:8000`
   - Frontend app: `http://localhost:8080`
   - API docs (Swagger): `http://localhost:8000/docs`

## Development

### Available Scripts

**Backend:**
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # Dev server
pytest                                                                 # Run tests
pytest --cov=app                                                       # Tests with coverage
```

**Frontend:**
```bash
npm run dev        # Dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint
```

## Contributing

1. Create a feature branch (`git checkout -b feature/your-feature`)
2. Commit your changes (`git commit -m 'Add your feature'`)
3. Push to the branch (`git push origin feature/your-feature`)
4. Open a Pull Request

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for branching strategy and PR guidelines.

## License

This project is proprietary and confidential.
