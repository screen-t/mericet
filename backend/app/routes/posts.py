from fastapi import APIRouter, HTTPException, Depends, Query, Request
from app.middleware.auth import require_auth, optional_auth
from app.deps import get_post_repo, get_user_repo, get_auth_service, get_follow_repo
from app.middleware.rate_limit import limiter, WRITE_LIMIT
from app.models.post import (
    PostCreate, PostUpdate, PostResponse,
    CommentCreate, CommentUpdate, CommentResponse,
    PollVote
)
from typing import List, Optional
import re

router = APIRouter(prefix="/posts", tags=["Posts"])

_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


def enrich_post(post: dict, user_id: Optional[str], post_repo, user_repo):
    try:
        post_id = post["id"]
        author = user_repo.get_by_id(
            post["author_id"],
            "id, username, first_name, last_name, avatar_url, headline",
        )
        post["author"] = author
        post["media"] = post_repo.get_media(post_id)

        if post.get("post_type") == "poll":
            poll = post_repo.get_poll_by_post(post_id)
            if poll and user_id:
                poll["user_vote"] = post_repo.get_poll_user_vote(poll["id"], user_id)
            if poll:
                post["poll"] = poll

        post["like_count"] = post_repo.count_likes(post_id)
        post["comment_count"] = post_repo.count_comments(post_id)

        if user_id:
            post["is_liked"] = bool(post_repo.get_liked_post_ids(user_id, [post_id]))
            post["is_reposted"] = bool(post_repo.get_reposted_post_ids(user_id, [post_id]))
            post["is_saved"] = bool(post_repo.get_saved_post_ids(user_id, [post_id]))
        else:
            post.setdefault("is_liked", False)
            post.setdefault("is_reposted", False)
            post.setdefault("is_saved", False)

        return post
    except Exception as e:
        print(f"Error enriching post {post.get('id')}: {e}")
        return post


def bulk_enrich_posts(posts: list, user_id: Optional[str] = None,
                      post_repo=None, user_repo=None) -> list:
    if not posts:
        return posts

    if post_repo is None:
        from app.deps import get_post_repo, get_user_repo
        post_repo = get_post_repo()
        user_repo = get_user_repo()

    post_ids = [p["id"] for p in posts]
    author_ids = list({p["author_id"] for p in posts})

    authors = user_repo.get_many_by_ids(author_ids, "id, username, first_name, last_name, avatar_url, headline")
    authors_map = {a["id"]: a for a in authors}

    media_map = post_repo.get_media_bulk(post_ids)

    poll_post_ids = [p["id"] for p in posts if p.get("post_type") == "poll"]
    polls_map: dict = {}
    if poll_post_ids:
        polls_map = post_repo.get_polls_bulk(poll_post_ids)
        if user_id:
            poll_ids = [p["id"] for p in polls_map.values() if "id" in p]
            if poll_ids:
                votes = post_repo.get_poll_user_votes_bulk(poll_ids, user_id)
                for poll in polls_map.values():
                    poll["user_vote"] = votes.get(poll.get("id"))

    like_counts = post_repo.get_like_counts(post_ids)
    comment_counts = post_repo.get_comment_counts(post_ids)

    liked_set: set = set()
    reposted_set: set = set()
    saved_set: set = set()
    if user_id:
        liked_set = post_repo.get_liked_post_ids(user_id, post_ids)
        reposted_set = post_repo.get_reposted_post_ids(user_id, post_ids)
        saved_set = post_repo.get_saved_post_ids(user_id, post_ids)

    for post in posts:
        pid = post["id"]
        post["author"] = authors_map.get(post["author_id"])
        post["media"] = media_map.get(pid, [])
        post["poll"] = polls_map.get(pid)
        post["like_count"] = like_counts.get(pid, post.get("like_count", 0))
        post["comment_count"] = comment_counts.get(pid, post.get("comment_count", 0))
        post["is_liked"] = pid in liked_set
        post["is_reposted"] = pid in reposted_set
        post["is_saved"] = pid in saved_set

    return posts


# ==================== POST CRUD ====================

