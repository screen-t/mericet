from fastapi import APIRouter, HTTPException, Depends, Query
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from typing import List, Optional

router = APIRouter(prefix="/search", tags=["Search"])


def _enrich_posts_with_author(posts: List[dict]) -> List[dict]:
    if not posts:
        return []
    author_ids = {p.get("author_id") for p in posts if p.get("author_id")}
    if not author_ids:
        return posts
    authors = supabase.table("users").select(
        "id, username, first_name, last_name, avatar_url"
    ).in_("id", list(author_ids)).execute()
    author_map = {a["id"]: a for a in (authors.data or [])}
    for post in posts:
        post["author"] = author_map.get(post.get("author_id"))
    return posts


def _get_other_user_by_conversation(conversation_ids: List[str], user_id: str) -> dict:
    if not conversation_ids:
        return {}
    participants = supabase.table("conversation_participants").select(
        "conversation_id, user_id"
    ).in_("conversation_id", conversation_ids).execute()
    other_by_conv: dict = {}
    other_ids = set()
    for row in (participants.data or []):
        cid = row.get("conversation_id")
        uid = row.get("user_id")
        if not cid or not uid or uid == user_id:
            continue
        other_by_conv[cid] = uid
        other_ids.add(uid)
    if not other_ids:
        return {}
    users = supabase.table("users").select(
        "id, username, first_name, last_name, avatar_url, headline"
    ).in_("id", list(other_ids)).execute()
    user_map = {u["id"]: u for u in (users.data or [])}
    return {cid: user_map.get(uid) for cid, uid in other_by_conv.items()}

