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

class NotificationActor(BaseModel):
    id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str = ""
    message: str
    link: Optional[str] = None
    actor_id: Optional[str] = None
    actor: Optional[NotificationActor] = None
    post_id: Optional[str] = None
    comment_id: Optional[str] = None
    connection_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    @field_validator("title", mode="before")
    @classmethod
    def coerce_title(cls, v):
        return v if v is not None else ""
