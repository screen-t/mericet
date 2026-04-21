from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ReactionCreate(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=20)

class MessageCreate(BaseModel):
    receiver_id: str
    content: str = Field(..., min_length=1, max_length=2000)

class MessageSend(BaseModel):
    conversation_id: str
    content: str = Field(..., min_length=1, max_length=2000)

class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    is_read: bool
    created_at: datetime
    edited_at: Optional[datetime] = None
    edit_count: int = 0
    sender: Optional[dict] = None
    reactions: List[dict] = []

class ConversationResponse(BaseModel):
    id: str
    created_at: datetime
    participants: List[dict] = []
    user: Optional[dict] = None  # The other participant
    last_message: Optional[dict] = None
    unread_count: int = 0
