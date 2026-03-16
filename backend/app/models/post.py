from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Enums
class PostType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    POLL = "poll"
    INSIGHT = "insight"
    QUESTION = "question"
    CASE_STUDY = "case_study"
    HIRING = "hiring"

class VisibilityType(str, Enum):
    PUBLIC = "public"
    CONNECTIONS = "connections"

class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    LINK = "link"

# Post Models
class PostMedia(BaseModel):
    url: str
    media_type: MediaType
    thumbnail_url: Optional[str] = None

class PollOption(BaseModel):
    option_text: str
    display_order: int

class PollCreate(BaseModel):
    question: str
    options: List[PollOption] = Field(..., min_items=2, max_items=4)
    ends_at: Optional[datetime] = None

class PostCreate(BaseModel):
    content: str = Field(default="", max_length=3000)
    post_type: PostType = PostType.TEXT
    visibility: VisibilityType = VisibilityType.PUBLIC
    media: Optional[List[PostMedia]] = None
    poll: Optional[PollCreate] = None
    scheduled_at: Optional[datetime] = None
    is_draft: bool = False

    @model_validator(mode='after')
    def require_content_or_media_or_poll(self):
        if not self.content.strip() and not self.media and not self.poll:
            raise ValueError('Content, media, or poll must be provided')
        return self

class PostUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=3000)
    visibility: Optional[VisibilityType] = None
    scheduled_at: Optional[datetime] = None
    media: Optional[List[PostMedia]] = None

class PostResponse(BaseModel):
    id: str
    author_id: str
    content: str
    post_type: str
    visibility: str
    scheduled_at: Optional[datetime]
    is_published: bool
    is_draft: bool
    like_count: int
    comment_count: int
    repost_count: int
    share_count: int
    created_at: datetime
    edited_at: Optional[datetime]
    # These will be populated separately
    author: Optional[dict] = None
    media: Optional[List[dict]] = None
    poll: Optional[dict] = None
    is_liked: Optional[bool] = None
    is_reposted: Optional[bool] = None
    is_saved: Optional[bool] = None

# Comment Models
class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    parent_comment_id: Optional[str] = None

class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)

class CommentResponse(BaseModel):
    id: str
    post_id: str
    author_id: str
    parent_comment_id: Optional[str]
    content: str
    like_count: int
    created_at: datetime
    author: Optional[dict] = None
    is_liked: Optional[bool] = None

# Poll Vote Model
class PollVote(BaseModel):
    option_id: str
