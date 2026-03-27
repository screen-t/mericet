from fastapi import APIRouter, HTTPException, Depends, Query
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.post import (
    PostCreate, PostUpdate, PostResponse,
    CommentCreate, CommentUpdate, CommentResponse,
    PollVote
)
from typing import List, Optional

router = APIRouter(prefix="/posts", tags=["Posts"])

# Safety net: auto-create a users row for any auth user not yet in the DB.
# This handles accounts created before the frontend was fixed to call /auth/signup.
def ensure_user_exists(user_id: str):
    """Ensure a row exists in the users table for this auth user."""
    try:
        check = supabase.table("users").select("id").eq("id", user_id).execute()
        if check.data:
            return  # Already exists

        # Fetch real email from Supabase Auth (service-role bypasses RLS)
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        auth_user = auth_user_resp.user if auth_user_resp else None
        email = (auth_user.email if auth_user and auth_user.email
                 else f"{user_id[:8]}@placeholder.local")
        username = f"user_{user_id[:8]}"

        # Pull first/last name from user_metadata if present
        metadata = auth_user.user_metadata if auth_user else {}
        first_name = metadata.get("first_name") or "User"
        last_name = metadata.get("last_name") or username

        supabase.table("users").insert({
            "id": user_id,
            "email": email,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "is_verified": False,
        }).execute()
    except Exception as e:
        print(f"ensure_user_exists error for {user_id}: {e}")

# Helper function to enrich post with author and engagement data
def enrich_post(post: dict, user_id: Optional[str] = None):
    """Enrich post with author info, media, poll data, and user engagement status.
    Optimised: uses Supabase joins to reduce round-trips from ~6 queries/post to ~3.
    """
    try:
        post_id = post["id"]

        # 1) Author via join (no separate query)
        author_resp = supabase.table("users") \
            .select("id, username, first_name, last_name, avatar_url, headline") \
            .eq("id", post["author_id"]).single().execute()
        post["author"] = author_resp.data if author_resp.data else None

        # 2) Media (single query)
        media_resp = supabase.table("post_media").select("*").eq("post_id", post_id).execute()
        post["media"] = media_resp.data or []

        # 3) Poll with options in ONE nested query (avoids poll + options round-trip)
        if post.get("post_type") == "poll":
            poll_resp = supabase.table("post_polls") \
                .select("*, options:post_poll_options(*)") \
                .eq("post_id", post_id).maybe_single().execute()
            if poll_resp and poll_resp.data:
                poll_data = poll_resp.data
                # Sort options by display_order client-side (free, avoids extra order call)
                if poll_data.get("options"):
                    poll_data["options"].sort(key=lambda o: o.get("display_order", 0))
                # Check user vote
                if user_id:
                    vote_resp = supabase.table("post_poll_votes") \
                        .select("option_id") \
                        .eq("poll_id", poll_data["id"]).eq("user_id", user_id).execute()
                    poll_data["user_vote"] = vote_resp.data[0]["option_id"] if vote_resp.data else None
                post["poll"] = poll_data

        # Keep like_count in sync with source of truth.
        likes_resp = supabase.table("post_likes").select("id").eq("post_id", post_id).execute()
        post["like_count"] = len(likes_resp.data or [])

        # 4) Engagement: fire all three checks in parallel-ish (sequential but tiny payloads)
        if user_id:
            like_resp   = supabase.table("post_likes")  .select("id").eq("post_id", post_id).eq("user_id", user_id).execute()
            repost_resp = supabase.table("reposts")      .select("id").eq("post_id", post_id).eq("user_id", user_id).execute()
            saved_resp  = supabase.table("saved_posts") .select("id").eq("post_id", post_id).eq("user_id", user_id).execute()
            post["is_liked"]    = bool(like_resp.data)
            post["is_reposted"] = bool(repost_resp.data)
            post["is_saved"]    = bool(saved_resp.data)
        else:
            post.setdefault("is_liked",    False)
            post.setdefault("is_reposted", False)
            post.setdefault("is_saved",    False)

        return post
    except Exception as e:
        print(f"Error enriching post {post.get('id')}: {e}")
        return post


