from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.middleware.auth import require_auth, optional_auth
from app.deps import (
    get_user_repo, get_work_experience_repo, get_education_repo,
    get_skill_repo, get_storage_service, get_auth_service,
)
from app.models.profile import (
    ProfileUpdateRequest, ProfileResponse, PrivacySettingsUpdate,
    WorkExperienceCreate, WorkExperienceUpdate, WorkExperienceResponse,
    EducationCreate, EducationUpdate, EducationResponse,
    SkillCreate, SkillResponse
)
from typing import List, Optional
import re
import time

router = APIRouter(prefix="/profile", tags=["Profile"])

_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


def _apply_privacy_filters(profile_data: dict, viewer_id: Optional[str]):
    profile_user_id = profile_data.get("id")
    if not profile_user_id:
        return profile_data
    if viewer_id == profile_user_id:
        return profile_data
    if not profile_data.get("email_visible", True):
        profile_data.pop("email", None)
    if not profile_data.get("connections_visible", True):
        profile_data.pop("connections_count", None)
        profile_data.pop("connections", None)
    if not profile_data.get("work_history_visible", True):
        profile_data["work_experience"] = []
        profile_data["education"] = []
    if not profile_data.get("activity_status_visible", True):
        profile_data.pop("last_active_at", None)
    return profile_data


def _enrich_profile(profile_data, user_id, user_repo, work_repo, edu_repo, skill_repo):
    profile_data["work_experience"] = work_repo.get_by_user(user_id)
    profile_data["education"] = edu_repo.get_by_user(user_id)
    profile_data["skills"] = skill_repo.get_by_user(user_id)
    profile_data["connections_count"] = user_repo.get_connections_count(user_id)
    profile_data["followers_count"] = user_repo.get_followers_count(user_id)
    return profile_data


# ==================== PROFILE CRUD ====================

@router.get("/me")
def get_my_profile(
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
    work_repo=Depends(get_work_experience_repo),
    edu_repo=Depends(get_education_repo),
    skill_repo=Depends(get_skill_repo),
    auth_service=Depends(get_auth_service),
):
    """Get current user's profile with nested work experience, education, and skills"""
    profile_data = user_repo.get_by_id(user_id)
    if not profile_data:
        _ensure_user_exists(user_id, user_repo, auth_service)
        profile_data = user_repo.get_by_id(user_id)
    if not profile_data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _enrich_profile(profile_data, user_id, user_repo, work_repo, edu_repo, skill_repo)


@router.get("/{identifier}")
def get_profile_by_username(
    identifier: str,
    viewer_id: Optional[str] = Depends(optional_auth),
    user_repo=Depends(get_user_repo),
    work_repo=Depends(get_work_experience_repo),
    edu_repo=Depends(get_education_repo),
    skill_repo=Depends(get_skill_repo),
):
    """Get user profile by username or user UUID (public)"""
    if _UUID_RE.match(identifier):
        profile_data = user_repo.get_by_id(identifier)
    else:
        profile_data = user_repo.get_by_username(identifier)
    if not profile_data:
        raise HTTPException(status_code=404, detail="User not found")
    profile_user_id = profile_data["id"]
    _enrich_profile(profile_data, profile_user_id, user_repo, work_repo, edu_repo, skill_repo)
    return _apply_privacy_filters(profile_data, viewer_id)


