from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional
from datetime import datetime, timezone
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.saves import FolderCreate, FolderUpdate, SaveToFolder

router = APIRouter(prefix="/saves", tags=["Saves"])


# ==================== FOLDER CRUD ====================

@router.post("/folders", status_code=201)
def create_folder(payload: FolderCreate, user_id: str = Depends(require_auth)):
    """Create a new save folder"""
    try:
        data = {
            "user_id": user_id,
            "folder_name": payload.folder_name,
            "description": payload.description,
            "color": payload.color or "#6366f1",
        }
        resp = supabase.table("save_folders").insert(data).execute()
        folder = resp.data[0]
        folder["post_count"] = 0
        return {"message": "Folder created", "data": folder}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/folders")
def get_folders(user_id: str = Depends(require_auth)):
    """List all folders for the current user, with post counts"""
    try:
        folders_resp = supabase.table("save_folders").select("*").eq("user_id", user_id).order("created_at").execute()
        folders = folders_resp.data or []

        if not folders:
            return []

        folder_ids = [f["id"] for f in folders]
        counts_resp = supabase.table("saved_posts").select("folder_id").eq("user_id", user_id).in_("folder_id", folder_ids).execute()

        count_map: dict = {}
        for row in (counts_resp.data or []):
            fid = row["folder_id"]
            count_map[fid] = count_map.get(fid, 0) + 1

        for folder in folders:
            folder["post_count"] = count_map.get(folder["id"], 0)

        return folders
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/folders/{folder_id}")
def update_folder(folder_id: str, payload: FolderUpdate, user_id: str = Depends(require_auth)):
    """Update a save folder's name, description, or color"""
    try:
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        resp = supabase.table("save_folders").update(update_data).eq("id", folder_id).eq("user_id", user_id).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Folder not found")
        return {"message": "Folder updated", "data": resp.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: str, user_id: str = Depends(require_auth)):
    """Delete a folder. Saved posts in that folder become unsorted (folder_id → NULL)."""
    try:
        folder = supabase.table("save_folders").select("id").eq("id", folder_id).eq("user_id", user_id).execute()
        if not folder.data:
            raise HTTPException(status_code=404, detail="Folder not found")
        supabase.table("save_folders").delete().eq("id", folder_id).execute()
        return {"message": "Folder deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== SAVE / UNSAVE ====================

@router.post("/posts/{post_id}")
def save_post_to_folder(
    post_id: str,
    payload: SaveToFolder = Body(default=SaveToFolder()),
    user_id: str = Depends(require_auth),
):
    """Save a post, optionally into a folder. If already saved, moves it to the new folder."""
    try:
        existing = supabase.table("saved_posts").select("post_id").eq("post_id", post_id).eq("user_id", user_id).execute()

        if existing.data:
            supabase.table("saved_posts").update({"folder_id": payload.folder_id}).eq("post_id", post_id).eq("user_id", user_id).execute()
            action = "moved to folder" if payload.folder_id else "removed from folder"
            return {"message": f"Post {action}"}

        supabase.table("saved_posts").insert({
            "post_id": post_id,
            "user_id": user_id,
            "folder_id": payload.folder_id,
        }).execute()
        return {"message": "Post saved"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/posts/{post_id}")
def unsave_post(post_id: str, user_id: str = Depends(require_auth)):
    """Completely remove a post from saved"""
    try:
        supabase.table("saved_posts").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
        return {"message": "Post unsaved"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== GET SAVED POSTS ====================

@router.get("/all")
def get_all_saved(
    user_id: str = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get all saved posts for the current user regardless of folder"""
    from app.routes.posts import bulk_enrich_posts
    try:
        saved = supabase.table("saved_posts").select("post_id").eq("user_id", user_id).execute()
        if not saved.data:
            return []
        post_ids = [s["post_id"] for s in saved.data]
        posts_resp = supabase.table("posts").select("*").in_("id", post_ids).limit(limit).execute()
        return bulk_enrich_posts(posts_resp.data or [], user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/unsorted")
def get_unsorted_saves(
    user_id: str = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get saved posts not assigned to any folder"""
    from app.routes.posts import bulk_enrich_posts
    try:
        saved = supabase.table("saved_posts").select("post_id").eq("user_id", user_id).is_("folder_id", None).execute()
        if not saved.data:
            return []
        post_ids = [s["post_id"] for s in saved.data]
        posts_resp = supabase.table("posts").select("*").in_("id", post_ids).execute()
        return bulk_enrich_posts(posts_resp.data or [], user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/folder/{folder_id}/posts")
def get_folder_posts(
    folder_id: str,
    user_id: str = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get posts inside a specific folder"""
    from app.routes.posts import bulk_enrich_posts
    try:
        folder = supabase.table("save_folders").select("*").eq("id", folder_id).eq("user_id", user_id).execute()
        if not folder.data:
            raise HTTPException(status_code=404, detail="Folder not found")

        saved = supabase.table("saved_posts").select("post_id").eq("user_id", user_id).eq("folder_id", folder_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        if not saved.data:
            return {"folder": folder.data[0], "posts": []}

        post_ids = [s["post_id"] for s in saved.data]
        posts_resp = supabase.table("posts").select("*").in_("id", post_ids).execute()
        enriched = bulk_enrich_posts(posts_resp.data or [], user_id)
        return {"folder": folder.data[0], "posts": enriched}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search")
def search_saved(
    q: str = Query(..., min_length=1),
    folder_id: Optional[str] = None,
    user_id: str = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
):
    """Full-text search within saved posts, optionally scoped to a folder"""
    from app.routes.posts import bulk_enrich_posts
    try:
        query = supabase.table("saved_posts").select("post_id").eq("user_id", user_id)
        if folder_id:
            query = query.eq("folder_id", folder_id)
        saved = query.execute()

        if not saved.data:
            return []

        post_ids = [s["post_id"] for s in saved.data]
        posts_resp = supabase.table("posts").select("*").in_("id", post_ids).ilike("content", f"%{q}%").limit(limit).execute()
        return bulk_enrich_posts(posts_resp.data or [], user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
