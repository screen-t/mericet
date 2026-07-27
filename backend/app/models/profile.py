from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional
from datetime import date, datetime
import re

_DANGEROUS_URL_RE = re.compile(r'^(javascript|data|vbscript):', re.IGNORECASE)


def _validate_url(v: Optional[str], field_name: str = "URL") -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if not v:
        return None
    if _DANGEROUS_URL_RE.match(v):
        raise ValueError(f"{field_name} contains an invalid scheme")
    if len(v) > 500:
        raise ValueError(f"{field_name} must be 500 characters or fewer")
    return v


# User Profile Models
class ProfileUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    additional_name: Optional[str] = Field(None, max_length=50)
    pronouns: Optional[str] = Field(None, max_length=30)
    headline: Optional[str] = Field(None, max_length=120)
    bio: Optional[str] = Field(None, max_length=2000)
    birthdate: Optional[date] = None
    website: Optional[str] = None
    location: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=200)
    current_position: Optional[str] = Field(None, max_length=100)
    current_company: Optional[str] = Field(None, max_length=100)
    industry: Optional[str] = Field(None, max_length=100)
    account_type: Optional[str] = None
    username: Optional[str] = Field(None, min_length=3, max_length=30)
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    instagram_url: Optional[str] = None
    github_url: Optional[str] = None

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

    @validator('website')
    def validate_website(cls, v):
        return _validate_url(v, "Website URL")

    @validator('linkedin_url')
    def validate_linkedin_url(cls, v):
        return _validate_url(v, "LinkedIn URL")

    @validator('twitter_url')
    def validate_twitter_url(cls, v):
        return _validate_url(v, "Twitter URL")

    @validator('instagram_url')
    def validate_instagram_url(cls, v):
        return _validate_url(v, "Instagram URL")

    @validator('github_url')
    def validate_github_url(cls, v):
        return _validate_url(v, "GitHub URL")

class PrivacySettingsUpdate(BaseModel):
    email_visible: Optional[bool] = None
    phone_visible: Optional[bool] = None
    birthday_visible: Optional[bool] = None
    location_visible: Optional[bool] = None
    work_history_visible: Optional[bool] = None
    connections_visible: Optional[bool] = None
    activity_status_visible: Optional[bool] = None
    allow_messages_from_anyone: Optional[bool] = None
    notification_preview: Optional[bool] = None
    notification_preferences: Optional[dict] = None
    show_typing_indicator: Optional[bool] = None

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
    linkedin_url: Optional[str]
    twitter_url: Optional[str]
    instagram_url: Optional[str]
    github_url: Optional[str]
    is_verified: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_active_at: Optional[datetime]

# Work Experience Models
class WorkExperienceCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    is_remote: bool = False
    description: Optional[str] = Field(None, max_length=1000)

    @validator('end_date')
    def end_date_after_start(cls, v, values):
        if v and 'start_date' in values and values['start_date'] and v < values['start_date']:
            raise ValueError('End date must be after start date')
        return v

class WorkExperienceUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    is_remote: Optional[bool] = None
    description: Optional[str] = Field(None, max_length=1000)

class WorkExperienceResponse(BaseModel):
    id: str
    user_id: str
    title: Optional[str]
    company: str
    location: Optional[str]
    start_date: date
    end_date: Optional[date]
    is_current: bool
    is_remote: bool
    description: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

# Education Models
class EducationCreate(BaseModel):
    institution: str
    degree: str
    field_of_study: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    grade: Optional[str] = None
    description: Optional[str] = Field(None, max_length=1000)

    @validator('end_date')
    def end_date_after_start(cls, v, values):
        if v and 'start_date' in values and values['start_date'] and v < values['start_date']:
            raise ValueError('End date must be after start date')
        return v

class EducationUpdate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    grade: Optional[str] = None
    description: Optional[str] = Field(None, max_length=1000)

class EducationResponse(BaseModel):
    id: str
    user_id: str
    institution: str
    degree: str
    field_of_study: Optional[str]
    start_date: date
    end_date: Optional[date]
    is_current: bool
    grade: Optional[str]
    description: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

# User Skills Models
class SkillCreate(BaseModel):
    skill: str = Field(..., min_length=1, max_length=50)

class SkillResponse(BaseModel):
    id: str
    user_id: str
    skill: str
    endorsement_count: int