def bulk_enrich_posts(posts: list, user_id: Optional[str] = None) -> list:
    """Bulk-enrich a list of posts using O(1) batch queries instead of O(N) per-post calls.

    Query budget regardless of post count:
      1) authors      — SELECT ... WHERE id IN (...)
      2) media        — SELECT ... WHERE post_id IN (...)
      3) polls        — SELECT ... WHERE post_id IN (...)  (only when polls exist)
      4) poll options — SELECT ... WHERE poll_id IN (...)  (only when polls exist)
      5) is_liked     — SELECT post_id WHERE user_id = ? AND post_id IN (...)
      6) is_reposted  — same pattern
      7) is_saved     — same pattern
    Total: 4–7 queries for any number of posts.
    """
    if not posts:
        return posts

    post_ids    = [p["id"] for p in posts]
    author_ids  = list({p["author_id"] for p in posts})

    # 1) Authors
    authors_resp = supabase.table("users") \
        .select("id, username, first_name, last_name, avatar_url, headline") \
        .in_("id", author_ids).execute()
    authors_map = {a["id"]: a for a in (authors_resp.data or [])}

    # 2) Media
    media_resp = supabase.table("post_media").select("*").in_("post_id", post_ids).execute()
    media_map: dict = {}
    for m in (media_resp.data or []):
        media_map.setdefault(m["post_id"], []).append(m)

    # 3) Polls (only needed if any post is a poll type)
    poll_post_ids = [p["id"] for p in posts if p.get("post_type") == "poll"]
    polls_map: dict = {}
    if poll_post_ids:
        polls_resp = supabase.table("post_polls").select("*").in_("post_id", poll_post_ids).execute()
        polls_by_id: dict = {}
        for poll in (polls_resp.data or []):
            polls_map[poll["post_id"]] = poll
            polls_by_id[poll["id"]] = poll

        # 4) Poll options in one query
        if polls_by_id:
            options_resp = supabase.table("post_poll_options") \
                .select("*").in_("poll_id", list(polls_by_id.keys())) \
                .order("display_order").execute()
            for opt in (options_resp.data or []):
                polls_by_id[opt["poll_id"]].setdefault("options", []).append(opt)

        # User votes (if logged in)
        if user_id and polls_by_id:
            votes_resp = supabase.table("post_poll_votes") \
                .select("poll_id, option_id").eq("user_id", user_id) \
                .in_("poll_id", list(polls_by_id.keys())).execute()
            votes_map = {v["poll_id"]: v["option_id"] for v in (votes_resp.data or [])}
            for poll in polls_by_id.values():
                poll["user_vote"] = votes_map.get(poll["id"])

    # Exact like counts from source-of-truth likes table.
    likes_count_map: dict = {pid: 0 for pid in post_ids}
    likes_rows_resp = supabase.table("post_likes").select("post_id").in_("post_id", post_ids).execute()
    for row in (likes_rows_resp.data or []):
        pid = row.get("post_id")
        if pid in likes_count_map:
            likes_count_map[pid] += 1

    # 5-7) Engagement (3 small queries, keyed by post_id)
    liked_set:    set = set()
    reposted_set: set = set()
    saved_set:    set = set()
    if user_id:
        liked_resp    = supabase.table("post_likes")  .select("post_id").eq("user_id", user_id).in_("post_id", post_ids).execute()
        reposted_resp = supabase.table("reposts")     .select("post_id").eq("user_id", user_id).in_("post_id", post_ids).execute()
        saved_resp    = supabase.table("saved_posts") .select("post_id").eq("user_id", user_id).in_("post_id", post_ids).execute()
        liked_set    = {r["post_id"] for r in (liked_resp.data    or [])}
        reposted_set = {r["post_id"] for r in (reposted_resp.data or [])}
        saved_set    = {r["post_id"] for r in (saved_resp.data    or [])}

    # Assemble
    for post in posts:
        pid = post["id"]
        post["author"]      = authors_map.get(post["author_id"])
        post["media"]       = media_map.get(pid, [])
        post["poll"]        = polls_map.get(pid)
        post["like_count"]  = likes_count_map.get(pid, post.get("like_count", 0))
        post["is_liked"]    = pid in liked_set
        post["is_reposted"] = pid in reposted_set
        post["is_saved"]    = pid in saved_set

    return posts


# ==================== POST CRUD ====================

