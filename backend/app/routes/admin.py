from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import require_auth
from app.deps import get_user_repo
from app.routes.reports import _moderator_email_allowlist, _moderator_username_allowlist

router = APIRouter(prefix="/admin", tags=["Admin"])

VALID_ROLES = {"user", "moderator", "admin"}


def _require_admin(user_id: str, user_repo) -> dict:
    profile = user_repo.get_by_id(user_id, "id, username, email, role")
    if not profile:
        raise HTTPException(status_code=403, detail="Admin access required")

    if (profile.get("role") or "user") == "admin":
        return profile

    # Fallback bootstrap path — same env allowlist the moderator check trusts,
    # so nobody using the old system is ever locked out of managing roles.
    email = (profile.get("email") or "").strip().lower()
    username = (profile.get("username") or "").strip().lower()
    if email and email in _moderator_email_allowlist():
        return profile
    if username and username in _moderator_username_allowlist():
        return profile

    raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/status")
def admin_status(
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
):
    try:
        _require_admin(user_id, user_repo)
        return {"is_admin": True}
    except HTTPException:
        return {"is_admin": False}


@router.get("/moderators")
def list_moderators(
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
):
    _require_admin(user_id, user_repo)
    return user_repo.get_by_role(["moderator", "admin"])


@router.patch("/users/{target_user_id}/role")
def update_user_role(
    target_user_id: str,
    payload: dict,
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
):
    _require_admin(user_id, user_repo)

    role = payload.get("role")
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    if target_user_id == user_id:
        raise HTTPException(status_code=400, detail="Use another admin account to change your own role")

    updated = user_repo.update(target_user_id, {"role": role})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated
