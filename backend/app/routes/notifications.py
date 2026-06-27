from fastapi import APIRouter, HTTPException, Depends, Query
from app.middleware.auth import require_auth
from app.deps import get_notification_repo
from app.repositories.protocols import NotificationRepository
from app.models.notification import NotificationResponse
from typing import List

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get user's notifications"""
    return notif_repo.get_for_user(user_id, unread_only, limit, offset)


@router.get("/unread-count")
def get_unread_count(
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    """Get count of unread notifications."""
    try:
        return {"count": notif_repo.count_unread(user_id)}
    except Exception as e:
        print(f"Warning: unread_count query failed for {user_id}: {e}")
        return {"count": 0}


@router.put("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: str,
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    """Mark a notification as read"""
    owner = notif_repo.get_owner(notification_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    notif_repo.mark_read(notification_id)
    return {"message": "Notification marked as read"}


@router.put("/read-all")
def mark_all_as_read(
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    """Mark all notifications as read"""
    notif_repo.mark_all_read(user_id)
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    """Delete a notification"""
    owner = notif_repo.get_owner(notification_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    notif_repo.delete(notification_id)
    return {"message": "Notification deleted"}


@router.delete("/clear-all")
def clear_all_notifications(
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    """Clear all read notifications"""
    notif_repo.clear_read(user_id)
    return {"message": "Read notifications cleared"}


# ==================== MUTE ====================

@router.post("/mute/{target_user_id}")
def mute_user_notifications(
    target_user_id: str,
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    if notif_repo.is_muted(user_id, target_user_id):
        return {"message": "Already muted"}
    notif_repo.mute_user(user_id, target_user_id)
    return {"message": "User muted"}


@router.delete("/mute/{target_user_id}")
def unmute_user_notifications(
    target_user_id: str,
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    notif_repo.unmute_user(user_id, target_user_id)
    return {"message": "User unmuted"}


@router.get("/mute/status/{target_user_id}")
def get_mute_status(
    target_user_id: str,
    user_id: str = Depends(require_auth),
    notif_repo: NotificationRepository = Depends(get_notification_repo),
):
    return {"is_muted": notif_repo.is_muted(user_id, target_user_id)}


_TYPE_TO_PREF = {
    "like": "post_engagement",
    "comment": "post_engagement",
    "repost": "post_engagement",
    "connection_request": "connection_requests",
    "connection_accepted": "connection_requests",
    "follow": "new_followers",
    "mention": "mentions",
}


def create_notification(
    user_id: str,
    notification_type: str,
    message: str,
    actor_id: str = None,
    post_id: str = None,
    post_preview: str = None,
    comment_id: str = None,
    connection_id: str = None,
    link: str = None,
):
    if actor_id == user_id:
        return
    from app.deps import get_notification_repo, get_user_repo
    repo = get_notification_repo()
    if actor_id and repo.is_muted(user_id, actor_id):
        return
    pref_key = _TYPE_TO_PREF.get(notification_type)
    if pref_key:
        try:
            user_repo = get_user_repo()
            receiver = user_repo.get_by_id(user_id, "notification_preferences")
            prefs = (receiver or {}).get("notification_preferences") or {}
            if prefs.get(pref_key) is False:
                return
        except Exception:
            pass
    try:
        data = {
            "user_id": user_id,
            "type": notification_type,
            "message": message,
            "is_read": False,
        }
        if actor_id:
            data["actor_id"] = actor_id
        if post_id:
            data["post_id"] = post_id
        if post_preview:
            data["post_preview"] = post_preview[:100]
        if comment_id:
            data["comment_id"] = comment_id
        if connection_id:
            data["connection_id"] = connection_id
        if link:
            data["link"] = link
        repo.create(data)
    except Exception as e:
        print(f"Error creating notification: {e}")
