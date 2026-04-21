from fastapi import APIRouter, HTTPException, Depends, Query
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.message import MessageCreate, MessageSend, MessageUpdate, MessageResponse, ConversationResponse, ReactionCreate
from typing import List
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/messages", tags=["Messages"])
EDIT_WINDOW_MINUTES = 15
MAX_MESSAGE_EDITS = 3

def ensure_user_exists(user_id: str):
    """Ensure a users row exists for auth user id to avoid FK failures in messaging."""
    try:
        exists = supabase.table("users").select("id").eq("id", user_id).limit(1).execute()
        if exists.data:
            return

        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        auth_user = auth_user_resp.user if auth_user_resp else None

        email = (auth_user.email if auth_user and auth_user.email else f"{user_id[:8]}@placeholder.local")
        username = f"user_{user_id[:8]}"
        metadata = auth_user.user_metadata if auth_user else {}
        first_name = metadata.get("first_name") or "User"
        last_name = metadata.get("last_name") or username

        supabase.table("users").insert({
            "id": user_id,
            "email": email,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "is_verified": False,
        }).execute()
    except Exception as e:
        print(f"ensure_user_exists failed for {user_id}: {e}")

def _to_utc_datetime(raw_ts):
    """Parse DB timestamp into timezone-aware UTC datetime."""
    if isinstance(raw_ts, datetime):
        dt = raw_ts
    else:
        ts = str(raw_ts)
        # Supabase may return 'Z' suffixed strings.
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        dt = datetime.fromisoformat(ts)

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

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
    """Enrich conversation with participants and last message.

    This function is intentionally resilient: a failure in one lookup should not
    drop user identity data or break the whole conversation payload.
    """
    conv["participants"] = conv.get("participants") or []
    conv["user"] = conv.get("user")
    conv["last_message"] = conv.get("last_message")
    conv["unread_count"] = conv.get("unread_count") or 0

    participant_ids = []
    try:
        participants_data = supabase.table("conversation_participants").select("user_id").eq("conversation_id", conv["id"]).execute()
        participant_ids = [p["user_id"] for p in (participants_data.data or []) if p.get("user_id") != user_id]
    except Exception as e:
        print(f"Error loading participants for conversation {conv.get('id')}: {e}")

    if participant_ids:
        try:
            users = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", participant_ids).execute()
            participants = users.data or []

            # If some participant profiles are missing, try to auto-bootstrap and refetch.
            found_ids = {u.get("id") for u in participants}
            missing_ids = [pid for pid in participant_ids if pid not in found_ids]
            if missing_ids:
                for pid in missing_ids:
                    ensure_user_exists(pid)
                retry_users = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", participant_ids).execute()
                participants = retry_users.data or participants

            conv["participants"] = participants
            conv["user"] = conv["participants"][0] if conv["participants"] else None
        except Exception as e:
            print(f"Error loading participant profiles for conversation {conv.get('id')}: {e}")
            # Attempt per-user fallback so one bad id does not drop all names.
            recovered_participants = []
            for pid in participant_ids:
                try:
                    profile = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").eq("id", pid).maybe_single().execute()
                    if profile and profile.data:
                        recovered_participants.append(profile.data)
                        continue
                    ensure_user_exists(pid)
                    profile_retry = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").eq("id", pid).maybe_single().execute()
                    if profile_retry and profile_retry.data:
                        recovered_participants.append(profile_retry.data)
                        continue
                except Exception:
                    pass

                recovered_participants.append({"id": pid, "username": f"user_{str(pid)[:8]}"})

            if not conv.get("participants"):
                conv["participants"] = recovered_participants
            if not conv.get("user") and conv["participants"]:
                conv["user"] = conv["participants"][0]

    # Last resort: if profile lookup totally failed, guarantee at least an id so
    # the frontend never shows "Unknown User".
    if not conv.get("user") and participant_ids:
        fallback = {
            "id": participant_ids[0],
            "username": f"user_{str(participant_ids[0])[:8]}",
            "first_name": "User",
            "last_name": str(participant_ids[0])[:8],
        }
        conv["user"] = fallback
        if not conv.get("participants"):
            conv["participants"] = [fallback]

    try:
        last_msg = supabase.table("messages").select("*").eq("conversation_id", conv["id"]).order("created_at", desc=True).limit(1).execute()
        conv["last_message"] = last_msg.data[0] if (last_msg.data or []) else None
    except Exception as e:
        print(f"Error loading last message for conversation {conv.get('id')}: {e}")

    try:
        unread = supabase.table("messages").select("id", count="exact").eq("conversation_id", conv["id"]).eq("is_read", False).neq("sender_id", user_id).execute()
        conv["unread_count"] = unread.count if unread.count else 0
    except Exception as e:
        print(f"Warning: messages unread_count query failed for {conv.get('id')}: {e}")

    return conv