@router.get("/users")
def search_users(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: Optional[str] = Depends(require_auth),
    limit: int = Query(20, ge=1, le=50)
):
    """Search for users by name, username, or headline"""
    try:
        # Search in multiple fields
        search_term = f"%{q}%"
        
        # Use ilike for case-insensitive search
        results = supabase.table("users").select(
            "id, username, first_name, last_name, avatar_url, headline, current_position, current_company, industry"
        ).or_(
            f"username.ilike.{search_term},first_name.ilike.{search_term},last_name.ilike.{search_term},headline.ilike.{search_term}"
        ).eq("is_active", True).limit(limit).execute()
        
        return {"results": results.data, "count": len(results.data)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/posts")
def search_posts(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: Optional[str] = Depends(require_auth),
    limit: int = Query(20, ge=1, le=50)
):
    """Search for posts by content"""
    try:
        search_term = f"%{q}%"
        
        results = supabase.table("posts").select("*").ilike("content", search_term).eq("is_published", True).eq("is_draft", False).eq("visibility", "public").order("created_at", desc=True).limit(limit).execute()
        
        enriched = _enrich_posts_with_author(results.data or [])
        return {"results": enriched, "count": len(enriched)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/all")
def search_all(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: Optional[str] = Depends(require_auth),
    users_limit: int = Query(10, ge=1, le=50),
    posts_limit: int = Query(10, ge=1, le=50)
):
    """Search across users, posts, and (if authed) messages/saved"""
    try:
        search_term = f"%{q}%"
        
        # Search users
        users = supabase.table("users").select(
            "id, username, first_name, last_name, avatar_url, headline, current_position, current_company"
        ).or_(
            f"username.ilike.{search_term},first_name.ilike.{search_term},last_name.ilike.{search_term},headline.ilike.{search_term}"
        ).eq("is_active", True).limit(users_limit).execute()
        
        # Search posts
        posts = supabase.table("posts").select("*").ilike("content", search_term).eq("is_published", True).eq("is_draft", False).eq("visibility", "public").order("created_at", desc=True).limit(posts_limit).execute()

        enriched_posts = _enrich_posts_with_author(posts.data or [])

        # If authenticated, also search messages + saved posts
        messages_results = []
        saved_results = []
        if user_id:
            # Messages
            convs = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()
            conversation_ids = list({c["conversation_id"] for c in (convs.data or []) if c.get("conversation_id")})
            if conversation_ids:
                msgs = supabase.table("messages").select(
                    "id, conversation_id, sender_id, content, created_at, edited_at"
                ).in_("conversation_id", conversation_ids).ilike("content", search_term).eq("is_deleted", False).order("created_at", desc=True).limit(10).execute()
                sender_ids = {m.get("sender_id") for m in (msgs.data or []) if m.get("sender_id")}
                senders = supabase.table("users").select(
                    "id, username, first_name, last_name, avatar_url, headline"
                ).in_("id", list(sender_ids)).execute() if sender_ids else None
                sender_map = {u["id"]: u for u in (senders.data or [])} if senders else {}
                other_by_conv = _get_other_user_by_conversation(conversation_ids, user_id)
                for m in (msgs.data or []):
                    m["sender"] = sender_map.get(m.get("sender_id"))
                    m["other_user"] = other_by_conv.get(m.get("conversation_id"))
                messages_results = msgs.data or []

            # Saved
            saved = supabase.table("saved_posts").select("post_id").eq("user_id", user_id).execute()
            post_ids = [s["post_id"] for s in (saved.data or []) if s.get("post_id")]
            if post_ids:
                saved_posts = supabase.table("posts").select("*").in_("id", post_ids).ilike("content", search_term).limit(10).execute()
                saved_results = _enrich_posts_with_author(saved_posts.data or [])

        return {
            "users": {"results": users.data, "count": len(users.data)},
            "posts": {"results": enriched_posts, "count": len(enriched_posts)},
            "messages": {"results": messages_results, "count": len(messages_results)},
            "saved": {"results": saved_results, "count": len(saved_results)}
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/messages")
def search_messages(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: str = Depends(require_auth),
    limit: int = Query(20, ge=1, le=50)
):
    """Search messages for the current user"""
    try:
        search_term = f"%{q}%"

        convs = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()
        conversation_ids = list({c["conversation_id"] for c in (convs.data or []) if c.get("conversation_id")})
        if not conversation_ids:
            return {"results": [], "count": 0}

        msgs = supabase.table("messages").select(
            "id, conversation_id, sender_id, content, created_at, edited_at"
        ).in_("conversation_id", conversation_ids).ilike("content", search_term).eq("is_deleted", False).order("created_at", desc=True).limit(limit).execute()

        sender_ids = {m.get("sender_id") for m in (msgs.data or []) if m.get("sender_id")}
        senders = supabase.table("users").select(
            "id, username, first_name, last_name, avatar_url, headline"
        ).in_("id", list(sender_ids)).execute() if sender_ids else None
        sender_map = {u["id"]: u for u in (senders.data or [])} if senders else {}

        other_by_conv = _get_other_user_by_conversation(conversation_ids, user_id)

        for m in (msgs.data or []):
            m["sender"] = sender_map.get(m.get("sender_id"))
            m["other_user"] = other_by_conv.get(m.get("conversation_id"))

        return {"results": msgs.data or [], "count": len(msgs.data or [])}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/saved")
def search_saved(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: str = Depends(require_auth),
    limit: int = Query(20, ge=1, le=50)
):
    """Search saved posts for the current user"""
    try:
        search_term = f"%{q}%"
        saved = supabase.table("saved_posts").select("post_id").eq("user_id", user_id).execute()
        post_ids = [s["post_id"] for s in (saved.data or []) if s.get("post_id")]
        if not post_ids:
            return {"results": [], "count": 0}
        posts = supabase.table("posts").select("*").in_("id", post_ids).ilike("content", search_term).limit(limit).execute()
        enriched = _enrich_posts_with_author(posts.data or [])
        return {"results": enriched, "count": len(enriched)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/suggestions")
def get_search_suggestions(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(5, ge=1, le=10)
):
    """Get search suggestions (autocomplete)"""
    try:
        search_term = f"{q}%"  # Prefix search for autocomplete

        # Get username and name suggestions
        users = supabase.table("users").select(
            "id, username, first_name, last_name, avatar_url"
        ).or_(
            f"username.ilike.{search_term},first_name.ilike.{search_term},last_name.ilike.{search_term}"
        ).eq("is_active", True).limit(limit).execute()

        suggestions = []
        for user in (users.data or []):
            full_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            text = full_name or user.get("username") or ""
            if not text:
                continue
            suggestions.append({
                "type": "user",
                "text": text,
                "username": user.get("username"),
                "user_id": user.get("id"),
                "avatar_url": user.get("avatar_url"),
            })

        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/trending")
def get_trending(limit: int = Query(10, ge=1, le=20)):
    """Get trending topics/posts (simplified version)"""
    try:
        # Get posts with most engagement in last 7 days
        # Simple version: most likes + comments + reposts
        posts = supabase.rpc("get_trending_posts", {"days_ago": 7, "result_limit": limit}).execute()
        
        # If RPC doesn't exist, fallback to simple query
        if not posts.data:
            posts = supabase.table("posts").select("*").eq("is_published", True).eq("is_draft", False).eq("visibility", "public").order("like_count", desc=True).order("comment_count", desc=True).limit(limit).execute()
        
        # Enrich with author info
        for post in posts.data:
            author = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", post["author_id"]).single().execute()
            post["author"] = author.data if author.data else None
        
        return {"trending": posts.data}
    except Exception as e:
        # Fallback if RPC doesn't exist
        try:
            posts = supabase.table("posts").select("*").eq("is_published", True).eq("is_draft", False).eq("visibility", "public").order("like_count", desc=True).limit(limit).execute()
            
            for post in posts.data:
                author = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", post["author_id"]).single().execute()
                post["author"] = author.data if author.data else None
            
            return {"trending": posts.data}
        except:
            raise HTTPException(status_code=400, detail="Error fetching trending posts")
