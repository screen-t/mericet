from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from app.middleware.auth import require_auth
from app.deps import get_storage_service
from app.middleware.rate_limit import limiter, UPLOAD_LIMIT
import uuid

router = APIRouter(prefix="/media", tags=["Media"])

MAX_MEDIA_SIZE = 50 * 1024 * 1024  # 50 MB

VIDEO_TYPES = {"video/mp4": "mp4", "video/webm": "webm"}


def _detect_image_type(contents: bytes) -> tuple[str, str] | None:
    """Return (mime, ext) from magic bytes, or None if not a recognised image."""
    if contents[:3] == b"\xff\xd8\xff":
        return ("image/jpeg", "jpg")
    if contents[:8] == b"\x89PNG\r\n\x1a\n":
        return ("image/png", "png")
    if contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return ("image/webp", "webp")
    if contents[:6] in (b"GIF87a", b"GIF89a"):
        return ("image/gif", "gif")
    return None


@router.post("/upload")
@limiter.limit(UPLOAD_LIMIT)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(require_auth),
    storage=Depends(get_storage_service),
):
    """Upload post media (images/videos) and return the public URL."""
    contents = await file.read()
    if len(contents) > MAX_MEDIA_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    # Try to identify as an image by magic bytes first
    image_result = _detect_image_type(contents)
    if image_result:
        mime, ext = image_result
    else:
        # Fall back to browser-declared type for videos (container formats are complex)
        declared = file.content_type or ""
        if declared not in VIDEO_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM")
        mime, ext = declared, VIDEO_TYPES[declared]

    path = f"posts/{user_id}/{uuid.uuid4().hex}.{ext}"
    public_url = storage.upload("post-media", path, contents, mime)
    return {"url": public_url}