@router.post("", status_code=201)
@limiter.limit(WRITE_LIMIT)
def create_post(
    request: Request,
    payload: PostCreate,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    auth_service=Depends(get_auth_service),
):
    from app.routes.profile import _ensure_user_exists
    _ensure_user_exists(user_id, user_repo, auth_service)

    post_data = {
        "author_id": user_id,
        "content": payload.content,
        "post_type": payload.post_type.value,
        "visibility": payload.visibility.value,
        "scheduled_at": payload.scheduled_at.isoformat() if payload.scheduled_at else None,
        "is_draft": payload.is_draft,
        "is_published": not payload.is_draft and not payload.scheduled_at,
    }
    post = post_repo.create(post_data)

    if payload.media:
        media_data = [{
            "post_id": post["id"], "url": m.url,
            "media_type": m.media_type.value, "thumbnail_url": m.thumbnail_url,
        } for m in payload.media]
        post_repo.insert_media(media_data)

    if payload.poll:
        poll = post_repo.create_poll({
            "post_id": post["id"], "question": payload.poll.question,
            "ends_at": payload.poll.ends_at.isoformat() if payload.poll.ends_at else None,
        })
        options_data = [{
            "poll_id": poll["id"], "option_text": opt.option_text,
            "display_order": opt.display_order, "vote_count": 0,
        } for opt in payload.poll.options]
        post_repo.create_poll_options(options_data)

    enriched = enrich_post(post, user_id, post_repo, user_repo)
    return {"message": "Post created", "data": enriched}