@router.put("/me")
def update_my_profile(
    payload: ProfileUpdateRequest,
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
):
    """Update current user's profile"""
    # exclude_unset so Pydantic defaults (None) don't wipe fields the client didn't touch.
    # Fields that CAN be explicitly cleared (set to null) are allowed through even when None.
    _CLEARABLE = {'linkedin_url', 'twitter_url', 'instagram_url', 'github_url', 'website', 'bio', 'location', 'current_position', 'current_company'}
    raw = payload.model_dump(exclude_unset=True)
    update_data = {k: v for k, v in raw.items() if v is not None or k in _CLEARABLE}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    current = user_repo.get_by_id(user_id, "username, email")
    current_username = (current or {}).get("username")
    current_email = (current or {}).get("email")

    if "username" in update_data:
        new_username = update_data["username"]
        if current_username != new_username and not user_repo.check_username_available(new_username):
            raise HTTPException(status_code=409, detail="Username already taken")

    if "email" in update_data:
        new_email = str(update_data["email"]).strip().lower()
        update_data["email"] = new_email
        if current_email != new_email and not user_repo.check_email_available(new_email):
            raise HTTPException(status_code=409, detail="Email already in use")

    update_data["updated_at"] = "now()"

    try:
        updated = user_repo.update(user_id, update_data)
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            if "email" in str(e).lower():
                raise HTTPException(status_code=409, detail="Email already in use")
            raise HTTPException(status_code=409, detail="Username already taken")
        raise HTTPException(status_code=400, detail=str(e))

    if not updated:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile updated successfully", "data": updated}


# ==================== IMAGE UPLOADS ====================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024


@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
    storage=Depends(get_storage_service),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and GIF images are allowed")
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5 MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    path = f"{user_id}/avatar.{ext}"
    public_url = storage.upload("avatars", path, contents, file.content_type)
    public_url = f"{public_url}?t={int(time.time())}"
    user_repo.update(user_id, {"avatar_url": public_url})
    return {"avatar_url": public_url}


