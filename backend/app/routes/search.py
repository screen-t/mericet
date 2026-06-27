from fastapi import APIRouter, HTTPException, Depends, Query
from app.middleware.auth import require_auth
from app.deps import get_user_repo, get_post_repo, get_message_repo, get_save_repo
from typing import List, Optional

router = APIRouter(prefix="/search", tags=["Search"])


def _enrich_posts_with_author(posts: List[dict], user_repo) -> List[dict]:
    if not posts:
        return []
    author_ids = list({p.get("author_id") for p in posts if p.get("author_id")})
    if not author_ids:
        return posts
    authors = user_repo.get_many_by_ids(author_ids, "id, username, first_name, last_name, avatar_url")
    author_map = {a["id"]: a for a in authors}
    for post in posts:
        post["author"] = author_map.get(post.get("author_id"))
    return posts


@router.get("/users")
def search_users(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: Optional[str] = Depends(require_auth),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=50),
):
    results = user_repo.search(q, limit)
    return {"results": results, "count": len(results)}


@router.get("/posts")
def search_posts(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: Optional[str] = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=50),
):
    results = post_repo.search(q, limit)
    enriched = _enrich_posts_with_author(results, user_repo)
    return {"results": enriched, "count": len(enriched)}


@router.get("/all")
def search_all(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: Optional[str] = Depends(require_auth),
    user_repo=Depends(get_user_repo),
    post_repo=Depends(get_post_repo),
    message_repo=Depends(get_message_repo),
    save_repo=Depends(get_save_repo),
    users_limit: int = Query(10, ge=1, le=50),
    posts_limit: int = Query(10, ge=1, le=50),
):
    users = user_repo.search(q, users_limit)
    posts = post_repo.search(q, posts_limit)
    enriched_posts = _enrich_posts_with_author(posts, user_repo)

    messages_results = []
    saved_results = []
    if user_id:
        conversation_ids = message_repo.get_user_conversation_ids(user_id)
        if conversation_ids:
            msgs = message_repo.search_messages(conversation_ids, q, 10)
            sender_ids = list({m.get("sender_id") for m in msgs if m.get("sender_id")})
            senders = user_repo.get_many_by_ids(sender_ids, "id, username, first_name, last_name, avatar_url, headline")
            sender_map = {u["id"]: u for u in senders}
            other_ids = set()
            for cid in conversation_ids:
                pids = message_repo.get_participant_ids(cid)
                for pid in pids:
                    if pid != user_id:
                        other_ids.add(pid)
            other_users = user_repo.get_many_by_ids(list(other_ids), "id, username, first_name, last_name, avatar_url, headline")
            other_map = {u["id"]: u for u in other_users}
            for m in msgs:
                m["sender"] = sender_map.get(m.get("sender_id"))
                cid = m.get("conversation_id")
                pids = message_repo.get_participant_ids(cid) if cid else []
                other_uid = next((p for p in pids if p != user_id), None)
                m["other_user"] = other_map.get(other_uid) if other_uid else None
            messages_results = msgs

        saved_post_ids = save_repo.get_saved_post_ids(user_id, 100, 0)
        if saved_post_ids:
            saved_posts = post_repo.search(q, 10)
            saved_set = set(saved_post_ids)
            saved_posts = [p for p in saved_posts if p["id"] in saved_set]
            saved_results = _enrich_posts_with_author(saved_posts, user_repo)

    return {
        "users": {"results": users, "count": len(users)},
        "posts": {"results": enriched_posts, "count": len(enriched_posts)},
        "messages": {"results": messages_results, "count": len(messages_results)},
        "saved": {"results": saved_results, "count": len(saved_results)},
    }


@router.get("/messages")
def search_messages(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: str = Depends(require_auth),
    message_repo=Depends(get_message_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=50),
):
    conversation_ids = message_repo.get_user_conversation_ids(user_id)
    if not conversation_ids:
        return {"results": [], "count": 0}
    msgs = message_repo.search_messages(conversation_ids, q, limit)
    sender_ids = list({m.get("sender_id") for m in msgs if m.get("sender_id")})
    senders = user_repo.get_many_by_ids(sender_ids, "id, username, first_name, last_name, avatar_url, headline")
    sender_map = {u["id"]: u for u in senders}
    for m in msgs:
        m["sender"] = sender_map.get(m.get("sender_id"))
    return {"results": msgs, "count": len(msgs)}


@router.get("/saved")
def search_saved(
    q: str = Query(..., min_length=1, max_length=100),
    user_id: str = Depends(require_auth),
    save_repo=Depends(get_save_repo),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=50),
):
    saved_post_ids = save_repo.get_saved_post_ids(user_id, 1000, 0)
    if not saved_post_ids:
        return {"results": [], "count": 0}
    posts = post_repo.search(q, limit)
    saved_set = set(saved_post_ids)
    posts = [p for p in posts if p["id"] in saved_set]
    enriched = _enrich_posts_with_author(posts, user_repo)
    return {"results": enriched, "count": len(enriched)}


@router.get("/suggestions")
def get_search_suggestions(
    q: str = Query(..., min_length=1, max_length=100),
    user_repo=Depends(get_user_repo),
    post_repo=Depends(get_post_repo),
    limit: int = Query(5, ge=1, le=10),
):
    users = user_repo.search(q, limit)
    suggestions = []
    for user in users:
        full_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        text = full_name or user.get("username") or ""
        if not text:
            continue
        suggestions.append({
            "type": "user", "text": text,
            "username": user.get("username"),
            "user_id": user.get("id"),
            "avatar_url": user.get("avatar_url"),
        })
    posts = post_repo.search(q, limit)
    for post in posts:
        content = (post.get("content") or "").strip()
        if not content:
            continue
        snippet = content[:80] + ("…" if len(content) > 80 else "")
        suggestions.append({"type": "post", "text": snippet, "post_id": post.get("id")})
    return {"suggestions": suggestions}


@router.get("/companies")
def search_companies(
    q: str = Query(..., min_length=1, max_length=100),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=50),
):
    companies = user_repo.search_companies(q, limit)
    results = [{"name": name} for name in companies]
    return {"results": results, "count": len(results)}


@router.get("/trending")
def get_trending(
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(10, ge=1, le=20),
):
    posts = post_repo.get_trending(7, limit)
    if not posts:
        posts = post_repo.get_feed("public", limit, 0)
    enriched = _enrich_posts_with_author(posts, user_repo)
    return {"trending": enriched}
