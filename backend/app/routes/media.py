from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from app.middleware.auth import require_auth
from app.deps import get_storage_service
from app.middleware.rate_limit import limiter, UPLOAD_LIMIT
import uuid

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_MEDIA_TYPES = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/gif":  "gif",
    "video/mp4":  "mp4",
    "video/webm": "webm",
}
MAX_MEDIA_SIZE = 50 * 1024 * 1024  # 50 MB

IMAGE_MAGIC = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png":  b"\x89PNG",
    "image/webp": b"RIFF",
    "image/gif":  b"GIF",
}


@router.post("/upload")
@limiter.limit(UPLOAD_LIMIT)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(require_auth),
    storage=Depends(get_storage_service),
):
    """Upload post media (images/videos) and return the public URL."""
    mime = file.content_type
    if mime not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    contents = await file.read()
    if len(contents) > MAX_MEDIA_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    # Validate magic bytes for images (videos have complex container formats)
    if mime in IMAGE_MAGIC and not contents.startswith(IMAGE_MAGIC[mime]):
        raise HTTPException(status_code=400, detail="File content does not match its declared type")

    ext = ALLOWED_MEDIA_TYPES[mime]
    path = f"posts/{user_id}/{uuid.uuid4().hex}.{ext}"

    public_url = storage.upload("post-media", path, contents, mime)
    return {"url": public_url}