@router.get("", response_model=List[PostResponse])
def get_feed(
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    follow_repo=Depends(get_follow_repo),
    feed_type: str = Query("for_you", pattern="^(for_you|following)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    if feed_type == "following":
        from app.deps import get_connection_repo
        conn_repo = get_connection_repo()
        following_ids = set(follow_repo.get_following_ids(user_id, 1000, 0))
        connected_ids = set(conn_repo.get_connected_ids(user_id))
        all_ids = list(following_ids | connected_ids)
        if not all_ids:
            return []
        posts = post_repo.get_by_author_ids(all_ids, limit, offset)
    else:
        posts = post_repo.get_feed("public", limit, offset)
    return bulk_enrich_posts(posts, user_id, post_repo, user_repo)


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: str,
    user_id: Optional[str] = Depends(optional_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
):
    post = post_repo.get_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return enrich_post(post, user_id, post_repo, user_repo)


@router.get("/user/{identifier}", response_model=List[PostResponse])
def get_user_posts(
    identifier: str,
    user_id: Optional[str] = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    if _UUID_RE.match(identifier):
        author_id = identifier
    else:
        user = user_repo.get_by_username(identifier)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        author_id = user["id"]
    posts = post_repo.get_by_author(author_id, limit, offset)
    return bulk_enrich_posts(posts, user_id, post_repo, user_repo)


@router.put("/{post_id}")
def update_post(
    post_id: str,
    payload: PostUpdate,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
):
    owner = post_repo.get_owner(post_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    fields_set = payload.model_fields_set if hasattr(payload, "model_fields_set") else getattr(payload, "__fields_set__", set())
    update_data = {k: v for k, v in payload.dict().items() if v is not None and k != "media"}
    media_provided = "media" in fields_set

    if not update_data and not media_provided:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "visibility" in update_data and hasattr(update_data["visibility"], "value"):
        update_data["visibility"] = update_data["visibility"].value

    if update_data:
        update_data["edited_at"] = "now()"
        post_row = post_repo.update(post_id, update_data)
    else:
        post_row = post_repo.get_by_id(post_id)

    if media_provided:
        post_repo.delete_media(post_id)
        media_payload = payload.media or []
        if media_payload:
            media_data = [{
                "post_id": post_id, "url": m.url,
                "media_type": m.media_type.value, "thumbnail_url": m.thumbnail_url,
            } for m in media_payload]
            post_repo.insert_media(media_data)

    enriched = enrich_post(post_row, user_id, post_repo, user_repo)
    return {"message": "Post updated", "data": enriched}


@router.delete("/{post_id}")
def delete_post(
    post_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
):
    owner = post_repo.get_owner(post_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    post_repo.delete(post_id)
    return {"message": "Post deleted"}


# ==================== ENGAGEMENT ====================

@router.post("/{post_id}/like")
def like_post(
    post_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    auth_service=Depends(get_auth_service),
):
    from app.routes.profile import _ensure_user_exists
    _ensure_user_exists(user_id, user_repo, auth_service)
    try:
        post_repo.add_like(post_id, user_id)
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Already liked")
        raise HTTPException(status_code=400, detail=str(e))
    post_repo.increment_likes(post_id)
    post = post_repo.get_by_id(post_id)
    if post:
        from app.routes.notifications import create_notification
        create_notification(
            user_id=post["author_id"],
            notification_type="like",
            message="liked your post",
            actor_id=user_id,
            post_id=post_id,
            post_preview=post.get("content"),
        )
    return {"message": "Post liked"}


@router.delete("/{post_id}/like")
def unlike_post(
    post_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
):
    post_repo.remove_like(post_id, user_id)
    post_repo.decrement_likes(post_id)
    return {"message": "Post unliked"}


@router.post("/{post_id}/repost")
def repost(
    post_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    auth_service=Depends(get_auth_service),
):
    from app.routes.profile import _ensure_user_exists
    _ensure_user_exists(user_id, user_repo, auth_service)
    try:
        post_repo.add_repost(post_id, user_id)
        post_repo.increment_reposts(post_id)
        post = post_repo.get_by_id(post_id)
        if post:
            from app.routes.notifications import create_notification
            create_notification(
                user_id=post["author_id"],
                notification_type="repost",
                message="reposted your post",
                actor_id=user_id,
                post_id=post_id,
                post_preview=post.get("content"),
            )
        return {"message": "Post reposted"}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Already reposted")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{post_id}/repost")
def unrepost(
    post_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
):
    post_repo.remove_repost(post_id, user_id)
    post_repo.decrement_reposts(post_id)
    return {"message": "Repost removed"}


@router.post("/{post_id}/save")
def save_post(
    post_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    auth_service=Depends(get_auth_service),
):
    from app.routes.profile import _ensure_user_exists
    _ensure_user_exists(user_id, user_repo, auth_service)
    try:
        post_repo.add_save(post_id, user_id)
        return {"message": "Post saved"}
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Already saved")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{post_id}/save")
def unsave_post(
    post_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
):
    post_repo.remove_save(post_id, user_id)
    return {"message": "Post unsaved"}


@router.get("/saved/all", response_model=List[PostResponse])
def get_saved_posts(
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    from app.deps import get_save_repo
    save_repo = get_save_repo()
    post_ids = save_repo.get_saved_post_ids(user_id, limit, offset)
    if not post_ids:
        return []
    posts = post_repo.get_by_ids(post_ids)
    return bulk_enrich_posts(posts, user_id, post_repo, user_repo)


# ==================== COMMENTS ====================

@router.get("/{post_id}/comments", response_model=List[CommentResponse])
def get_comments(
    post_id: str,
    user_id: Optional[str] = Depends(optional_auth),
    post_repo=Depends(get_post_repo),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    comments = post_repo.get_comments(post_id, limit, offset)
    if not comments:
        return []
    if user_id:
        comment_ids = [c["id"] for c in comments]
        liked_set = post_repo.get_liked_comment_ids(user_id, comment_ids)
        for comment in comments:
            comment["is_liked"] = comment["id"] in liked_set
    else:
        for comment in comments:
            comment["is_liked"] = False
    return comments


@router.post("/{post_id}/comments")
def create_comment(
    post_id: str,
    payload: CommentCreate,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
    user_repo=Depends(get_user_repo),
    auth_service=Depends(get_auth_service),
):
    from app.routes.profile import _ensure_user_exists
    _ensure_user_exists(user_id, user_repo, auth_service)
    comment = post_repo.create_comment({
        "post_id": post_id, "author_id": user_id,
        "content": payload.content, "parent_comment_id": payload.parent_comment_id,
    })
    post_repo.increment_comments(post_id)
    author = user_repo.get_by_id(user_id, "id, username, first_name, last_name, avatar_url")
    comment["author"] = author
    post = post_repo.get_by_id(post_id)
    if post:
        from app.routes.notifications import create_notification
        create_notification(
            user_id=post["author_id"],
            notification_type="comment",
            message="commented on your post",
            actor_id=user_id,
            post_id=post_id,
            post_preview=post.get("content"),
            comment_id=comment.get("id"),
        )
    return {"message": "Comment added", "data": comment}


@router.put("/comments/{comment_id}")
def update_comment(
    comment_id: str,
    payload: CommentUpdate,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
):
    owner_data = post_repo.get_comment_owner(comment_id)
    if not owner_data or owner_data["author_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    updated = post_repo.update_comment(comment_id, {"content": payload.content})
    return {"message": "Comment updated", "data": updated}


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: str,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
):
    owner_data = post_repo.get_comment_owner(comment_id)
    if not owner_data or owner_data["author_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    post_repo.delete_comment(comment_id)
    post_repo.decrement_comments(owner_data["post_id"])
    return {"message": "Comment deleted"}


# ==================== POLLS ====================

@router.post("/{post_id}/poll/vote")
def vote_on_poll(
    post_id: str,
    payload: PollVote,
    user_id: str = Depends(require_auth),
    post_repo=Depends(get_post_repo),
):
    poll_id = post_repo.get_poll_id_for_post(post_id)
    if not poll_id:
        raise HTTPException(status_code=404, detail="Poll not found")

    existing = post_repo.get_existing_vote(poll_id, user_id)
    if existing:
        old_option_id = existing["option_id"]
        post_repo.update_vote(poll_id, user_id, payload.option_id)
        post_repo.decrement_poll_votes(old_option_id)
        post_repo.increment_poll_votes(payload.option_id)
    else:
        post_repo.insert_vote({
            "poll_id": poll_id, "option_id": payload.option_id, "user_id": user_id,
        })
        post_repo.increment_poll_votes(payload.option_id)

    return {"message": "Vote recorded"}
