from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.lib.supabase import supabase
from app.lib.auth_helpers import check_username_availability
from app.middleware.auth import require_auth
from app.models.profile import (
    ProfileUpdateRequest, ProfileResponse, PrivacySettingsUpdate,
    WorkExperienceCreate, WorkExperienceUpdate, WorkExperienceResponse,
    EducationCreate, EducationUpdate, EducationResponse,
    SkillCreate, SkillResponse
)
from typing import List

router = APIRouter(prefix="/profile", tags=["Profile"])

# ==================== PROFILE CRUD ====================

@router.get("/me")
def get_my_profile(user_id: str = Depends(require_auth)):
    """Get current user's profile with nested work experience, education, and skills"""
    try:
        response = supabase.table("users").select("*").eq("id", user_id).single().execute()
        if not response.data:
            # Profile row missing — bootstrap it from auth metadata then retry
            from app.routes.messages import ensure_user_exists
            ensure_user_exists(user_id)
            response = supabase.table("users").select("*").eq("id", user_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        profile_data = response.data
        work_exp = supabase.table("work_experience").select("*").eq("user_id", user_id).order("start_date", desc=True).execute()
        education = supabase.table("education").select("*").eq("user_id", user_id).order("start_date", desc=True).execute()
        skills = supabase.table("user_skills").select("*").eq("user_id", user_id).execute()
        profile_data["work_experience"] = work_exp.data or []
        profile_data["education"] = education.data or []
        profile_data["skills"] = skills.data or []
        return profile_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail="Profile not found")

@router.get("/{identifier}")
def get_profile_by_username(identifier: str):
    """Get user profile by username or user UUID (public), with nested work experience, education, and skills"""
    import re
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    try:
        if uuid_pattern.match(identifier):
            response = supabase.table("users").select("*").eq("id", identifier).single().execute()
        else:
            response = supabase.table("users").select("*").eq("username", identifier).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        profile_data = response.data
        profile_user_id = profile_data["id"]
        work_exp = supabase.table("work_experience").select("*").eq("user_id", profile_user_id).order("start_date", desc=True).execute()
        education = supabase.table("education").select("*").eq("user_id", profile_user_id).order("start_date", desc=True).execute()
        skills = supabase.table("user_skills").select("*").eq("user_id", profile_user_id).execute()
        profile_data["work_experience"] = work_exp.data or []
        profile_data["education"] = education.data or []
        profile_data["skills"] = skills.data or []
        return profile_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail="User not found")

