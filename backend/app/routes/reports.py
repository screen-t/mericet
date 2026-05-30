from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.report import ReportCreate, ReportResponse

router = APIRouter(prefix="/reports", tags=["Reports"])


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
