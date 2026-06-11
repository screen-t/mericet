from fastapi import Request, HTTPException
from app.lib.supabase import supabase
import logging
from typing import Optional
def require_auth(request: Request):
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UnAuthorized")
    
    token = auth_header.replace("Bearer ","")
    
    try:
        user_res = supabase.auth.get_user(token)
        
        if not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return user_res.user.id
    except HTTPException:
        raise  # Re-raise FastAPI exceptions immediately
    except Exception as e:
        logging.warning(f"Auth validation failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def optional_auth(request: Request) -> Optional[str]:
    """Optional auth dependency: returns user id if a valid bearer token is provided, otherwise None.

    This is intentionally tolerant: if no Authorization header is present it returns None. If a
    token is present but invalid, it also returns None (we don't raise) so public endpoints can
    still respond while adapting their output to the viewer when available.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res.user:
            return None
        return user_res.user.id
    except Exception:
        logging.debug("optional_auth: token validation failed or supabase error")
        return None


