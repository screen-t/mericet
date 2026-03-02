from fastapi import APIRouter, HTTPException, Depends, Query
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.message import MessageCreate, MessageSend, MessageResponse, ConversationResponse
from typing import List

router = APIRouter(prefix="/messages", tags=["Messages"])

def get_or_create_conversation(user1_id: str, user2_id: str):
    """Get existing conversation or create new one between two users"""
    try:
        # Check if conversation exists
        existing = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user1_id).execute()
        
        if existing.data:
            for conv in existing.data:
                # Check if user2 is in this conversation
                check = supabase.table("conversation_participants").select("*").eq("conversation_id", conv["conversation_id"]).eq("user_id", user2_id).execute()
                
                if check.data:
                    return conv["conversation_id"]
        
        # Create new conversation
        new_conv = supabase.table("conversations").insert({}).execute()
        conversation_id = new_conv.data[0]["id"]
        
        # Add participants
        participants = [
            {"conversation_id": conversation_id, "user_id": user1_id},
            {"conversation_id": conversation_id, "user_id": user2_id}
        ]
        supabase.table("conversation_participants").insert(participants).execute()
        
        return conversation_id
    except Exception as e:
        raise Exception(f"Error creating conversation: {str(e)}")

def enrich_conversation(conv: dict, user_id: str):
    """Enrich conversation with participants and last message"""
    try:
        # Get participants
        participants_data = supabase.table("conversation_participants").select("user_id").eq("conversation_id", conv["id"]).execute()
        
        participant_ids = [p["user_id"] for p in participants_data.data if p["user_id"] != user_id]
        
        if participant_ids:
            users = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", participant_ids).execute()
            conv["participants"] = users.data
            # Set `user` to the first other participant (for direct message display)
            conv["user"] = users.data[0] if users.data else None
        else:
            conv["participants"] = []
            conv["user"] = None
        
        # Get last message
        last_msg = supabase.table("messages").select("*").eq("conversation_id", conv["id"]).order("created_at", desc=True).limit(1).execute()
        conv["last_message"] = last_msg.data[0] if last_msg.data else None
        
        # Count unread messages
        unread = supabase.table("messages").select("id", count="exact").eq("conversation_id", conv["id"]).eq("is_read", False).neq("sender_id", user_id).execute()
        conv["unread_count"] = unread.count if unread.count else 0
        
        return conv
    except Exception as e:
        print(f"Error enriching conversation: {e}")
        return conv

