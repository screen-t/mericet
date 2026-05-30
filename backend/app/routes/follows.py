from fastapi import APIRouter, HTTPException, Depends, Query
from app.lib.supabase import supabase
from app.middleware.auth import require_auth

router = APIRouter(prefix="/follows", tags=["Follows"])

@router.post("/{target_user_id}")
def follow_user(target_user_id: str, user_id: str = Depends(require_auth)):
    """Follow a user (one-way)."""
    try:
        if target_user_id == user_id:
            raise HTTPException(status_code=400, detail="Cannot follow yourself")

        existing = supabase.table("follows").select("id").eq("follower_id", user_id).eq("following_id", target_user_id).execute()
        if existing.data:
            return {"message": "Already following"}

        supabase.table("follows").insert({
            "follower_id": user_id,
            "following_id": target_user_id,
        }).execute()
        return {"message": "Followed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{target_user_id}")
def unfollow_user(target_user_id: str, user_id: str = Depends(require_auth)):
    """Unfollow a user."""
    try:
        supabase.table("follows").delete().eq("follower_id", user_id).eq("following_id", target_user_id).execute()
        return {"message": "Unfollowed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status/{target_user_id}")
def follow_status(target_user_id: str, user_id: str = Depends(require_auth)):
    """Check whether the current user follows target user."""
    try:
        existing = supabase.table("follows").select("id").eq("follower_id", user_id).eq("following_id", target_user_id).execute()
        return {"is_following": bool(existing.data)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/following")
def list_following(
    user_id: str = Depends(require_auth),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """List users the current user follows."""
    try:
        rows = supabase.table("follows").select("following_id").eq("follower_id", user_id).range(offset, offset + limit - 1).execute()
        ids = [r["following_id"] for r in (rows.data or [])]
        if not ids:
            return []
        users = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", ids).execute()
        return users.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/followers")
def list_followers(
    user_id: str = Depends(require_auth),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """List users who follow the current user."""
    try:
        rows = supabase.table("follows").select("follower_id").eq("following_id", user_id).range(offset, offset + limit - 1).execute()
        ids = [r["follower_id"] for r in (rows.data or [])]
        if not ids:
            return []
        users = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", ids).execute()
        return users.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
