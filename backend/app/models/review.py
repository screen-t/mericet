from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=1000)


class ReviewAuthor(BaseModel):
    id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    headline: Optional[str] = None


class ReviewResponse(BaseModel):
    id: str
    user_id: str
    rating: int
    content: str
    status: str
    is_featured: bool
    created_at: datetime
    updated_at: datetime
    user: Optional[ReviewAuthor] = None
