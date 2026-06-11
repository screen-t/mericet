from fastapi import APIRouter, HTTPException, Depends, Request
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.auth import (
    SignupRequest, LoginRequest, LogoutRequest, 
    RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest
)
from app.lib.auth_helpers import check_username_availability, track_login_activity, deactivate_session

router = APIRouter(prefix="/auth", tags=["Auth"])

# Signup Api
@router.post("/signup")
def signup(payload: SignupRequest, request: Request):
    # Check username availability
    if not check_username_availability(payload.username):
        raise HTTPException(
            status_code=409,
            detail="Username already taken"
        )

    # Create auth user
    try:
        auth_res = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password
        })
        # Try to show common attributes
        try:
            print(f"-> user: {auth_res.user}")
            print(f"-> error: {getattr(auth_res, 'error', None)}")
            print(f"-> session: {auth_res.session}")
        except Exception:
            pass
        # Also write debug info to file for easier inspection
        try:
            import json
            debug = {
                'user': str(getattr(auth_res, 'user', None)),
                'error': str(getattr(auth_res, 'error', None)),
                'session': str(getattr(auth_res, 'session', None))
            }
            with open('signup_debug.log', 'a') as f:
                f.write(json.dumps(debug) + "\n")
        except Exception as e:
            print(f"Failed to write signup debug log: {e}")
    except Exception as e:
        print(f"Supabase sign_up exception: {e}")
        # Write exception to log for inspection
        try:
            with open('signup_exception.log', 'a') as f:
                f.write(str(e) + "\n")
        except Exception as log_e:
            print(f"Failed to write signup_exception.log: {log_e}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

    if auth_res.user is None:
        # If Supabase returned a known error payload, include it
        err_msg = getattr(auth_res, 'error', None) or "User with this email already exists"
        print(f"WARNING: sign_up response has no user, error: {err_msg}")
        raise HTTPException(
            status_code=409,
            detail=str(err_msg)
        )

    user_id = auth_res.user.id

    # Create user profile
    try:
        profile_result = supabase.table("users").insert({
            "id": user_id,
            "email": payload.email,
            "username": payload.username,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "is_verified": False
        }).execute()
        pass  # User profile created successfully
    except Exception as e:
        error_str = str(e)
        # Duplicate primary key means this email/account already exists
        if "23505" in error_str or "duplicate key" in error_str.lower():
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Please sign in instead."
            )
        raise HTTPException(
            status_code=500,
            detail="Account created but profile setup failed. Please contact support."
        )
    
    # Track login activity
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    session_id = auth_res.session.access_token if auth_res.session else ""
    
    track_login_activity(user_id, session_id, client_ip, user_agent)

    return {
        "success": True,
        "user": {
            "id": user_id,
            "email": payload.email,
            "username": payload.username,
            "first_name": payload.first_name,
            "last_name": payload.last_name
        },
        "session": auth_res.session
    }
    
# Login Api
@router.post("/login")
def login(payload: LoginRequest, request: Request):
    try:
        auth_res = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password
        })
        
        if not auth_res.user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
    except Exception as e:
        print(f"Login error details: {e}")
        
        # Parse Supabase auth errors for better UX
        error_msg = str(e).lower()
        if "invalid login credentials" in error_msg:
            raise HTTPException(
                status_code=401, 
                detail="Invalid email or password. Please check your credentials and try again."
            )
        elif "email not confirmed" in error_msg:
            raise HTTPException(
                status_code=401,
                detail="Please check your email and click the confirmation link before logging in."
            )
        elif "too many requests" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please wait a few minutes and try again."
            )
        else:
            # Generic fallback for unexpected errors
            raise HTTPException(
                status_code=500,
                detail="Login failed. Please try again or contact support if the problem persists."
            )
    
    # Update last active timestamp
    try:
        supabase.table("users").update({
            "last_active_at": "now()"
        }).eq("id", auth_res.user.id).execute()
    except Exception:
        pass  # Non-critical, don't block login
    
    # Track login activity
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    session_id = auth_res.session.access_token if auth_res.session else ""
    
    track_login_activity(auth_res.user.id, session_id, client_ip, user_agent)
    
    return {
        "success": True,
        "user": {
            "id": auth_res.user.id,
            "email": auth_res.user.email
        },
        "session": auth_res.session
    }
    
#Logout Api
@router.post("/logout")
def logout(
    payload: LogoutRequest,
    user=Depends(require_auth),
    request: Request = None
):
    supabase.auth.sign_out(payload.refresh_token)
    
    # Deactivate session in login_activity
    session_token = request.headers.get("Authorization", "").replace("Bearer ", "") if request else ""
    if session_token:
        deactivate_session(session_token)

    return {"success": True}


# Refresh token it will be called by frontend
@router.post("/refresh")
def refresh(payload: RefreshRequest):
    auth_res = supabase.auth.refresh_session(payload.refresh_token)
    
    if not auth_res.session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    return {
        "success": True,
        "session": auth_res.session
    }
    
    
#Forgot Password
@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    supabase.auth.reset_password_email(payload.email)
    
    return {
        "success": True,
        "message": "If email exists, password reset link has been sent"
    }
    

# Reset password 
@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    supabase.auth.update_user(
        payload.access_token,
        {"password": payload.new_password}
    )
    
    return {
        "success": True,
        "message": "Password updated successfully"
    }
    
    
@router.get("/me")
def me(user=Depends(require_auth)):
    return {
        "id": user.id,
        "email": user.email
    }

# Check username availability
@router.get("/check-username")
def check_username(username: str):
    print(f"DEBUG: /auth/check-username called with username: '{username}'")
    
    if not username:
        print("No username provided")
        raise HTTPException(status_code=400, detail="username query parameter required")
    
    if not username.strip():
        print("Empty username provided")
        raise HTTPException(status_code=400, detail="username cannot be empty")
        
    try:
        print(f"Calling check_username_availability for: '{username}'")
        available = check_username_availability(username)
        print(f"Username availability result: {available}")
        return {"available": available}
    except Exception as e:
        print(f"Unexpected error in /auth/check-username: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")