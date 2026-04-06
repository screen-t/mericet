# Stonet - Professional Networking Platform

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
- **date-fns** - Date utilities
- **Lucide React** - Icon system

### Backend
- **FastAPI** - Modern Python web framework
- **Python 3.9+** - Programming language
- **Uvicorn** - ASGI server for FastAPI
- **Supabase Client** - Database and auth integration
- **Pydantic** - Data validation and serialization
- **pytest** - Testing framework
- **Python-dotenv** - Environment variable management

### Database & Infrastructure
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Database
- **Row Level Security** - Data protection

## Project Structure

```
stonet/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── feed/      # Feed-related components
│   │   │   ├── layout/    # Layout components (Navbar, Sidebar)
│   │   │   ├── profile/   # Profile components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── pages/         # Page components
│   ├── package.json
│   └── vite.config.ts
├── backend/               # FastAPI backend application
│   ├── app/
│   │   ├── main.py        # FastAPI application entry point
│   │   ├── lib/           # Utility functions and helpers
│   │   │   ├── auth_helpers.py  # Authentication utilities
│   │   │   └── supabase.py      # Supabase client configuration
│   │   ├── middleware/    # FastAPI middleware
│   │   │   └── auth.py    # Authentication middleware
│   │   ├── models/        # Pydantic data models
│   │   │   └── auth.py    # Authentication models
│   │   └── routes/        # API route handlers
│   │       └── auth.py    # Authentication endpoints
│   ├── tests/             # Backend tests
│   │   ├── conftest.py    # pytest configuration
│   │   └── unit/          # Unit tests
│   │       └── test_auth_unit.py
│   └── requirements.txt   # Python dependencies
├── supabase/              # Supabase configuration
│   ├── config.toml
│   └── migrations/        # Database migrations
├── docs/                  # Project documentation
└── README.md
```

## Key Features

### Authentication & Security
- Multiple login methods (Email, Phone, Google, GitHub, LinkedIn)
- Two-factor authentication ready
- Privacy settings with granular controls
- Login activity tracking
- Session management

### Profile Management
- Comprehensive profile editing (4-tab interface)
- Account type switching (Professional/Business)
- Work history and education tracking
- Professional pronouns support
- Location and contact information
- Profile visibility controls

### Social Feed
- **For You** and **Following** feed tabs
- Rich post creation with:
  - Image and video uploads
  - Poll creation (2-4 options)
  - Text formatting (bold, italic, links)
  - Hashtags and mentions
  - Emoji and GIF support
  - Scheduled posts
  - Draft saving
- Post interactions (Like, Comment, Repost, Share, Bookmark)

### Messaging
- Direct messaging system
- Read/unread status indicators
- Real-time messaging ready

### Onboarding
- Simplified 2-step onboarding flow
- Flexible profile setup
- Skip options for optional fields

## Setup Instructions

### Prerequisites
- Node.js 18+ or Bun
- npm, yarn, pnpm, or bun
- Python 3.9+ 
- pip (Python package manager)
- Supabase account (for backend)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd stonet
   ```

2. **Set up Backend**
   ```bash
   cd backend
   
   # Create virtual environment (recommended)
   python -m venv .venv
   
   # Activate virtual environment
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   
   # Install Python dependencies
   pip install -r requirements.txt
   ```

3. **Set up Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**
   
   **Backend (.env)** - Create in `backend/` directory:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_jwt_secret_key
   ```
   
   **Frontend (.env.local)** - Create in `frontend/` directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Run database migrations**
   ```bash
   cd ../supabase
   # Set up Supabase CLI and run migrations
   supabase db push
   ```

6. **Start the development servers**
   
   **Backend server (Terminal 1):**
   ```bash
   cd backend
   # Make sure virtual environment is activated
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   Backend API will be available at `http://localhost:8000`
   
   **Frontend server (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend app will be available at `http://localhost:8080`

## Development

### Available Scripts

**Backend (Python/FastAPI)**
```bash
# Start development server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest

# Run tests with coverage
pytest --cov=app

# Run specific test file
pytest tests/unit/test_auth_unit.py

# Install new dependencies
pip install package_name
pip freeze > requirements.txt
```

**Frontend (React/Vite)**
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### API Endpoints (Backend)

The FastAPI backend provides the following endpoints:

**Authentication:**
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout  
- `POST /auth/refresh` - Refresh access token
- `GET /auth/check-username/{username}` - Check username availability

**General:**
- `GET /` - API status and health check
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation

**Access API Documentation:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Code Style & Architecture

**Backend:**
- FastAPI with async/await patterns
- Pydantic models for request/response validation
- Modular structure with separate routes, models, middleware
- Environment-based configuration
- Comprehensive error handling
- Type hints throughout codebase

**Frontend:**
- TypeScript strict mode disabled for rapid development
- ESLint configured for code quality
- Tailwind CSS for consistent styling
- Component-based architecture

## Database Schema

Current tables:
- `users` - User profiles and authentication
- `posts` - User posts and content
- `connections` - User connections/relationships
- Additional tables for skills, work experience, messages, etc.

See `supabase/migrations/` for complete schema.

## Environment Variables

### Backend (.env)
```env
SUPABASE_URL=              # Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY= # Your Supabase service role key (server-side)
JWT_SECRET=                # Secret key for JWT token generation
```

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=         # Your Supabase project URL
VITE_SUPABASE_ANON_KEY=    # Your Supabase anonymous key (client-side)
```

> **Important:** Never commit environment files to Git. The backend .env and frontend .env.local files are already in .gitignore.

## Contributing

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
3. Push to the branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## Roadmap

### In Progress
- [ ] OAuth integration (Google, GitHub, LinkedIn)
- [ ] CI/CD pipeline setup
- [ ] Real-time messaging
- [ ] Search functionality
- [ ] Notifications system

### Planned Features
- [ ] Video calling
- [ ] Company pages
- [ ] Events and webinars
- [ ] Job board
- [ ] Analytics dashboard
- [ ] Mobile app (React Native)

## License

This project is proprietary and confidential.

## Support

For support, email or open an issue in the repository.

---

Built by Screen-t
