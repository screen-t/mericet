from fastapi import APIRouter, HTTPException, Depends, Request
from app.middleware.auth import require_auth
from app.deps import get_auth_service, get_user_repo, get_login_activity_repo
from app.models.auth import (
    SignupRequest, LoginRequest, LogoutRequest,
    RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest
)
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Auth"])


def _parse_user_agent(user_agent: str):
    browser = "Unknown"
    device = "Unknown"
    if user_agent:
        if "Chrome" in user_agent:
            browser = "Chrome"
        elif "Firefox" in user_agent:
            browser = "Firefox"
        elif "Safari" in user_agent:
            browser = "Safari"
        elif "Edge" in user_agent:
            browser = "Edge"
        if "Mobile" in user_agent or "Android" in user_agent or "iPhone" in user_agent:
            device = "Mobile"
        elif "Tablet" in user_agent or "iPad" in user_agent:
            device = "Tablet"
        else:
            device = "Desktop"
    return browser, device


@router.post("/signup")
def signup(
    payload: SignupRequest,
    request: Request,
    auth_service=Depends(get_auth_service),
    user_repo=Depends(get_user_repo),
    login_repo=Depends(get_login_activity_repo),
):
    if not user_repo.check_username_available(payload.username):
        raise HTTPException(status_code=409, detail="Username already taken")

    try:
        result = auth_service.sign_up(payload.email, payload.password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

    if result.user is None:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    user_id = result.user.id

    try:
        user_repo.upsert({
            "id": user_id,
            "email": payload.email,
            "username": payload.username,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "is_verified": False,
        })
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Account created but profile setup failed. Please contact support.",
        )

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    session_id = result.session.access_token if result.session else ""
    browser, device = _parse_user_agent(user_agent)
    login_repo.track({
        "user_id": user_id, "device": device, "browser": browser,
        "ip_address": client_ip, "status": "success",
        "session_id": session_id, "is_active": True,
        "login_at": datetime.utcnow().isoformat(),
    })

    return {
        "success": True,
        "user": {
            "id": user_id,
            "email": payload.email,
            "username": payload.username,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
        },
        "session": result.session,
    }


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    auth_service=Depends(get_auth_service),
    user_repo=Depends(get_user_repo),
    login_repo=Depends(get_login_activity_repo),
):
    try:
        result = auth_service.sign_in(payload.email, payload.password)
        if not result.user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "invalid login credentials" in error_msg:
            raise HTTPException(status_code=401, detail="Invalid email or password. Please check your credentials and try again.")
        elif "email not confirmed" in error_msg:
            raise HTTPException(status_code=401, detail="Please check your email and click the confirmation link before logging in.")
        elif "too many requests" in error_msg:
            raise HTTPException(status_code=429, detail="Too many login attempts. Please wait a few minutes and try again.")
        else:
            raise HTTPException(status_code=500, detail="Login failed. Please try again or contact support if the problem persists.")

    try:
        user_repo.update(result.user.id, {"last_active_at": "now()"})
    except Exception:
        pass

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    session_id = result.session.access_token if result.session else ""
    browser, device = _parse_user_agent(user_agent)
    login_repo.track({
        "user_id": result.user.id, "device": device, "browser": browser,
        "ip_address": client_ip, "status": "success",
        "session_id": session_id, "is_active": True,
        "login_at": datetime.utcnow().isoformat(),
    })

    return {
        "success": True,
        "user": {"id": result.user.id, "email": result.user.email},
        "session": result.session,
    }


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    user=Depends(require_auth),
    request: Request = None,
    auth_service=Depends(get_auth_service),
    login_repo=Depends(get_login_activity_repo),
):
    auth_service.sign_out(payload.refresh_token)
    session_token = request.headers.get("Authorization", "").replace("Bearer ", "") if request else ""
    if session_token:
        login_repo.deactivate_session(session_token)
    return {"success": True}


@router.post("/refresh")
def refresh(payload: RefreshRequest, auth_service=Depends(get_auth_service)):
    result = auth_service.refresh_session(payload.refresh_token)
    if not result.session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return {"success": True, "session": result.session}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, auth_service=Depends(get_auth_service)):
    auth_service.reset_password_email(payload.email)
    return {"success": True, "message": "If email exists, password reset link has been sent"}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, auth_service=Depends(get_auth_service)):
    auth_service.update_password(payload.access_token, payload.new_password)
    return {"success": True, "message": "Password updated successfully"}


@router.get("/me")
def me(user_id: str = Depends(require_auth), user_repo=Depends(get_user_repo)):
    profile = user_repo.get_by_id(user_id, "id, email")
    if not profile:
        return {"id": user_id, "email": None}
    return profile


@router.get("/check-username")
def check_username(username: str, user_repo=Depends(get_user_repo)):
    if not username or not username.strip():
        raise HTTPException(status_code=400, detail="username query parameter required")
    return {"available": user_repo.check_username_available(username)}
