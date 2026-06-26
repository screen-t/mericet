from fastapi import Request, HTTPException, Depends
from typing import Optional
from app.deps import get_auth_service


def require_auth(request: Request, auth=Depends(get_auth_service)):
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UnAuthorized")

    token = auth_header.replace("Bearer ", "")
    user_id = auth.validate_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user_id


def optional_auth(request: Request, auth=Depends(get_auth_service)) -> Optional[str]:
    """Returns user_id if valid token present, None otherwise."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")
    return auth.validate_token(token)
