import os
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from app.middleware.auth import require_auth
from app.deps import get_report_repo
from app.repositories.protocols import ReportRepository
from app.models.report import ReportCreate, ReportResponse, ReportStatus

router = APIRouter(prefix="/reports", tags=["Reports"])


def _moderator_email_allowlist() -> set[str]:
    raw = os.getenv("REPORT_MODERATOR_EMAILS", "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _moderator_username_allowlist() -> set[str]:
    raw = os.getenv("REPORT_MODERATOR_USERNAMES", "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _require_moderator(user_id: str, report_repo: ReportRepository) -> None:
    profile = report_repo.get_user_profile(user_id)
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

    raise HTTPException(status_code=403, detail="Moderator access required")


@router.post("", response_model=ReportResponse)
def create_report(
    payload: ReportCreate,
    user_id: str = Depends(require_auth),
    report_repo: ReportRepository = Depends(get_report_repo),
):
    """Create a report for a post or user."""
    if payload.target_id == user_id and payload.target_type == "user":
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    if not report_repo.target_exists(payload.target_type.value, payload.target_id):
        raise HTTPException(status_code=404, detail="Target not found")

    existing = report_repo.get_existing(
        user_id, payload.target_type.value, payload.target_id
    )
    if existing:
        return existing

    return report_repo.create({
        "reporter_id": user_id,
        "target_type": payload.target_type.value,
        "target_id": payload.target_id,
        "reason": payload.reason.strip(),
        "details": payload.details.strip() if payload.details else None,
    })


@router.get("/mine", response_model=List[ReportResponse])
def list_my_reports(
    user_id: str = Depends(require_auth),
    report_repo: ReportRepository = Depends(get_report_repo),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List reports created by the current user."""
    return report_repo.get_by_reporter(user_id, limit, offset)


@router.get("/moderator/status")
def moderator_status(
    user_id: str = Depends(require_auth),
    report_repo: ReportRepository = Depends(get_report_repo),
):
    try:
        _require_moderator(user_id, report_repo)
        return {"can_moderate": True}
    except HTTPException:
        return {"can_moderate": False}


@router.get("/queue", response_model=List[ReportResponse])
def get_report_queue(
    user_id: str = Depends(require_auth),
    report_repo: ReportRepository = Depends(get_report_repo),
    status: ReportStatus = Query(ReportStatus.PENDING),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get moderation queue items."""
    _require_moderator(user_id, report_repo)
    return report_repo.get_queue(status.value, limit, offset)


@router.patch("/{report_id}", response_model=ReportResponse)
def update_report_status(
    report_id: str,
    payload: dict,
    user_id: str = Depends(require_auth),
    report_repo: ReportRepository = Depends(get_report_repo),
):
    """Update moderation status for a report."""
    _require_moderator(user_id, report_repo)

    status_value = payload.get("status")
    if status_value not in {s.value for s in ReportStatus}:
        raise HTTPException(status_code=400, detail="Invalid status")

    updated = report_repo.update_status(
        report_id, {"status": status_value, "updated_at": "now()"}
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Report not found")
    return updated