@router.post("", status_code=201)
def create_post(payload: PostCreate, user_id: str = Depends(require_auth)):
    """Create a new post"""
    ensure_user_exists(user_id)
    try:
        # Create post
        post_data = {
            "author_id": user_id,
            "content": payload.content,
            "post_type": payload.post_type.value,
            "visibility": payload.visibility.value,
            "scheduled_at": payload.scheduled_at.isoformat() if payload.scheduled_at else None,
            "is_draft": payload.is_draft,
            "is_published": not payload.is_draft and not payload.scheduled_at
        }
        
        post_response = supabase.table("posts").insert(post_data).execute()
        post = post_response.data[0]
        
        # Add media if provided
        if payload.media:
            media_data = [{
                "post_id": post["id"],
                "url": m.url,
                "media_type": m.media_type.value,
                "thumbnail_url": m.thumbnail_url
            } for m in payload.media]
            supabase.table("post_media").insert(media_data).execute()
        
        # Add poll if provided
        if payload.poll:
            poll_data = {
                "post_id": post["id"],
                "question": payload.poll.question,
                "ends_at": payload.poll.ends_at.isoformat() if payload.poll.ends_at else None
            }
            poll_response = supabase.table("post_polls").insert(poll_data).execute()
            poll_id = poll_response.data[0]["id"]
            
            # Add poll options
            options_data = [{
                "poll_id": poll_id,
                "option_text": opt.option_text,
                "display_order": opt.display_order,
                "vote_count": 0
            } for opt in payload.poll.options]
            supabase.table("post_poll_options").insert(options_data).execute()
        
        # Return enriched post
        enriched = enrich_post(post, user_id)
        return {"message": "Post created", "data": enriched}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[PostResponse])
