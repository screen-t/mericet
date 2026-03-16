from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional
from datetime import date, datetime
import re

# User Profile Models
class ProfileUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    additional_name: Optional[str] = None
    pronouns: Optional[str] = None
    headline: Optional[str] = Field(None, max_length=120)
    bio: Optional[str] = Field(None, max_length=2000)
    birthdate: Optional[date] = None
    website: Optional[str] = None
    location: Optional[str] = None
    postal_code: Optional[str] = None
    address: Optional[str] = None
    current_position: Optional[str] = None
    current_company: Optional[str] = None
    industry: Optional[str] = None
    account_type: Optional[str] = None
    username: Optional[str] = Field(None, min_length=3, max_length=30)

    @validator('username')
    def validate_username(cls, v):
        if v is None:
            return v
        username = v.strip().lower()
        if not re.match(r'^[a-z0-9_-]+$', username):
            raise ValueError('Username can only contain lowercase letters, numbers, underscores, and hyphens')
        return username
    
    @validator('account_type')
    def validate_account_type(cls, v):
        if v and v not in ['founder', 'developer', 'consultant', 'investor', 'other']:
            raise ValueError('Invalid account type')
        return v

class PrivacySettingsUpdate(BaseModel):
    email_visible: Optional[bool] = None
    phone_visible: Optional[bool] = None
    birthday_visible: Optional[bool] = None
    location_visible: Optional[bool] = None
    work_history_visible: Optional[bool] = None
    connections_visible: Optional[bool] = None
    activity_status_visible: Optional[bool] = None

class ProfileResponse(BaseModel):
    id: str
    email: str
    phone: Optional[str]
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    additional_name: Optional[str]
    pronouns: Optional[str]
    headline: Optional[str]
    bio: Optional[str]
    birthdate: Optional[date]
    website: Optional[str]
    location: Optional[str]
    postal_code: Optional[str]
    address: Optional[str]
    current_position: Optional[str]
    current_company: Optional[str]
    industry: Optional[str]
    account_type: Optional[str]
    avatar_url: Optional[str]
    cover_url: Optional[str]
    email_visible: bool
    phone_visible: bool
    birthday_visible: bool
    location_visible: bool
    work_history_visible: bool
    connections_visible: bool
    activity_status_visible: bool
    is_verified: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_active_at: Optional[datetime]

# Work Experience Models
class WorkExperienceCreate(BaseModel):
    company: str
    position: str
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = Field(None, max_length=1000)

class WorkExperienceUpdate(BaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = Field(None, max_length=1000)

class WorkExperienceResponse(BaseModel):
    id: str
    user_id: str
    company: str
    position: str
    start_date: date
    end_date: Optional[date]
    description: Optional[str]

# Education Models
class EducationCreate(BaseModel):
    institution: str
    degree: str
    field_of_study: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None

class EducationUpdate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class EducationResponse(BaseModel):
    id: str
    user_id: str
    institution: str
    degree: str
    field_of_study: Optional[str]
    start_date: date
    end_date: Optional[date]

# User Skills Models
class SkillCreate(BaseModel):
    skill: str = Field(..., min_length=1, max_length=50)

class SkillResponse(BaseModel):
    id: str
    user_id: str
    skill: str
    endorsement_count: int
