import os
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.report import ReportCreate, ReportResponse, ReportStatus

router = APIRouter(prefix="/reports", tags=["Reports"])


def _moderator_email_allowlist() -> set[str]:
    raw = os.getenv("REPORT_MODERATOR_EMAILS", "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _moderator_username_allowlist() -> set[str]:
    raw = os.getenv("REPORT_MODERATOR_USERNAMES", "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _get_current_user_profile(user_id: str) -> dict | None:
    try:
        profile = supabase.table("users").select("id, username, email").eq("id", user_id).limit(1).execute()
        return profile.data[0] if profile.data else None
    except Exception:
        return None


def _require_moderator(user_id: str) -> None:
    profile = _get_current_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=403, detail="Moderator access required")

    email = (profile.get("email") or "").strip().lower()
    username = (profile.get("username") or "").strip().lower()
    email_allowlist = _moderator_email_allowlist()
    username_allowlist = _moderator_username_allowlist()

    if email_allowlist and email in email_allowlist:
        return
    if username_allowlist and username in username_allowlist:
        return

    # Fallback: if no allowlist is configured, do not open moderation to everyone.
    raise HTTPException(status_code=403, detail="Moderator access required")


def _target_exists(target_type: str, target_id: str) -> bool:
    try:
        if target_type == "post":
            row = supabase.table("posts").select("id").eq("id", target_id).limit(1).execute()
            return bool(row.data)
        if target_type == "user":
            row = supabase.table("users").select("id").eq("id", target_id).limit(1).execute()
            return bool(row.data)
        return False
    except Exception:
        return False


@router.post("", response_model=ReportResponse)
def create_report(payload: ReportCreate, user_id: str = Depends(require_auth)):
    """Create a report for a post or user."""
    try:
        if payload.target_id == user_id and payload.target_type == "user":
            raise HTTPException(status_code=400, detail="Cannot report yourself")

        if not _target_exists(payload.target_type.value, payload.target_id):
            raise HTTPException(status_code=404, detail="Target not found")

        existing = supabase.table("reports").select("*").eq("reporter_id", user_id).eq("target_type", payload.target_type.value).eq("target_id", payload.target_id).limit(1).execute()
        if existing.data:
            return existing.data[0]

        result = supabase.table("reports").insert({
            "reporter_id": user_id,
            "target_type": payload.target_type.value,
            "target_id": payload.target_id,
            "reason": payload.reason.strip(),
            "details": payload.details.strip() if payload.details else None,
        }).execute()
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/mine", response_model=List[ReportResponse])
def list_my_reports(
    user_id: str = Depends(require_auth),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List reports created by the current user."""
    try:
        rows = (
            supabase.table("reports")
            .select("*")
            .eq("reporter_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return rows.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/moderator/status")
def moderator_status(user_id: str = Depends(require_auth)):
    try:
        _require_moderator(user_id)
        return {"can_moderate": True}
    except HTTPException:
        return {"can_moderate": False}


@router.get("/queue", response_model=List[ReportResponse])
def get_report_queue(
    user_id: str = Depends(require_auth),
    status: ReportStatus = Query(ReportStatus.PENDING),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get moderation queue items."""
    _require_moderator(user_id)
    try:
        rows = (
            supabase.table("reports")
            .select("*")
            .eq("status", status.value)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return rows.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{report_id}", response_model=ReportResponse)
def update_report_status(report_id: str, payload: dict, user_id: str = Depends(require_auth)):
    """Update moderation status for a report."""
    _require_moderator(user_id)
    try:
        status_value = payload.get("status")
        if status_value not in {s.value for s in ReportStatus}:
            raise HTTPException(status_code=400, detail="Invalid status")

        updated = (
            supabase.table("reports")
            .update({"status": status_value, "updated_at": "now()"})
            .eq("id", report_id)
            .execute()
        )
        if not updated.data:
            raise HTTPException(status_code=404, detail="Report not found")
        return updated.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
