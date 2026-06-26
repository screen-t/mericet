from fastapi import APIRouter, HTTPException, Depends, Query
from app.middleware.auth import require_auth
from app.deps import get_follow_repo, get_user_repo
from app.repositories.protocols import FollowRepository

router = APIRouter(prefix="/follows", tags=["Follows"])


@router.post("/{target_user_id}")
def follow_user(
    target_user_id: str,
    user_id: str = Depends(require_auth),
    follow_repo: FollowRepository = Depends(get_follow_repo),
):
    """Follow a user (one-way)."""
    if target_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    if follow_repo.is_following(user_id, target_user_id):
        return {"message": "Already following"}
    follow_repo.follow(user_id, target_user_id)
    return {"message": "Followed"}


@router.delete("/{target_user_id}")
def unfollow_user(
    target_user_id: str,
    user_id: str = Depends(require_auth),
    follow_repo: FollowRepository = Depends(get_follow_repo),
):
    """Unfollow a user."""
    follow_repo.unfollow(user_id, target_user_id)
    return {"message": "Unfollowed"}


@router.get("/status/{target_user_id}")
def follow_status(
    target_user_id: str,
    user_id: str = Depends(require_auth),
    follow_repo: FollowRepository = Depends(get_follow_repo),
):
    """Check whether the current user follows target user."""
    return {"is_following": follow_repo.is_following(user_id, target_user_id)}


@router.get("/following")
def list_following(
    user_id: str = Depends(require_auth),
    follow_repo: FollowRepository = Depends(get_follow_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List users the current user follows."""
    ids = follow_repo.get_following_ids(user_id, limit, offset)
    if not ids:
        return []
    return user_repo.get_many_by_ids(ids, "id, username, first_name, last_name, avatar_url, headline")


@router.get("/followers")
def list_followers(
    user_id: str = Depends(require_auth),
    follow_repo: FollowRepository = Depends(get_follow_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List users who follow the current user."""
    ids = follow_repo.get_follower_ids(user_id, limit, offset)
    if not ids:
        return []
    return user_repo.get_many_by_ids(ids, "id, username, first_name, last_name, avatar_url, headline")
