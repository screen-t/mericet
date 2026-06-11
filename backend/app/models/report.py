from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


class ReportTargetType(str, Enum):
    POST = "post"
    USER = "user"


class ReportStatus(str, Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_id: str
    reason: str = Field(min_length=1, max_length=120)
    details: Optional[str] = Field(default=None, max_length=1000)


class ReportResponse(BaseModel):
    id: str
    reporter_id: str
    target_type: str
    target_id: str
    reason: str
    details: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