@router.post("")
def send_message(payload: MessageCreate, user_id: str = Depends(require_auth)):
    """Send a new message (creates conversation if needed)"""
    try:
        # Get or create conversation
        conversation_id = get_or_create_conversation(user_id, payload.receiver_id)
        
        # Create message
        message_data = {
            "conversation_id": conversation_id,
            "sender_id": user_id,
            "content": payload.content,
            "is_read": False
        }
        
        message = supabase.table("messages").insert(message_data).execute()
        
        # Get sender info
        sender = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", user_id).single().execute()
        message.data[0]["sender"] = sender.data
        
        # TODO: Create notification for receiver
        # TODO: Emit real-time event for receiver
        
        return {"message": "Message sent", "data": message.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/send")
def send_message_to_conversation(payload: MessageSend, user_id: str = Depends(require_auth)):
    """Send message to existing conversation"""
    try:
        # Verify user is participant
        participant = supabase.table("conversation_participants").select("*").eq("conversation_id", payload.conversation_id).eq("user_id", user_id).execute()
        
        if not participant.data:
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")
        
        # Create message
        message_data = {
            "conversation_id": payload.conversation_id,
            "sender_id": user_id,
            "content": payload.content,
            "is_read": False
        }
        
        message = supabase.table("messages").insert(message_data).execute()
        
        # Get sender info
        sender = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", user_id).single().execute()
        message.data[0]["sender"] = sender.data
        
        return {"message": "Message sent", "data": message.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(user_id: str = Depends(require_auth)):
    """Get all conversations for the user"""
    try:
        # Get conversation IDs where user is participant
        participant_data = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()
        
        if not participant_data.data:
            return []
        
        conversation_ids = [p["conversation_id"] for p in participant_data.data]
        
        # Get conversations
        conversations = supabase.table("conversations").select("*").in_("id", conversation_ids).order("created_at", desc=True).execute()
        
        # Enrich each conversation
        enriched = [enrich_conversation(conv, user_id) for conv in conversations.data]
        
        # Sort by last message time
        enriched.sort(key=lambda x: x.get("last_message", {}).get("created_at", x["created_at"]), reverse=True)
        
        return enriched
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_conversation_messages(
    conversation_id: str,
    user_id: str = Depends(require_auth),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get messages from a conversation"""
    try:
        # Verify user is participant
        participant = supabase.table("conversation_participants").select("*").eq("conversation_id", conversation_id).eq("user_id", user_id).execute()
        
        if not participant.data:
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")
        
        # Get messages
        messages = supabase.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        # Enrich with sender info
        for msg in messages.data:
            sender = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", msg["sender_id"]).single().execute()
            msg["sender"] = sender.data if sender.data else None
        
        return messages.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/conversations/{conversation_id}/read")
def mark_conversation_as_read(conversation_id: str, user_id: str = Depends(require_auth)):
    """Mark all messages in conversation as read"""
    try:
        # Verify user is participant
        participant = supabase.table("conversation_participants").select("*").eq("conversation_id", conversation_id).eq("user_id", user_id).execute()
        
        if not participant.data:
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")
        
        # Mark all messages from others as read
        supabase.table("messages").update({"is_read": True}).eq("conversation_id", conversation_id).neq("sender_id", user_id).eq("is_read", False).execute()
        
        return {"message": "Messages marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/messages/{message_id}/read")
def mark_message_as_read(message_id: str, user_id: str = Depends(require_auth)):
    """Mark a specific message as read"""
    try:
        # Get message
        message = supabase.table("messages").select("conversation_id, sender_id").eq("id", message_id).single().execute()
        
        if not message.data:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Verify user is participant (not sender)
        if message.data["sender_id"] == user_id:
            raise HTTPException(status_code=400, detail="Cannot mark own message as read")
        
        participant = supabase.table("conversation_participants").select("*").eq("conversation_id", message.data["conversation_id"]).eq("user_id", user_id).execute()
        
        if not participant.data:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Mark as read
        supabase.table("messages").update({"is_read": True}).eq("id", message_id).execute()
        
        return {"message": "Message marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/unread-count")
def get_unread_count(user_id: str = Depends(require_auth)):
    """Get total unread message count"""
    try:
        # Get all conversations
        participant_data = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()
        
        if not participant_data.data:
            return {"count": 0}
        
        conversation_ids = [p["conversation_id"] for p in participant_data.data]
        
        # Count unread messages
        unread = supabase.table("messages").select("id", count="exact").in_("conversation_id", conversation_ids).eq("is_read", False).neq("sender_id", user_id).execute()
        
        return {"count": unread.count if unread.count else 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user_id: str = Depends(require_auth)):
    """Delete/leave a conversation"""
    try:
        # Verify user is participant
        participant = supabase.table("conversation_participants").select("*").eq("conversation_id", conversation_id).eq("user_id", user_id).execute()
        
        if not participant.data:
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")
        
        # Remove user from conversation
        supabase.table("conversation_participants").delete().eq("conversation_id", conversation_id).eq("user_id", user_id).execute()
        
        # Check if conversation has any participants left
        remaining = supabase.table("conversation_participants").select("*").eq("conversation_id", conversation_id).execute()
        
        # If no participants left, delete the conversation and messages
        if not remaining.data:
            supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
            supabase.table("conversations").delete().eq("id", conversation_id).execute()
        
        return {"message": "Conversation deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
