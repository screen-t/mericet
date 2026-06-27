from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional
from app.middleware.auth import require_auth
from app.deps import get_save_repo, get_post_repo, get_user_repo
from app.models.saves import FolderCreate, FolderUpdate, SaveToFolder

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
    for folder in folders:
        folder["post_count"] = counts.get(folder["id"], 0)
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
):
    action = save_repo.save_post(user_id, post_id, payload.folder_id)
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
    post_ids = save_repo.search_saved(user_id, q, limit, folder_id)
    if not post_ids:
        return []
    posts = post_repo.search(q, limit)
    saved_set = set(post_ids)
    posts = [p for p in posts if p["id"] in saved_set]
    return bulk_enrich_posts(posts, user_id, post_repo, user_repo)
