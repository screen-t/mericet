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


def create_notification(user_id: str, notification_type: str,
                        title: str, message: str, link: str = None):
    """Helper function used by other routes to create notifications."""
    from app.deps import get_notification_repo
    repo = get_notification_repo()
    try:
        repo.create({
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "link": link,
            "is_read": False,
        })
    except Exception as e:
        print(f"Error creating notification: {e}")
