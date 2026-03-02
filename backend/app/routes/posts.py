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
    """Enrich post with author info, media, poll data, and user engagement status"""
    try:
        # Get author info
        author = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").eq("id", post["author_id"]).single().execute()
        post["author"] = author.data if author.data else None
        
        # Get media
        media = supabase.table("post_media").select("*").eq("post_id", post["id"]).execute()
        post["media"] = media.data if media.data else []
        
        # Get poll if exists
        if post.get("post_type") == "poll":
            poll = supabase.table("post_polls").select("*").eq("post_id", post["id"]).single().execute()
            if poll.data:
                options = supabase.table("post_poll_options").select("*").eq("poll_id", poll.data["id"]).order("display_order").execute()
                poll.data["options"] = options.data if options.data else []
                
                # Check if user voted
                if user_id:
                    vote = supabase.table("post_poll_votes").select("option_id").eq("poll_id", poll.data["id"]).eq("user_id", user_id).execute()
                    poll.data["user_vote"] = vote.data[0]["option_id"] if vote.data else None
                
                post["poll"] = poll.data
        
        # Check user engagement if user_id provided
        if user_id:
            # Check if liked
            like = supabase.table("post_likes").select("*").eq("post_id", post["id"]).eq("user_id", user_id).execute()
            post["is_liked"] = len(like.data) > 0
            
            # Check if reposted
            repost = supabase.table("reposts").select("*").eq("post_id", post["id"]).eq("user_id", user_id).execute()
            post["is_reposted"] = len(repost.data) > 0
            
            # Check if saved
            saved = supabase.table("saved_posts").select("*").eq("post_id", post["id"]).eq("user_id", user_id).execute()
            post["is_saved"] = len(saved.data) > 0
        
        return post
    except Exception as e:
        print(f"Error enriching post: {e}")
        return post

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
        
        # Enrich each post
        enriched_posts = [enrich_post(post, user_id) for post in posts.data]
        return enriched_posts
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

@router.get("/user/{username}", response_model=List[PostResponse])
def get_user_posts(
    username: str,
    user_id: Optional[str] = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get posts by a specific user"""
    try:
        # Get user ID from username
        user = supabase.table("users").select("id").eq("username", username).single().execute()
        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's posts
        posts = supabase.table("posts").select("*").eq("author_id", user.data["id"]).eq("is_published", True).eq("is_draft", False).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        enriched_posts = [enrich_post(post, user_id) for post in posts.data]
        return enriched_posts
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
        
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_data["edited_at"] = "now()"
        
        response = supabase.table("posts").update(update_data).eq("id", post_id).execute()
        enriched = enrich_post(response.data[0], user_id)
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
        # Insert like
        supabase.table("post_likes").insert({"post_id": post_id, "user_id": user_id}).execute()
        
        # Increment like count
        supabase.rpc("increment_post_likes", {"post_id": post_id}).execute()
        
        return {"message": "Post liked"}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Already liked")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{post_id}/like")
def unlike_post(post_id: str, user_id: str = Depends(require_auth)):
    """Unlike a post"""
    try:
        supabase.table("post_likes").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
        
        # Decrement like count
        supabase.rpc("decrement_post_likes", {"post_id": post_id}).execute()
        
        return {"message": "Post unliked"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
        
        enriched_posts = [enrich_post(post, user_id) for post in posts.data]
        return enriched_posts
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
    """Get comments for a post"""
    try:
        comments = supabase.table("comments").select("*").eq("post_id", post_id).is_("parent_comment_id", "null").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        # Enrich with author info
        for comment in comments.data:
            author = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", comment["author_id"]).single().execute()
            comment["author"] = author.data if author.data else None
            
            # Check if user liked
            if user_id:
                like = supabase.table("comment_likes").select("*").eq("comment_id", comment["id"]).eq("user_id", user_id).execute()
                comment["is_liked"] = len(like.data) > 0
        
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
