from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional
from app.middleware.auth import require_auth, optional_auth
from app.deps import get_save_repo, get_post_repo, get_user_repo
from app.models.saves import FolderCreate, FolderUpdate, SaveToFolder, FolderPublicToggle

router = APIRouter(prefix="/saves", tags=["Saves"])


# ==================== FOLDER CRUD ====================

@router.post("/folders", status_code=201)
def create_folder(
    payload: FolderCreate,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    data = {
        "user_id": user_id,
        "folder_name": payload.folder_name,
        "description": payload.description,
        "color": payload.color or "#6366f1",
    }
    folder = save_repo.create_folder(data)
    folder["post_count"] = 0
    return {"message": "Folder created", "data": folder}


@router.get("/folders")
def get_folders(
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    folders = save_repo.get_folders(user_id)
    if not folders:
        return []
    folder_ids = [f["id"] for f in folders]
    counts = save_repo.get_folder_post_counts(user_id, folder_ids)
    thumbnails = save_repo.get_folder_thumbnails(folder_ids)
    for folder in folders:
        folder["post_count"] = counts.get(folder["id"], 0)
        folder["thumbnail_url"] = thumbnails.get(folder["id"])
    return folders


@router.put("/folders/{folder_id}")
def update_folder(
    folder_id: str,
    payload: FolderUpdate,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = save_repo.update_folder(folder_id, user_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"message": "Folder updated", "data": updated}


@router.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: str,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    folder = save_repo.get_folder(folder_id, user_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    save_repo.delete_folder(folder_id, user_id)
    return {"message": "Folder deleted"}


# ==================== SAVE / UNSAVE ====================

@router.post("/posts/{post_id}")
def save_post_to_folder(
    post_id: str,
    payload: SaveToFolder = Body(default=SaveToFolder()),
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
    user_repo=Depends(get_user_repo),
):
    action = save_repo.save_post(user_id, post_id, payload.folder_id)

    # Notify folder followers when a new post is added to a public folder
    if payload.folder_id and action in ("saved", "moved"):
        try:
            folder = save_repo.get_folder(payload.folder_id, user_id)
            if folder and folder.get("is_public"):
                from app.routes.notifications import create_notification
                actor = user_repo.get_by_id(user_id, "first_name, last_name")
                actor_name = f"{(actor or {}).get('first_name', '')} {(actor or {}).get('last_name', '')}".strip() or "Someone"
                folder_name = folder.get("folder_name", "a folder")
                share_token = folder.get("share_token")
                for follower_id in save_repo.get_folder_follower_ids(payload.folder_id):
                    create_notification(
                        user_id=follower_id,
                        notification_type="folder_post",
                        message=f"{actor_name} added a new post to \"{folder_name}\"",
                        actor_id=user_id,
                        link=f"/collections/{share_token}",
                    )
        except Exception as e:
            print(f"Error sending folder notifications: {e}")

    messages = {"saved": "Post saved", "moved": "Post moved to folder",
                "removed_from_folder": "Post removed from folder"}
    return {"message": messages.get(action, "Post saved")}


@router.delete("/posts/{post_id}")
def unsave_post(
    post_id: str,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    save_repo.unsave_post(user_id, post_id)
    return {"message": "Post unsaved"}


# ==================== GET SAVED POSTS ====================

@router.get("/all")
def get_all_saved(
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    from app.routes.posts import bulk_enrich_posts
    post_ids = save_repo.get_saved_post_ids(user_id, limit, offset)
    if not post_ids:
        return []
    posts = post_repo.get_by_ids(post_ids)
    return bulk_enrich_posts(posts, user_id, post_repo, user_repo)


@router.get("/unsorted")
def get_unsorted_saves(
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    from app.routes.posts import bulk_enrich_posts
    post_ids = save_repo.get_unsorted_post_ids(user_id, limit, offset)
    if not post_ids:
        return []
    posts = post_repo.get_by_ids(post_ids)
    return bulk_enrich_posts(posts, user_id, post_repo, user_repo)


@router.get("/folder/{folder_id}/posts")
def get_folder_posts(
    folder_id: str,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    from app.routes.posts import bulk_enrich_posts
    folder = save_repo.get_folder(folder_id, user_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    post_ids = save_repo.get_folder_post_ids(folder_id, user_id, limit, offset)
    if not post_ids:
        return {"folder": folder, "posts": []}
    posts = post_repo.get_by_ids(post_ids)
    enriched = bulk_enrich_posts(posts, user_id, post_repo, user_repo)
    return {"folder": folder, "posts": enriched}


# ==================== PUBLIC FOLDERS ====================

@router.put("/folders/{folder_id}/public")
def toggle_folder_public(
    folder_id: str,
    payload: FolderPublicToggle,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    updated = save_repo.toggle_folder_public(folder_id, user_id, payload.is_public)
    if not updated:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"message": "Updated", "data": updated}


@router.get("/public/{share_token}")
def get_public_folder(
    share_token: str,
    user_id: Optional[str] = Depends(optional_auth),
    save_repo=Depends(get_save_repo),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    from app.routes.posts import bulk_enrich_posts
    folder = save_repo.get_public_folder_by_token(share_token)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found or not public")
    owner = user_repo.get_by_id(folder["user_id"],
                                "id, first_name, last_name, username, avatar_url, headline")
    follower_count = save_repo.get_folder_follower_count(folder["id"])
    is_following = (save_repo.is_following_folder(user_id, folder["id"])
                    if user_id else False)
    post_ids = save_repo.get_public_folder_post_ids(folder["id"], limit, offset)
    posts = post_repo.get_by_ids(post_ids) if post_ids else []
    enriched = bulk_enrich_posts(posts, user_id, post_repo, user_repo) if posts else []
    return {
        "folder": {**folder, "follower_count": follower_count,
                   "post_count": save_repo.get_folder_post_counts_any([folder["id"]]).get(folder["id"], 0)},
        "owner": owner,
        "posts": enriched,
        "is_following": is_following,
    }


# ==================== FOLDER FOLLOWS ====================

@router.post("/folders/{folder_id}/follow")
def follow_folder(
    folder_id: str,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    folder = save_repo.get_any_folder(folder_id)
    if not folder or not folder.get("is_public"):
        raise HTTPException(status_code=404, detail="Folder not found or not public")
    if folder["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="You cannot follow your own folder")
    try:
        save_repo.follow_folder(user_id, folder_id)
    except Exception:
        pass  # already following — treat as idempotent
    return {"message": "Following folder"}


@router.delete("/folders/{folder_id}/follow")
def unfollow_folder(
    folder_id: str,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
):
    save_repo.unfollow_folder(user_id, folder_id)
    return {"message": "Unfollowed"}


@router.get("/following")
def get_following_folders(
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
    user_repo=Depends(get_user_repo),
):
    folders = save_repo.get_following_folders(user_id)
    if not folders:
        return []
    folder_ids = [f["id"] for f in folders]
    counts = save_repo.get_folder_post_counts_any(folder_ids)
    thumbnails = save_repo.get_folder_thumbnails(folder_ids)
    owner_ids = list({f["user_id"] for f in folders})
    owners_list = user_repo.get_by_ids(owner_ids)
    owners = {u["id"]: u for u in owners_list}
    return [
        {
            **folder,
            "post_count": counts.get(folder["id"], 0),
            "thumbnail_url": thumbnails.get(folder["id"]),
            "owner": owners.get(folder["user_id"]),
            "is_following": True,
        }
        for folder in folders
    ]


# ==================== SEARCH ====================

@router.get("/search")
def search_saved(
    q: str = Query(..., min_length=1),
    folder_id: Optional[str] = None,
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=100),
):
    from app.routes.posts import bulk_enrich_posts
    # Fetch all saved post IDs (scoped to folder if given) — no text filter yet
    post_ids = save_repo.search_saved(user_id, q, limit=200, folder_id=folder_id)
    if not post_ids:
        return []
    # Fetch the actual posts, enrich with author data, then filter in Python
    # so we can match on content OR author first/last name
    posts = post_repo.get_by_ids(post_ids)
    enriched = bulk_enrich_posts(posts, user_id, post_repo, user_repo)
    q_lower = q.lower()
    results = [
        p for p in enriched
        if q_lower in (p.get("content") or "").lower()
        or q_lower in (p.get("author", {}).get("first_name") or "").lower()
        or q_lower in (p.get("author", {}).get("last_name") or "").lower()
        or q_lower in (p.get("author", {}).get("username") or "").lower()
    ]
    return results[:limit]
