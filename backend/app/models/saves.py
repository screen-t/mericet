from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FolderCreate(BaseModel):
    folder_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    color: Optional[str] = Field(default="#6366f1")


class FolderUpdate(BaseModel):
    folder_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = None


class FolderResponse(BaseModel):
    id: str
    user_id: str
    folder_name: str
    description: Optional[str] = None
    color: str
    post_count: int = 0
    is_public: bool = False
    share_token: Optional[str] = None
    thumbnail_url: Optional[str] = None
    follower_count: int = 0
    created_at: datetime
    updated_at: datetime


class FolderPublicToggle(BaseModel):
    is_public: bool


class SaveToFolder(BaseModel):
    folder_id: Optional[str] = None