@router.post("/upload-cover")
async def upload_cover(
    file: UploadFile = File(...),
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
    storage=Depends(get_storage_service),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and GIF images are allowed")
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5 MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    path = f"{user_id}/cover.{ext}"
    public_url = storage.upload("covers", path, contents, file.content_type)
    public_url = f"{public_url}?t={int(time.time())}"
    user_repo.update(user_id, {"cover_url": public_url})
    return {"cover_url": public_url}


@router.put("/privacy")
def update_privacy_settings(
    payload: PrivacySettingsUpdate,
    user_id: str = Depends(require_auth),
    user_repo=Depends(get_user_repo),
):
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No settings to update")
    updated = user_repo.update(user_id, update_data)
    return {"message": "Privacy settings updated", "data": updated}


# ==================== WORK EXPERIENCE ====================

@router.get("/work-experience", response_model=List[WorkExperienceResponse])
def get_work_experience(
    user_id: str = Depends(require_auth),
    work_repo=Depends(get_work_experience_repo),
):
    return work_repo.get_by_user(user_id)


@router.get("/work-experience/{username}", response_model=List[WorkExperienceResponse])
def get_user_work_experience(
    username: str,
    user_repo=Depends(get_user_repo),
    work_repo=Depends(get_work_experience_repo),
):
    user = user_repo.get_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return work_repo.get_by_user(user["id"])


@router.post("/work-experience")
def create_work_experience(
    payload: WorkExperienceCreate,
    user_id: str = Depends(require_auth),
    work_repo=Depends(get_work_experience_repo),
):
    from datetime import date as date_type
    data = payload.dict()
    data["user_id"] = user_id
    for field in ("start_date", "end_date"):
        if isinstance(data.get(field), date_type):
            data[field] = data[field].isoformat()
    return {"message": "Work experience added", "data": work_repo.create(data)}


@router.put("/work-experience/{experience_id}")
def update_work_experience(
    experience_id: str,
    payload: WorkExperienceUpdate,
    user_id: str = Depends(require_auth),
    work_repo=Depends(get_work_experience_repo),
):
    from datetime import date as date_type
    owner = work_repo.get_owner(experience_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if payload.is_current:
        update_data["end_date"] = None
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    for field in ("start_date", "end_date"):
        if isinstance(update_data.get(field), date_type):
            update_data[field] = update_data[field].isoformat()
    return {"message": "Work experience updated", "data": work_repo.update(experience_id, update_data)}


@router.delete("/work-experience/{experience_id}")
def delete_work_experience(
    experience_id: str,
    user_id: str = Depends(require_auth),
    work_repo=Depends(get_work_experience_repo),
):
    owner = work_repo.get_owner(experience_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    work_repo.delete(experience_id)
    return {"message": "Work experience deleted"}


# ==================== EDUCATION ====================

@router.get("/education", response_model=List[EducationResponse])
def get_education(
    user_id: str = Depends(require_auth),
    edu_repo=Depends(get_education_repo),
):
    return edu_repo.get_by_user(user_id)


@router.get("/education/{username}", response_model=List[EducationResponse])
def get_user_education(
    username: str,
    user_repo=Depends(get_user_repo),
    edu_repo=Depends(get_education_repo),
):
    user = user_repo.get_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return edu_repo.get_by_user(user["id"])


@router.post("/education")
def create_education(
    payload: EducationCreate,
    user_id: str = Depends(require_auth),
    edu_repo=Depends(get_education_repo),
):
    from datetime import date as date_type
    data = payload.dict()
    data["user_id"] = user_id
    for field in ("start_date", "end_date"):
        if isinstance(data.get(field), date_type):
            data[field] = data[field].isoformat()
    return {"message": "Education added", "data": edu_repo.create(data)}


@router.put("/education/{education_id}")
def update_education(
    education_id: str,
    payload: EducationUpdate,
    user_id: str = Depends(require_auth),
    edu_repo=Depends(get_education_repo),
):
    from datetime import date as date_type
    owner = edu_repo.get_owner(education_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if payload.is_current:
        update_data["end_date"] = None
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    for field in ("start_date", "end_date"):
        if isinstance(update_data.get(field), date_type):
            update_data[field] = update_data[field].isoformat()
    return {"message": "Education updated", "data": edu_repo.update(education_id, update_data)}


@router.delete("/education/{education_id}")
def delete_education(
    education_id: str,
    user_id: str = Depends(require_auth),
    edu_repo=Depends(get_education_repo),
):
    owner = edu_repo.get_owner(education_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    edu_repo.delete(education_id)
    return {"message": "Education deleted"}


# ==================== SKILLS ====================

@router.get("/skills", response_model=List[SkillResponse])
def get_skills(
    user_id: str = Depends(require_auth),
    skill_repo=Depends(get_skill_repo),
):
    return skill_repo.get_by_user(user_id)


@router.get("/skills/{username}", response_model=List[SkillResponse])
def get_user_skills(
    username: str,
    user_repo=Depends(get_user_repo),
    skill_repo=Depends(get_skill_repo),
):
    user = user_repo.get_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return skill_repo.get_by_user(user["id"])


@router.post("/skills")
def add_skill(
    payload: SkillCreate,
    user_id: str = Depends(require_auth),
    skill_repo=Depends(get_skill_repo),
):
    data = {"user_id": user_id, "skill": payload.skill.lower().strip(), "endorsement_count": 0}
    try:
        return {"message": "Skill added", "data": skill_repo.create(data)}
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="Skill already exists")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/skills/{skill_id}")
def delete_skill(
    skill_id: str,
    user_id: str = Depends(require_auth),
    skill_repo=Depends(get_skill_repo),
):
    owner = skill_repo.get_owner(skill_id)
    if owner != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    skill_repo.delete(skill_id)
    return {"message": "Skill deleted"}


# ==================== HELPERS ====================

def _ensure_user_exists(user_id: str, user_repo, auth_service):
    """Auto-create a users row for any auth user not yet in the DB."""
    try:
        existing = user_repo.get_by_id(user_id, "id")
        if existing:
            return
        auth_user = auth_service.get_user_by_id(user_id)
        email = auth_user.email if auth_user and auth_user.email else f"{user_id[:8]}@placeholder.local"
        username = f"user_{user_id[:8]}"
        metadata = auth_user.user_metadata if auth_user else {}
        first_name = metadata.get("first_name") or "User"
        last_name = metadata.get("last_name") or username
        user_repo.create({
            "id": user_id,
            "email": email,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "is_verified": False,
        })
    except Exception as e:
        print(f"ensure_user_exists error for {user_id}: {e}")
