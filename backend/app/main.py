from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth_router
from app.routes.oauth import router as oauth_router
from app.routes.profile import router as profile_router
from app.routes.posts import router as posts_router
from app.routes.connections import router as connections_router
from app.routes.messages import router as messages_router
from app.routes.notifications import router as notifications_router
from app.routes.search import router as search_router

# FastAPI application
app = FastAPI(title="Mericet Backend API")

# CORS settings - allow frontend development and production hosts
import os

origins = [
    # Local development
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    # Production (hardcoded known URLs)
    "https://mericet.vercel.app",
    "https://www.mericet.vercel.app",
]

# Also support FRONTEND_URL env var (single URL)
frontend_url = os.getenv("FRONTEND_URL", "").strip()
if frontend_url and frontend_url not in origins:
    origins.append(frontend_url)

# Also support ALLOWED_ORIGINS env var (comma-separated list of extra URLs)
extra_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
if extra_origins:
    for url in extra_origins.split(","):
        url = url.strip()
        if url and url not in origins:
            origins.append(url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Root endpoint
@app.get("/")
def root():
    return {"message": "Mericet Backend API", "status": "running"}

# Health check endpoint for monitoring
@app.get("/health")
def health():
    return {"status": "healthy"}

# Include authentication routes
app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(profile_router)
app.include_router(posts_router)
app.include_router(connections_router)
app.include_router(messages_router)
app.include_router(notifications_router)
app.include_router(search_router)