def _conversation_sort_key(conv: dict):
    last_message = conv.get("last_message")
    if isinstance(last_message, dict):
        return last_message.get("created_at") or conv.get("created_at") or ""
    return conv.get("created_at") or ""

@router.post("")
def send_message(payload: MessageCreate, user_id: str = Depends(require_auth)):
    """Send a new message (creates conversation if needed)"""
    try:
        ensure_user_exists(user_id)
        ensure_user_exists(payload.receiver_id)

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

        # Best-effort sender enrichment; never fail send after successful insert.
        try:
            sender = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", user_id).single().execute()
            message.data[0]["sender"] = sender.data if sender.data else {"id": user_id}
        except Exception as e:
            print(f"Warning: sender enrichment failed after send for {user_id}: {e}")
            message.data[0]["sender"] = {"id": user_id}
        
        # TODO: Create notification for receiver
        # TODO: Emit real-time event for receiver
        
        return {"message": "Message sent", "data": message.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/send")
def send_message_to_conversation(payload: MessageSend, user_id: str = Depends(require_auth)):
    """Send message to existing conversation"""
    try:
        ensure_user_exists(user_id)

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

        # Best-effort sender enrichment; never fail send after successful insert.
        try:
            sender = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", user_id).single().execute()
            message.data[0]["sender"] = sender.data if sender.data else {"id": user_id}
        except Exception as e:
            print(f"Warning: sender enrichment failed after send for {user_id}: {e}")
            message.data[0]["sender"] = {"id": user_id}
        
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
        
        # Enrich each conversation — per-item catch so one bad conv never 400s the whole list
        enriched = []
        for conv in conversations.data:
            try:
                enriched.append(enrich_conversation(conv, user_id))
            except Exception as e:
                print(f"Warning: enrich_conversation failed for {conv.get('id')}: {e}")
                enriched.append(conv)

        # Sort by last message time (null-safe)
        enriched.sort(key=_conversation_sort_key, reverse=True)
        
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
        
        message_ids = [m["id"] for m in messages.data]

        # Bulk fetch reactions for all messages
        reactions_data = supabase.table("message_reactions").select("*").in_("message_id", message_ids).execute()
        reactions_by_msg: dict = {}
        for r in (reactions_data.data or []):
            reactions_by_msg.setdefault(r["message_id"], []).append(r)

        # Enrich with sender info and reactions
        for msg in messages.data:
            sender = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", msg["sender_id"]).single().execute()
            msg["sender"] = sender.data if sender.data else None
            msg["reactions"] = reactions_by_msg.get(msg["id"], [])

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
        # Non-critical path: do not break chat UX if read-marking fails intermittently.
        print(f"Warning: mark_conversation_as_read failed for {conversation_id}, user {user_id}: {e}")
        return {"message": "Messages marked as read"}

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

@router.put("/messages/{message_id}")
def edit_message(message_id: str, payload: MessageUpdate, user_id: str = Depends(require_auth)):
    """Edit a message (sender only)"""
    try:
        message = supabase.table("messages").select("id, conversation_id, sender_id, created_at, edit_count").eq("id", message_id).single().execute()

        if not message.data:
            raise HTTPException(status_code=404, detail="Message not found")

        if message.data["sender_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the sender can edit this message")

        current_edit_count = int(message.data.get("edit_count") or 0)
        if current_edit_count >= MAX_MESSAGE_EDITS:
            raise HTTPException(
                status_code=403,
                detail=f"Message can only be edited up to {MAX_MESSAGE_EDITS} times",
            )

        # Restrict edits to a short time window from creation.
        message_created_at = _to_utc_datetime(message.data["created_at"])
        edit_deadline = message_created_at + timedelta(minutes=EDIT_WINDOW_MINUTES)
        if datetime.now(timezone.utc) > edit_deadline:
            raise HTTPException(
                status_code=403,
                detail=f"Message can only be edited within {EDIT_WINDOW_MINUTES} minutes of sending",
            )

        # Lock edits once the other participant has replied after this message.
        reply_after = (
            supabase.table("messages")
            .select("id")
            .eq("conversation_id", message.data["conversation_id"])
            .neq("sender_id", user_id)
            .gt("created_at", message.data["created_at"])
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        if reply_after.data:
            raise HTTPException(
                status_code=403,
                detail="Cannot edit this message because the recipient has already replied",
            )

        updated = (
            supabase.table("messages")
            .update({
                "content": payload.content,
                "edited_at": datetime.now(timezone.utc).isoformat(),
                "edit_count": current_edit_count + 1,
            })
            .eq("id", message_id)
            .execute()
        )

        if not updated.data:
            raise HTTPException(status_code=404, detail="Message not found")

        sender = supabase.table("users").select("id, username, first_name, last_name, avatar_url").eq("id", user_id).single().execute()
        updated.data[0]["sender"] = sender.data if sender.data else None

        return {"message": "Message updated", "data": updated.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/messages/{message_id}/reactions")
def toggle_reaction(
    message_id: str,
    payload: ReactionCreate,
    user_id: str = Depends(require_auth),
):
    """Add a reaction. If the same emoji already exists for this user, remove it (toggle)."""
    try:
        existing = supabase.table("message_reactions").select("id").eq("message_id", message_id).eq("user_id", user_id).eq("emoji", payload.emoji).execute()
        if existing.data:
            supabase.table("message_reactions").delete().eq("id", existing.data[0]["id"]).execute()
            return {"action": "removed", "emoji": payload.emoji}
        result = supabase.table("message_reactions").insert({"message_id": message_id, "user_id": user_id, "emoji": payload.emoji}).execute()
        return {"action": "added", "emoji": payload.emoji, "data": result.data[0] if result.data else {}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/messages/{message_id}/reactions/{emoji}")
def remove_reaction(
    message_id: str,
    emoji: str,
    user_id: str = Depends(require_auth),
):
    """Explicitly remove a specific reaction."""
    try:
        supabase.table("message_reactions").delete().eq("message_id", message_id).eq("user_id", user_id).eq("emoji", emoji).execute()
        return {"message": "Reaction removed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/messages/{message_id}")
def delete_message(message_id: str, user_id: str = Depends(require_auth)):
    """Delete a message (sender only)"""
    try:
        message = supabase.table("messages").select("id, sender_id").eq("id", message_id).single().execute()

        if not message.data:
            raise HTTPException(status_code=404, detail="Message not found")

        if message.data["sender_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the sender can delete this message")

        supabase.table("messages").delete().eq("id", message_id).execute()
        return {"message": "Message deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/unread-count")
def get_unread_count(user_id: str = Depends(require_auth)):
    """Get total unread message count. Returns 0 on timeout instead of error."""
    try:
        # Get all conversations
        participant_data = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()
        
        if not participant_data.data:
            return {"count": 0}
        
        conversation_ids = [p["conversation_id"] for p in participant_data.data]
        
        # Count unread messages
        unread = supabase.table("messages").select("id", count="exact").in_("conversation_id", conversation_ids).eq("is_read", False).neq("sender_id", user_id).execute()
        
        return {"count": unread.count if unread.count else 0}
    except Exception as e:
        # Return 0 on timeout rather than 503 — unread badge will be empty but won't error
        print(f"Warning: messages unread_count query failed for {user_id}: {e}")
        return {"count": 0}

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
