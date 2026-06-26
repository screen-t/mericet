from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.middleware.auth import require_auth
from app.deps import get_storage_service
import uuid

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_MEDIA_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/webm",
}
MAX_MEDIA_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    user_id: str = Depends(require_auth),
    storage=Depends(get_storage_service),
):
    """Upload post media (images/videos) and return the public URL."""
    if file.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    contents = await file.read()
    if len(contents) > MAX_MEDIA_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    path = f"posts/{user_id}/{uuid.uuid4().hex}.{ext}"

    public_url = storage.upload("post-media", path, contents, file.content_type)
    return {"url": public_url}
