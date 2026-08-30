from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from app.middleware.auth import require_auth
from app.deps import get_review_repo
from app.repositories.protocols import ReviewRepository
from app.models.review import ReviewCreate, ReviewResponse, ReviewStatus
from app.routes.reports import _require_moderator

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewResponse)
def submit_review(
    payload: ReviewCreate,
    user_id: str = Depends(require_auth),
    review_repo: ReviewRepository = Depends(get_review_repo),
):
    """Create or replace the current user's review. Always resets to pending
    (and un-features it) so an edit gets re-moderated before showing again."""
    return review_repo.upsert(user_id, {
        "rating": payload.rating,
        "content": payload.content.strip(),
        "status": ReviewStatus.PENDING.value,
        "is_featured": False,
        "updated_at": "now()",
    })


@router.get("/mine", response_model=ReviewResponse)
def get_my_review(
    user_id: str = Depends(require_auth),
    review_repo: ReviewRepository = Depends(get_review_repo),
):
    review = review_repo.get_by_user(user_id)
    if not review:
        raise HTTPException(status_code=404, detail="No review submitted yet")
    return review


@router.get("/public", response_model=List[ReviewResponse])
def get_public_reviews(
    review_repo: ReviewRepository = Depends(get_review_repo),
    limit: int = Query(12, ge=1, le=30),
):
    """Approved reviews the admin has featured — the pool the landing page
    rotates through. No auth required; this is public marketing content."""
    return review_repo.get_featured(limit)


@router.get("/queue", response_model=List[ReviewResponse])
def get_review_queue(
    user_id: str = Depends(require_auth),
    review_repo: ReviewRepository = Depends(get_review_repo),
    status: ReviewStatus = Query(ReviewStatus.PENDING),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    _require_moderator(user_id, review_repo)
    return review_repo.get_queue(status.value, limit, offset)


@router.patch("/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: str,
    payload: dict,
    user_id: str = Depends(require_auth),
    review_repo: ReviewRepository = Depends(get_review_repo),
):
    """Moderator-only: approve/reject a review and/or toggle whether it's
    featured on the landing page. Either field may be provided independently."""
    _require_moderator(user_id, review_repo)

    update_data: dict = {}
    if "status" in payload:
        if payload["status"] not in {s.value for s in ReviewStatus}:
            raise HTTPException(status_code=400, detail="Invalid status")
        update_data["status"] = payload["status"]
        # Un-featuring on rejection — a rejected review should never stay in the pool
        if payload["status"] != ReviewStatus.APPROVED.value:
            update_data["is_featured"] = False
    if "is_featured" in payload:
        update_data["is_featured"] = bool(payload["is_featured"])

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if update_data.get("is_featured") is True:
        # Only an approved review may be featured — check the status being set
        # in this same request, falling back to the review's current status.
        target_status = update_data.get("status")
        if target_status is None:
            existing = review_repo.get_by_id(review_id)
            target_status = existing["status"] if existing else None
        if target_status != ReviewStatus.APPROVED.value:
            raise HTTPException(status_code=400, detail="Only approved reviews can be featured")

    update_data["updated_at"] = "now()"

    updated = review_repo.update_status(review_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Review not found")
    return updated
