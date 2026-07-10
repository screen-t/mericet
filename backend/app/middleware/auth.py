from fastapi import Request, HTTPException, Depends
from typing import Optional
from app.deps import get_auth_service, get_user_repo
from app.lib.cache import TTLCache

_activity_throttle = TTLCache(default_ttl=60, max_size=500)


def _touch_activity(user_id: str):
    if _activity_throttle.get(user_id):
        return
    _activity_throttle.set(user_id, True)
    try:
        repo = get_user_repo()
        repo.update(user_id, {"last_active_at": "now()"})
    except Exception:
        pass


def require_auth(request: Request, auth=Depends(get_auth_service)):
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UnAuthorized")

    token = auth_header.replace("Bearer ", "")
    user_id = auth.validate_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    _touch_activity(user_id)
    return user_id


def optional_auth(request: Request, auth=Depends(get_auth_service)) -> Optional[str]:
    """Returns user_id if valid token present, None otherwise."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")
    return auth.validate_token(token)
