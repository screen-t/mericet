from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
import re


class VerificationTier(str, Enum):
    none = "none"
    weak = "weak"      # Bronze
    mid = "mid"        # Silver
    strong = "strong"  # Gold


class VaultCategory(str, Enum):
    skill = "skill"
    work = "work"
    education = "education"
    project = "project"
    achievement = "achievement"
    tool = "tool"
    other = "other"


_POSEIDON_HEX_RE = re.compile(r'^(0x)?[0-9a-fA-F]{1,128}$')
_POSEIDON_DECIMAL_RE = re.compile(r'^[0-9]{1,128}$')


def _validate_poseidon_hash(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if not (_POSEIDON_HEX_RE.match(v) or _POSEIDON_DECIMAL_RE.match(v)):
        raise ValueError("Invalid Poseidon hash format: must be a hex (0x...) or decimal commitment string")
    return v


# Request / Response models for Vault Items
class VaultItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: VaultCategory = VaultCategory.project
    description: Optional[str] = Field(None, max_length=5000)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    poseidon_hash: Optional[str] = Field(None, max_length=130)
    is_public: bool = True
    display_order: int = 0

    @field_validator("title")
    @classmethod
    def validate_title_non_empty(cls, v):
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Title cannot be blank or whitespace only")
        return cleaned

    @field_validator("poseidon_hash")
    @classmethod
    def validate_hash(cls, v):
        return _validate_poseidon_hash(v)


class VaultItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[VaultCategory] = None
    description: Optional[str] = Field(None, max_length=5000)
    metadata: Optional[Dict[str, Any]] = None
    poseidon_hash: Optional[str] = Field(None, max_length=130)
    is_public: Optional[bool] = None
    display_order: Optional[int] = None

    @field_validator("title")
    @classmethod
    def validate_title_non_empty(cls, v):
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Title cannot be blank or whitespace only")
            return cleaned
        return v

    @field_validator("poseidon_hash")
    @classmethod
    def validate_hash(cls, v):
        return _validate_poseidon_hash(v)


class VaultItemResponse(BaseModel):
    id: str
    user_id: str
    category: str
    title: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    poseidon_hash: Optional[str] = None
    verification_tier: VerificationTier = VerificationTier.none
    verification_metadata: Dict[str, Any] = Field(default_factory=dict)
    is_public: bool = True
    display_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Models for Connected Tools (Living Graph)
class ConnectedToolCreate(BaseModel):
    provider: str = Field(..., min_length=1, max_length=50)
    handle: str = Field(..., min_length=1, max_length=100)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v):
        allowed = {"github", "leetcode", "credly", "fueler", "google_search_console"}
        p = v.strip().lower()
        if p not in allowed:
            raise ValueError(f"Unsupported provider: '{p}'. Supported providers are: {', '.join(sorted(allowed))}")
        return p

    @field_validator("handle")
    @classmethod
    def validate_handle(cls, v):
        h = v.strip()
        if not h:
            raise ValueError("Handle cannot be empty")
        return h


class ConnectedToolResponse(BaseModel):
    id: str
    user_id: str
    provider: str
    handle: str
    auth_status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    last_synced_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Verification Request Model
class VerifyVaultItemRequest(BaseModel):
    proof_type: str = Field(..., max_length=50)
    evidence: Dict[str, Any] = Field(default_factory=dict)


# Living Graph Worker / Sync Models
class LivingGraphSyncSummary(BaseModel):
    status: str
    synced_tools: int = 0
    highlights_created: int = 0
    highlights_updated: int = 0
    highlights_filtered: int = 0
    errors: List[str] = Field(default_factory=list)
    diagnostics: Dict[str, Any] = Field(default_factory=dict)
    duration_ms: Optional[int] = None


class LivingGraphRunResponse(BaseModel):
    id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    duration_ms: Optional[int] = None
    total_tools_checked: int = 0
    synced_tools: int = 0
    highlights_created: int = 0
    highlights_updated: int = 0
    highlights_filtered: int = 0
    errors: List[Any] = Field(default_factory=list)
    diagnostics: Dict[str, Any] = Field(default_factory=dict)
