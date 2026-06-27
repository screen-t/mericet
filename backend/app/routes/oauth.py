from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from app.deps import get_auth_service, get_user_repo
import os

router = APIRouter(prefix="/auth/oauth", tags=["OAuth"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


@router.get("/google")
def google_oauth(auth_service=Depends(get_auth_service)):
    from app.lib.supabase import supabase
    res = supabase.auth.sign_in_with_oauth({
        "provider": "google",
        "options": {"redirect_to": f"{BACKEND_URL}/auth/oauth/callback"},
    })
    return {"url": res.url}


@router.get("/github")
def github_oauth(auth_service=Depends(get_auth_service)):
    from app.lib.supabase import supabase
    res = supabase.auth.sign_in_with_oauth({
        "provider": "github",
        "options": {"redirect_to": f"{BACKEND_URL}/auth/oauth/callback"},
    })
    return {"url": res.url}


@router.get("/linkedin")
def linkedin_oauth(auth_service=Depends(get_auth_service)):
    from app.lib.supabase import supabase
    res = supabase.auth.sign_in_with_oauth({
        "provider": "linkedin_oidc",
        "options": {"redirect_to": f"{BACKEND_URL}/auth/oauth/callback"},
    })
    return {"url": res.url}


@router.get("/callback")
def oauth_callback(
    request: Request,
    user_repo=Depends(get_user_repo),
):
    try:
        from app.lib.supabase import supabase
        session = supabase.auth.get_session_from_url(str(request.url))
        if not session or not session.user:
            raise HTTPException(status_code=400, detail="OAuth failed")

        user = session.user
        user_repo.upsert({
            "id": user.id,
            "email": user.email,
            "first_name": user.user_metadata.get("full_name", "").split(" ")[0],
            "last_name": " ".join(user.user_metadata.get("full_name", "").split(" ")[1:]),
            "avatar_url": user.user_metadata.get("avatar_url"),
            "is_active": True,
        })

        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback"
            f"?access_token={session.access_token}"
            f"&refresh_token={session.refresh_token}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