@router.put("/me")
def update_my_profile(payload: ProfileUpdateRequest, user_id: str = Depends(require_auth)):
    """Update current user's profile"""
    try:
        # Build update dictionary excluding None values
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        current_user = supabase.table("users").select("username,email").eq("id", user_id).single().execute()
        current_username = (current_user.data or {}).get("username")
        current_email = (current_user.data or {}).get("email")

        # Handle username updates explicitly to provide clear conflict errors.
        if "username" in update_data:
            new_username = update_data["username"]

            if current_username != new_username and not check_username_availability(new_username):
                raise HTTPException(status_code=409, detail="Username already taken")

        if "email" in update_data:
            new_email = str(update_data["email"]).strip().lower()
            update_data["email"] = new_email

            if current_email != new_email:
                existing = supabase.table("users").select("id").eq("email", new_email).limit(1).execute()
                if getattr(existing, "data", None):
                    raise HTTPException(status_code=409, detail="Email already in use")
        
        # Add updated_at timestamp
        update_data["updated_at"] = "now()"
        
        response = supabase.table("users").update(update_data).eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return {"message": "Profile updated successfully", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        # Fall back to conflict status for DB-level unique violations.
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            if "email" in str(e).lower():
                raise HTTPException(status_code=409, detail="Email already in use")
            raise HTTPException(status_code=409, detail="Username already taken")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== IMAGE UPLOADS ====================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), user_id: str = Depends(require_auth)):
    """Upload a profile avatar image to Supabase Storage and update the user's avatar_url"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and GIF images are allowed")
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5 MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    path = f"{user_id}/avatar.{ext}"
    try:
        # upsert=True replaces existing file
        supabase.storage.from_("avatars").upload(path, contents, {"content-type": file.content_type, "upsert": "true"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")
    public_url = supabase.storage.from_("avatars").get_public_url(path)
    # append cache-bust so the browser refreshes the image
    import time
    public_url = f"{public_url}?t={int(time.time())}"
    try:
        supabase.table("users").update({"avatar_url": public_url}).eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save avatar URL: {str(e)}")
    return {"avatar_url": public_url}

@router.post("/upload-cover")
async def upload_cover(file: UploadFile = File(...), user_id: str = Depends(require_auth)):
    """Upload a cover image to Supabase Storage and update the user's cover_url"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and GIF images are allowed")
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5 MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    path = f"{user_id}/cover.{ext}"
    try:
        supabase.storage.from_("covers").upload(path, contents, {"content-type": file.content_type, "upsert": "true"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")
    public_url = supabase.storage.from_("covers").get_public_url(path)
    import time
    public_url = f"{public_url}?t={int(time.time())}"
    try:
        supabase.table("users").update({"cover_url": public_url}).eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save cover URL: {str(e)}")
    return {"cover_url": public_url}

@router.put("/privacy")
def update_privacy_settings(payload: PrivacySettingsUpdate, user_id: str = Depends(require_auth)):
    """Update user's privacy settings"""
    try:
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No settings to update")
        
        response = supabase.table("users").update(update_data).eq("id", user_id).execute()
        
        return {"message": "Privacy settings updated", "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== WORK EXPERIENCE ====================

@router.get("/work-experience", response_model=List[WorkExperienceResponse])
def get_work_experience(user_id: str = Depends(require_auth)):
    """Get current user's work experience"""
    try:
        response = supabase.table("work_experience").select("*").eq("user_id", user_id).order("start_date", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/work-experience/{username}", response_model=List[WorkExperienceResponse])
def get_user_work_experience(username: str):
    """Get work experience for a specific user by username"""
    try:
        # First get user_id from username
        user_response = supabase.table("users").select("id").eq("username", username).single().execute()
        if not user_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        response = supabase.table("work_experience").select("*").eq("user_id", user_response.data["id"]).order("start_date", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/work-experience")
def create_work_experience(payload: WorkExperienceCreate, user_id: str = Depends(require_auth)):
    """Add work experience"""
    try:
        from datetime import date as date_type
        data = payload.dict()
        data["user_id"] = user_id
        for field in ("start_date", "end_date"):
            if isinstance(data.get(field), date_type):
                data[field] = data[field].isoformat()
        
        response = supabase.table("work_experience").insert(data).execute()
        return {"message": "Work experience added", "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/work-experience/{experience_id}")
def update_work_experience(experience_id: str, payload: WorkExperienceUpdate, user_id: str = Depends(require_auth)):
    """Update work experience"""
    try:
        from datetime import date as date_type
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        # When marking as current, explicitly clear end_date in the DB
        if payload.is_current:
            update_data["end_date"] = None
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        for field in ("start_date", "end_date"):
            if isinstance(update_data.get(field), date_type):
                update_data[field] = update_data[field].isoformat()
        
        # Verify ownership
        check = supabase.table("work_experience").select("user_id").eq("id", experience_id).single().execute()
        if not check.data or check.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        response = supabase.table("work_experience").update(update_data).eq("id", experience_id).execute()
        return {"message": "Work experience updated", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/work-experience/{experience_id}")
def delete_work_experience(experience_id: str, user_id: str = Depends(require_auth)):
    """Delete work experience"""
    try:
        # Verify ownership
        check = supabase.table("work_experience").select("user_id").eq("id", experience_id).single().execute()
        if not check.data or check.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        supabase.table("work_experience").delete().eq("id", experience_id).execute()
        return {"message": "Work experience deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== EDUCATION ====================

@router.get("/education", response_model=List[EducationResponse])
def get_education(user_id: str = Depends(require_auth)):
    """Get current user's education"""
    try:
        response = supabase.table("education").select("*").eq("user_id", user_id).order("start_date", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/education/{username}", response_model=List[EducationResponse])
def get_user_education(username: str):
    """Get education for a specific user by username"""
    try:
        # First get user_id from username
        user_response = supabase.table("users").select("id").eq("username", username).single().execute()
        if not user_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        response = supabase.table("education").select("*").eq("user_id", user_response.data["id"]).order("start_date", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/education")
def create_education(payload: EducationCreate, user_id: str = Depends(require_auth)):
    """Add education"""
    try:
        from datetime import date as date_type
        data = payload.dict()
        data["user_id"] = user_id
        for field in ("start_date", "end_date"):
            if isinstance(data.get(field), date_type):
                data[field] = data[field].isoformat()
        
        response = supabase.table("education").insert(data).execute()
        return {"message": "Education added", "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/education/{education_id}")
def update_education(education_id: str, payload: EducationUpdate, user_id: str = Depends(require_auth)):
    """Update education"""
    try:
        from datetime import date as date_type
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        # When marking as current, explicitly clear end_date in the DB
        if payload.is_current:
            update_data["end_date"] = None
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        for field in ("start_date", "end_date"):
            if isinstance(update_data.get(field), date_type):
                update_data[field] = update_data[field].isoformat()
        
        # Verify ownership
        check = supabase.table("education").select("user_id").eq("id", education_id).single().execute()
        if not check.data or check.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        response = supabase.table("education").update(update_data).eq("id", education_id).execute()
        return {"message": "Education updated", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/education/{education_id}")
def delete_education(education_id: str, user_id: str = Depends(require_auth)):
    """Delete education"""
    try:
        # Verify ownership
        check = supabase.table("education").select("user_id").eq("id", education_id).single().execute()
        if not check.data or check.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        supabase.table("education").delete().eq("id", education_id).execute()
        return {"message": "Education deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==================== SKILLS ====================

@router.get("/skills", response_model=List[SkillResponse])
def get_skills(user_id: str = Depends(require_auth)):
    """Get current user's skills"""
    try:
        response = supabase.table("user_skills").select("*").eq("user_id", user_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/skills/{username}", response_model=List[SkillResponse])
def get_user_skills(username: str):
    """Get skills for a specific user by username"""
    try:
        # First get user_id from username
        user_response = supabase.table("users").select("id").eq("username", username).single().execute()
        if not user_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        response = supabase.table("user_skills").select("*").eq("user_id", user_response.data["id"]).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/skills")
def add_skill(payload: SkillCreate, user_id: str = Depends(require_auth)):
    """Add a skill"""
    try:
        data = {
            "user_id": user_id,
            "skill": payload.skill.lower().strip(),
            "endorsement_count": 0
        }
        
        response = supabase.table("user_skills").insert(data).execute()
        return {"message": "Skill added", "data": response.data[0]}
    except Exception as e:
        # Check for unique constraint violation
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="Skill already exists")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/skills/{skill_id}")
def delete_skill(skill_id: str, user_id: str = Depends(require_auth)):
    """Delete a skill"""
    try:
        # Verify ownership
        check = supabase.table("user_skills").select("user_id").eq("id", skill_id).single().execute()
        if not check.data or check.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        supabase.table("user_skills").delete().eq("id", skill_id).execute()
        return {"message": "Skill deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
