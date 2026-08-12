from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum

class NotificationType(str, Enum):
    LIKE = "like"
    COMMENT = "comment"
    CONNECTION = "connection"
    MESSAGE = "message"
    SYSTEM = "system"
    FOLDER_POST = "folder_post"

class NotificationCreate(BaseModel):
    user_id: str
    type: NotificationType
    title: str = Field(..., max_length=100)
    message: str = Field(..., max_length=500)
    link: Optional[str] = None

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str = ""
    message: str
    link: Optional[str]
    is_read: bool
    created_at: datetime

    @field_validator("title", mode="before")
    @classmethod
    def coerce_title(cls, v):
        return v if v is not None else ""