def get_feed(
    user_id: str = Depends(require_auth),
    feed_type: str = Query("for_you", pattern="^(for_you|following)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get feed posts (for_you or following)"""
    try:
        if feed_type == "following":
            # Get posts from connections
            connections = supabase.table("connections").select("requester_id, receiver_id").or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}").eq("status", "accepted").execute()
            
            # Extract connected user IDs
            connected_ids = set()
            for conn in connections.data:
                if conn["requester_id"] == user_id:
                    connected_ids.add(conn["receiver_id"])
                else:
                    connected_ids.add(conn["requester_id"])
            
            if not connected_ids:
                return []
            
            # Get posts from connected users
            posts = supabase.table("posts").select("*").in_("author_id", list(connected_ids)).eq("is_published", True).eq("is_draft", False).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        else:
            # For You feed - all public posts
            posts = supabase.table("posts").select("*").eq("is_published", True).eq("is_draft", False).eq("visibility", "public").order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        # Bulk-enrich: 4-7 queries total regardless of post count
        return bulk_enrich_posts(posts.data, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: str, user_id: Optional[str] = Depends(require_auth)):
    """Get a single post by ID"""
    try:
        post = supabase.table("posts").select("*").eq("id", post_id).single().execute()
        if not post.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        enriched = enrich_post(post.data, user_id)
        return enriched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/user/{identifier}", response_model=List[PostResponse])
def get_user_posts(
    identifier: str,
    user_id: Optional[str] = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get posts by a specific user (accepts username or UUID)"""
    import re
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    try:
        if uuid_pattern.match(identifier):
            author_id = identifier
        else:
            user = supabase.table("users").select("id").eq("username", identifier).single().execute()
            if not user.data:
                raise HTTPException(status_code=404, detail="User not found")
            author_id = user.data["id"]

        # Get user's posts
        posts = supabase.table("posts").select("*").eq("author_id", author_id).eq("is_published", True).eq("is_draft", False).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        return bulk_enrich_posts(posts.data, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{post_id}")
def update_post(post_id: str, payload: PostUpdate, user_id: str = Depends(require_auth)):
    """Update a post"""
    try:
        # Verify ownership
        check = supabase.table("posts").select("author_id").eq("id", post_id).single().execute()
        if not check.data or check.data["author_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Allow media updates independently from post fields.
        fields_set = payload.model_fields_set if hasattr(payload, "model_fields_set") else getattr(payload, "__fields_set__", set())
        update_data = {k: v for k, v in payload.dict().items() if v is not None and k != "media"}
        media_provided = "media" in fields_set

        if not update_data and not media_provided:
            raise HTTPException(status_code=400, detail="No fields to update")

        if "visibility" in update_data and hasattr(update_data["visibility"], "value"):
            update_data["visibility"] = update_data["visibility"].value
        
        post_row = None
        if update_data:
            update_data["edited_at"] = "now()"
            response = supabase.table("posts").update(update_data).eq("id", post_id).execute()
            post_row = response.data[0]
        else:
            existing = supabase.table("posts").select("*").eq("id", post_id).single().execute()
            post_row = existing.data

        if media_provided:
            media_payload = payload.media or []
            supabase.table("post_media").delete().eq("post_id", post_id).execute()
            if media_payload:
                media_data = [{
                    "post_id": post_id,
                    "url": m.url,
                    "media_type": m.media_type.value,
                    "thumbnail_url": m.thumbnail_url,
                } for m in media_payload]
                supabase.table("post_media").insert(media_data).execute()

        enriched = enrich_post(post_row, user_id)
        return {"message": "Post updated", "data": enriched}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{post_id}")
def delete_post(post_id: str, user_id: str = Depends(require_auth)):
    """Delete a post"""
    try:
        # Verify ownership
        check = supabase.table("posts").select("author_id").eq("id", post_id).single().execute()
        if not check.data or check.data["author_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        supabase.table("posts").delete().eq("id", post_id).execute()
        return {"message": "Post deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== ENGAGEMENT ====================

@router.post("/{post_id}/like")
def like_post(post_id: str, user_id: str = Depends(require_auth)):
    """Like a post"""
    ensure_user_exists(user_id)
    try:
        # Insert like (ignore if already liked)
        supabase.table("post_likes").insert({"post_id": post_id, "user_id": user_id}).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Already liked")
        raise HTTPException(status_code=400, detail=str(e))
    try:
        # Recalculate exact count from source of truth — avoids silent RPC/RLS failures
        count_resp = supabase.table("post_likes").select("post_id", count="exact").eq("post_id", post_id).execute()
        exact_count = count_resp.count or 0
        supabase.table("posts").update({"like_count": exact_count}).eq("id", post_id).execute()
        return {"message": "Post liked", "like_count": exact_count}
    except Exception as e:
        # Like was recorded; count sync failed — non-fatal, return best-effort
        return {"message": "Post liked", "like_count": None}

@router.delete("/{post_id}/like")
def unlike_post(post_id: str, user_id: str = Depends(require_auth)):
    """Unlike a post"""
    try:
        supabase.table("post_likes").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        # Recalculate exact count from source of truth
        count_resp = supabase.table("post_likes").select("post_id", count="exact").eq("post_id", post_id).execute()
        exact_count = count_resp.count or 0
        supabase.table("posts").update({"like_count": exact_count}).eq("id", post_id).execute()
        return {"message": "Post unliked", "like_count": exact_count}
    except Exception as e:
        return {"message": "Post unliked", "like_count": None}

@router.post("/{post_id}/repost")
def repost(post_id: str, user_id: str = Depends(require_auth)):
    """Repost a post"""
    ensure_user_exists(user_id)
    try:
        supabase.table("reposts").insert({"post_id": post_id, "user_id": user_id}).execute()
        
        # Increment repost count
        supabase.rpc("increment_post_reposts", {"post_id": post_id}).execute()
        
        return {"message": "Post reposted"}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Already reposted")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{post_id}/repost")
def unrepost(post_id: str, user_id: str = Depends(require_auth)):
    """Remove repost"""
    try:
        supabase.table("reposts").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
        
        # Decrement repost count
        supabase.rpc("decrement_post_reposts", {"post_id": post_id}).execute()
        
        return {"message": "Repost removed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{post_id}/save")
def save_post(post_id: str, user_id: str = Depends(require_auth)):
    """Save a post"""
    ensure_user_exists(user_id)
    try:
        supabase.table("saved_posts").insert({"post_id": post_id, "user_id": user_id}).execute()
        return {"message": "Post saved"}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Already saved")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{post_id}/save")
def unsave_post(post_id: str, user_id: str = Depends(require_auth)):
    """Unsave a post"""
    try:
        supabase.table("saved_posts").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
        return {"message": "Post unsaved"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/saved/all", response_model=List[PostResponse])
def get_saved_posts(
    user_id: str = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get user's saved posts"""
    try:
        saved = supabase.table("saved_posts").select("post_id").eq("user_id", user_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        if not saved.data:
            return []
        
        post_ids = [s["post_id"] for s in saved.data]
        posts = supabase.table("posts").select("*").in_("id", post_ids).execute()

        return bulk_enrich_posts(posts.data, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== COMMENTS ====================

@router.get("/{post_id}/comments", response_model=List[CommentResponse])
def get_comments(
    post_id: str,
    user_id: Optional[str] = Depends(require_auth),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get comments for a post. Optimised: author join + batch likes in 2 queries total."""
    try:
        # 1) Comments with author joined — eliminates N author round-trips
        comments = supabase.table("comments") \
            .select("*, author:author_id(id, username, first_name, last_name, avatar_url)") \
            .eq("post_id", post_id) \
            .is_("parent_comment_id", "null") \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()

        if not comments.data:
            return []

        # 2) Batch-check which comments the current user liked — 1 query for all
        if user_id:
            comment_ids = [c["id"] for c in comments.data]
            liked_resp = supabase.table("comment_likes") \
                .select("comment_id") \
                .eq("user_id", user_id) \
                .in_("comment_id", comment_ids) \
                .execute()
            liked_set = {r["comment_id"] for r in (liked_resp.data or [])}
            for comment in comments.data:
                comment["is_liked"] = comment["id"] in liked_set
        else:
            for comment in comments.data:
                comment["is_liked"] = False

        return comments.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{post_id}/comments")
def create_comment(post_id: str, payload: CommentCreate, user_id: str = Depends(require_auth)):
    """Add a comment to a post"""
    ensure_user_exists(user_id)
    try:
        comment_data = {
            "post_id": post_id,
            "author_id": user_id,
            "content": payload.content,
            "parent_comment_id": payload.parent_comment_id
        }
        
        comment = supabase.table("comments").insert(comment_data).execute()
        
        # Increment comment count on post
        supabase.rpc("increment_post_comments", {"post_id": post_id}).execute()
        
        # Get author info
        author = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", user_id).single().execute()
        comment.data[0]["author"] = author.data
        
        return {"message": "Comment added", "data": comment.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router. put("/comments/{comment_id}")
def update_comment(comment_id: str, payload: CommentUpdate, user_id: str = Depends(require_auth)):
    """Update a comment"""
    try:
        # Verify ownership
        check = supabase.table("comments").select("author_id").eq("id", comment_id).single().execute()
        if not check.data or check.data["author_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        response = supabase.table("comments").update({"content": payload.content}).eq("id", comment_id).execute()
        return {"message": "Comment updated", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: str, user_id: str = Depends(require_auth)):
    """Delete a comment"""
    try:
        # Verify ownership
        comment = supabase.table("comments").select("author_id, post_id").eq("id", comment_id).single().execute()
        if not comment.data or comment.data["author_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        supabase.table("comments").delete().eq("id", comment_id).execute()
        
        # Decrement comment count
        supabase.rpc("decrement_post_comments", {"post_id": comment.data["post_id"]}).execute()
        
        return {"message": "Comment deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== POLLS ====================

@router.post("/{post_id}/poll/vote")
def vote_on_poll(post_id: str, payload: PollVote, user_id: str = Depends(require_auth)):
    """Vote on a poll"""
    try:
        # Get poll_id from post
        poll = supabase.table("post_polls").select("id").eq("post_id", post_id).single().execute()
        if not poll.data:
            raise HTTPException(status_code=404, detail="Poll not found")
        
        poll_id = poll.data["id"]
        
        # Check if user already voted
        existing = supabase.table("post_poll_votes").select("*").eq("poll_id", poll_id).eq("user_id", user_id).execute()
        
        if existing.data:
            # Update vote
            old_option_id = existing.data[0]["option_id"]
            supabase.table("post_poll_votes").update({"option_id": payload.option_id}).eq("poll_id", poll_id).eq("user_id", user_id).execute()
            
            # Decrement old option, increment new option
            supabase.rpc("decrement_poll_option_votes", {"option_id": old_option_id}).execute()
            supabase.rpc("increment_poll_option_votes", {"option_id": payload.option_id}).execute()
        else:
            # New vote
            supabase.table("post_poll_votes").insert({
                "poll_id": poll_id,
                "option_id": payload.option_id,
                "user_id": user_id
            }).execute()
            
            # Increment vote count
            supabase.rpc("increment_poll_option_votes", {"option_id": payload.option_id}).execute()
        
        return {"message": "Vote recorded"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
