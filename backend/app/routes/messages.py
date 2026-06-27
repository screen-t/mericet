from fastapi import APIRouter, HTTPException, Depends, Query, Request
from app.middleware.auth import require_auth
from app.deps import get_message_repo, get_user_repo, get_connection_repo, get_auth_service
from app.middleware.rate_limit import limiter, WRITE_LIMIT
from app.routes.profile import _ensure_user_exists
from app.models.message import MessageCreate, MessageSend, MessageUpdate, MessageResponse, ConversationResponse, ReactionCreate
from typing import List
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/messages", tags=["Messages"])
EDIT_WINDOW_MINUTES = 15
MAX_MESSAGE_EDITS = 3

USER_PROFILE_FIELDS = "id, username, first_name, last_name, avatar_url, headline"
SENDER_FIELDS = "id, username, first_name, last_name, avatar_url"


def _is_blocked_either_direction(conn_repo, user_id: str, other_user_id: str) -> bool:
    """Return True if either user has blocked the other."""
    if not other_user_id:
        return False
    try:
        return (conn_repo.is_blocked(user_id, other_user_id)
                or conn_repo.is_blocked(other_user_id, user_id))
    except Exception:
        return False


def _blocked_message_detail(conn_repo, user_id: str, other_user_id: str) -> str | None:
    """Return a user-facing message for blocked chat attempts, preserving who blocked whom."""
    if not other_user_id:
        return None
    try:
        if conn_repo.is_blocked(user_id, other_user_id):
            return "You blocked this user, you cannot send a message"
        if conn_repo.is_blocked(other_user_id, user_id):
            return "You cannot send a message"
        return None
    except Exception:
        return None


def _is_connected(conn_repo, user_id: str, other_user_id: str) -> bool:
    if not other_user_id:
        return False
    try:
        row = conn_repo.get_between(user_id, other_user_id)
        return row is not None and row.get("status") == "accepted"
    except Exception:
        return False


def _can_message(conn_repo, user_repo, sender_id: str, receiver_id: str) -> bool:
    if _is_connected(conn_repo, sender_id, receiver_id):
        return True
    receiver = user_repo.get_by_id(receiver_id, "allow_messages_from_anyone")
    if receiver and receiver.get("allow_messages_from_anyone"):
        return True
    return False


def _get_other_participant(msg_repo, conversation_id: str, user_id: str) -> str | None:
    try:
        ids = msg_repo.get_other_participant_ids(conversation_id, user_id)
        return ids[0] if ids else None
    except Exception:
        return None


def _to_utc_datetime(raw_ts):
    """Parse DB timestamp into timezone-aware UTC datetime."""
    if isinstance(raw_ts, datetime):
        dt = raw_ts
    else:
        ts = str(raw_ts)
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        dt = datetime.fromisoformat(ts)

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _user_placeholder(uid: str) -> dict:
    return {
        "id": uid,
        "username": f"user_{uid[:8]}",
        "first_name": "User",
        "last_name": uid[:8],
    }


def get_or_create_conversation(msg_repo, user1_id: str, user2_id: str):
    """Get existing conversation or create new one between two users."""
    try:
        existing_id = msg_repo.find_conversation_between(user1_id, user2_id)
        if existing_id:
            return existing_id

        # Create new conversation
        new_conv = msg_repo.create_conversation()
        conversation_id = new_conv["id"]

        for uid in [user1_id, user2_id]:
            try:
                msg_repo.add_participant(conversation_id, uid)
            except Exception as e:
                print(f"Warning: failed to insert participant {uid} for conv {conversation_id}: {e}")

        return conversation_id
    except Exception as e:
        raise Exception(f"Error creating conversation: {str(e)}")


def _conversation_sort_key(conv: dict):
    last_message = conv.get("last_message")
    if isinstance(last_message, dict):
        return last_message.get("created_at") or conv.get("created_at") or ""
    return conv.get("created_at") or ""


@router.post("")
def send_message(
    payload: MessageCreate,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
    user_repo=Depends(get_user_repo),
    conn_repo=Depends(get_connection_repo),
    auth_service=Depends(get_auth_service),
):
    """Send a new message (creates conversation if needed)"""
    try:
        _ensure_user_exists(user_id, user_repo, auth_service)

        other_user_id = payload.receiver_id
        if payload.conversation_id:
            participant_other = _get_other_participant(msg_repo, payload.conversation_id, user_id)
            if participant_other:
                other_user_id = participant_other

        # If either party has blocked the other, forbid messaging.
        block_detail = _blocked_message_detail(conn_repo, user_id, other_user_id)
        if block_detail:
            raise HTTPException(status_code=403, detail=block_detail)
        if not _can_message(conn_repo, user_repo, user_id, other_user_id):
            raise HTTPException(status_code=403, detail="Messaging is limited to connections")

        # Fast path: if the client already knows the conversation_id, skip the expensive
        # get_or_create_conversation() lookup entirely.  Only verify the user is a participant
        # (cheap single-row query) to prevent sending to arbitrary conversations.
        if payload.conversation_id:
            if not msg_repo.is_participant(payload.conversation_id, user_id):
                # Soft-fail: participant row may be missing due to earlier data gap -- check
                # via messages table before hard-rejecting.
                if not msg_repo.user_has_messages_in(payload.conversation_id, user_id):
                    raise HTTPException(status_code=403, detail="Not a participant in this conversation")
            conversation_id = payload.conversation_id
        else:
            _ensure_user_exists(payload.receiver_id, user_repo, auth_service)
            conversation_id = get_or_create_conversation(msg_repo, user_id, payload.receiver_id)

        # Create message
        message_data = {
            "conversation_id": conversation_id,
            "sender_id": user_id,
            "content": payload.content,
            "is_read": False,
        }

        message = msg_repo.create_message(message_data)

        # Best-effort sender enrichment; never fail send after successful insert.
        try:
            sender = user_repo.get_by_id(user_id, SENDER_FIELDS)
            message["sender"] = sender if sender else {"id": user_id}
        except Exception as e:
            print(f"Warning: sender enrichment failed after send for {user_id}: {e}")
            message["sender"] = {"id": user_id}

        return {"message": "Message sent", "data": message}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/send")
@limiter.limit(WRITE_LIMIT)
def send_message_to_conversation(
    request: Request,
    payload: MessageSend,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
    user_repo=Depends(get_user_repo),
    conn_repo=Depends(get_connection_repo),
    auth_service=Depends(get_auth_service),
):
    """Send message to existing conversation"""
    try:
        _ensure_user_exists(user_id, user_repo, auth_service)

        # Verify user is participant
        if not msg_repo.is_participant(payload.conversation_id, user_id):
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")

        other_user_id = _get_other_participant(msg_repo, payload.conversation_id, user_id)
        block_detail = _blocked_message_detail(conn_repo, user_id, other_user_id)
        if block_detail:
            raise HTTPException(status_code=403, detail=block_detail)
        if not _can_message(conn_repo, user_repo, user_id, other_user_id):
            raise HTTPException(status_code=403, detail="Messaging is limited to connections")

        # Create message
        message_data = {
            "conversation_id": payload.conversation_id,
            "sender_id": user_id,
            "content": payload.content,
            "is_read": False,
        }

        message = msg_repo.create_message(message_data)

        # Best-effort sender enrichment; never fail send after successful insert.
        try:
            sender = user_repo.get_by_id(user_id, SENDER_FIELDS)
            message["sender"] = sender if sender else {"id": user_id}
        except Exception as e:
            print(f"Warning: sender enrichment failed after send for {user_id}: {e}")
            message["sender"] = {"id": user_id}

        return {"message": "Message sent", "data": message}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
    user_repo=Depends(get_user_repo),
    auth_service=Depends(get_auth_service),
):
    """Get all conversations for the user"""
    try:
        # 1. Get conversation IDs where current user is a participant
        conversation_ids = msg_repo.get_user_conversation_ids(user_id)
        if not conversation_ids:
            return []

        # 2. Batch-fetch ALL other participants + current user's pin state
        try:
            other_rows = msg_repo.get_all_other_participants(conversation_ids, user_id)
        except Exception as e:
            print(f"Warning: others_data query failed: {e}")
            other_rows = []

        try:
            pinned_by_conv = msg_repo.get_pin_states(conversation_ids, user_id)
        except Exception:
            pinned_by_conv = {}

        # 3. Batch-fetch ALL their profiles in a single users query
        other_ids = list({r["user_id"] for r in other_rows if r.get("user_id")})
        user_by_id: dict = {}
        if other_ids:
            try:
                profiles = user_repo.get_many_by_ids(other_ids, USER_PROFILE_FIELDS)
                user_by_id = {u["id"]: u for u in profiles}
            except Exception as e:
                print(f"Warning: profiles batch query failed: {e}")

        # 4. Build conv_id -> other user map
        conv_to_user: dict = {}
        for row in other_rows:
            cid = row.get("conversation_id")
            uid = row.get("user_id")
            if not cid or not uid or cid in conv_to_user:
                continue
            conv_to_user[cid] = user_by_id.get(uid) or _user_placeholder(uid)

        # 4b. Fallback: for any conversation_id missing from conv_to_user, query individually
        missing_cids = [cid for cid in conversation_ids if cid not in conv_to_user]
        for mcid in missing_cids:
            try:
                ids = msg_repo.get_other_participant_ids(mcid, user_id)
                if ids:
                    uid = ids[0]
                    _ensure_user_exists(uid, user_repo, auth_service)
                    profile = user_repo.get_by_id(uid, USER_PROFILE_FIELDS)
                    conv_to_user[mcid] = profile if profile else _user_placeholder(uid)
            except Exception as e:
                print(f"Warning: fallback user lookup failed for conv {mcid}: {e}")

        # 4c. Last-resort fallback: infer the other user from the most recent message's
        # sender_id.
        still_missing = [cid for cid in conversation_ids if cid not in conv_to_user]
        if still_missing:
            try:
                sender_by_conv: dict = {}
                for cid in still_missing:
                    try:
                        sender_id = msg_repo.get_sender_id_from_last_other_message(cid, user_id)
                        if sender_id:
                            sender_by_conv[cid] = sender_id
                    except Exception as e:
                        print(f"Warning: sender inference failed for conv {cid}: {e}")

                inferred_ids = list(set(sender_by_conv.values()))
                inferred_profiles: dict = {}
                if inferred_ids:
                    try:
                        profiles = user_repo.get_many_by_ids(inferred_ids, USER_PROFILE_FIELDS)
                        inferred_profiles = {u["id"]: u for u in profiles}
                    except Exception:
                        pass

                for cid, sender_id in sender_by_conv.items():
                    profile = inferred_profiles.get(sender_id)
                    if not profile:
                        _ensure_user_exists(sender_id, user_repo, auth_service)
                        try:
                            profile = user_repo.get_by_id(sender_id, USER_PROFILE_FIELDS)
                        except Exception:
                            pass
                    conv_to_user[cid] = profile or _user_placeholder(sender_id)
                    # Repair the missing conversation_participants row
                    try:
                        msg_repo.add_participant(cid, sender_id)
                        print(f"Repaired missing conversation_participants row: conv={cid} user={sender_id}")
                    except Exception as repair_err:
                        print(f"Note: conversation_participants repair skipped for conv {cid}: {repair_err}")
            except Exception as e:
                print(f"Warning: last-message sender fallback failed: {e}")

        # 5. Fetch conversations and enrich with pre-built data
        conversations = msg_repo.get_conversations_by_ids(conversation_ids)
        enriched = []
        for conv in conversations:
            try:
                cid = conv["id"]
                other = conv_to_user.get(cid)
                conv["user"] = other
                conv["participants"] = [other] if other else []
                conv["is_pinned"] = pinned_by_conv.get(cid, False)

                # Last message
                try:
                    conv["last_message"] = msg_repo.get_last_message(cid)
                except Exception:
                    conv.setdefault("last_message", None)

                # Emergency inline fallback: if user is still null but we have a last_message
                # with a sender that isn't us, use them as the conversation partner.
                if not conv.get("user") and isinstance(conv.get("last_message"), dict):
                    lm_sender = conv["last_message"].get("sender_id")
                    if lm_sender and lm_sender != user_id:
                        try:
                            profile = user_repo.get_by_id(lm_sender, USER_PROFILE_FIELDS)
                            fallback_user = profile if profile else _user_placeholder(lm_sender)
                        except Exception:
                            fallback_user = _user_placeholder(lm_sender)
                        conv["user"] = fallback_user
                        conv["participants"] = [fallback_user]

                # Unread count -- exclude soft-deleted messages
                try:
                    conv["unread_count"] = msg_repo.count_unread(cid, user_id)
                except Exception:
                    conv.setdefault("unread_count", 0)

                enriched.append(conv)
            except Exception as e:
                print(f"Warning: conversation enrich failed for {conv.get('id')}: {e}")
                enriched.append(conv)

        enriched.sort(key=lambda c: (c.get("is_pinned", False), _conversation_sort_key(c)), reverse=True)
        return enriched
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/conversations/{conversation_id}/pin")
def toggle_pin(
    conversation_id: str,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Toggle pinned state for the current user's conversation."""
    try:
        if not msg_repo.is_participant(conversation_id, user_id):
            raise HTTPException(status_code=404, detail="Conversation not found")
        new_state = msg_repo.toggle_pin(conversation_id, user_id)
        return {"is_pinned": new_state}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_conversation_messages(
    conversation_id: str,
    user_id: str = Depends(require_auth),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    msg_repo=Depends(get_message_repo),
    user_repo=Depends(get_user_repo),
):
    """Get messages from a conversation"""
    try:
        # Verify user is participant
        if not msg_repo.is_participant(conversation_id, user_id):
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")

        # Get messages
        messages = msg_repo.get_messages(conversation_id, limit, offset)

        message_ids = [m["id"] for m in messages]

        # Bulk fetch reactions for all messages
        reactions_by_msg: dict = {}
        try:
            reactions_by_msg = msg_repo.get_reactions(message_ids)
        except Exception:
            pass

        # Batch-fetch all unique senders in a single query
        sender_by_id: dict = {}
        sender_ids = list({msg["sender_id"] for msg in messages if msg.get("sender_id")})
        if sender_ids:
            try:
                senders_data = user_repo.get_many_by_ids(sender_ids, SENDER_FIELDS)
                sender_by_id = {u["id"]: u for u in senders_data}
            except Exception as e:
                print(f"Warning: batch sender fetch failed: {e}")

        # Enrich with sender info and reactions
        for msg in messages:
            msg["sender"] = sender_by_id.get(msg.get("sender_id"))
            msg["reactions"] = reactions_by_msg.get(msg["id"], [])

        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/conversations/{conversation_id}/read")
def mark_conversation_as_read(
    conversation_id: str,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Mark all messages in conversation as read.

    We intentionally do NOT 403 when a conversation_participants row is missing --
    that gap is a data-integrity issue we repair elsewhere. We verify participation
    by checking whether the user has sent or received any message in this conversation
    instead, which is a softer but still secure check.
    """
    try:
        # Verify user is either a listed participant OR has messages in this conversation.
        if not msg_repo.is_participant(conversation_id, user_id):
            # Fallback: user may have sent messages even without a participant row
            if not msg_repo.user_has_messages_in(conversation_id, user_id):
                # Also accept if any message in this conv is addressed to them (sender is other)
                if not msg_repo.has_messages_from_others(conversation_id, user_id):
                    # Truly not related to this conversation
                    return {"message": "Messages marked as read"}

        # Mark all messages from others as read
        msg_repo.mark_read(conversation_id, user_id)

        return {"message": "Messages marked as read"}
    except Exception as e:
        # Non-critical path: do not break chat UX if read-marking fails intermittently.
        print(f"Warning: mark_conversation_as_read failed for {conversation_id}, user {user_id}: {e}")
        return {"message": "Messages marked as read"}


@router.put("/messages/{message_id}/read")
def mark_message_as_read(
    message_id: str,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Mark a specific message as read"""
    try:
        # Get message
        message = msg_repo.get_message_fields(message_id, "conversation_id, sender_id")

        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Verify user is participant (not sender)
        if message["sender_id"] == user_id:
            raise HTTPException(status_code=400, detail="Cannot mark own message as read")

        if not msg_repo.is_participant(message["conversation_id"], user_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        # Mark as read
        msg_repo.update_message(message_id, {"is_read": True})

        return {"message": "Message marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/messages/{message_id}")
def edit_message(
    message_id: str,
    payload: MessageUpdate,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
    user_repo=Depends(get_user_repo),
):
    """Edit a message (sender only)"""
    try:
        message = msg_repo.get_message_fields(
            message_id, "id, conversation_id, sender_id, created_at, edit_count"
        )

        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if message["sender_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the sender can edit this message")

        current_edit_count = int(message.get("edit_count") or 0)
        if current_edit_count >= MAX_MESSAGE_EDITS:
            raise HTTPException(
                status_code=403,
                detail=f"Message can only be edited up to {MAX_MESSAGE_EDITS} times",
            )

        # Restrict edits to a short time window from creation.
        message_created_at = _to_utc_datetime(message["created_at"])
        edit_deadline = message_created_at + timedelta(minutes=EDIT_WINDOW_MINUTES)
        if datetime.now(timezone.utc) > edit_deadline:
            raise HTTPException(
                status_code=403,
                detail=f"Message can only be edited within {EDIT_WINDOW_MINUTES} minutes of sending",
            )

        # Lock edits once the other participant has replied after this message.
        if msg_repo.has_reply_after(
            message["conversation_id"], user_id, message["created_at"]
        ):
            raise HTTPException(
                status_code=403,
                detail="Cannot edit this message because the recipient has already replied",
            )

        updated = msg_repo.update_message(message_id, {
            "content": payload.content,
            "edited_at": datetime.now(timezone.utc).isoformat(),
            "edit_count": current_edit_count + 1,
        })

        if not updated:
            raise HTTPException(status_code=404, detail="Message not found")

        sender = user_repo.get_by_id(user_id, SENDER_FIELDS)
        updated["sender"] = sender if sender else None

        return {"message": "Message updated", "data": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/messages/{message_id}/reactions")
def toggle_reaction(
    message_id: str,
    payload: ReactionCreate,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Add a reaction. If the same emoji already exists for this user, remove it (toggle)."""
    try:
        action = msg_repo.toggle_reaction(message_id, user_id, payload.emoji)
        if action == "removed":
            return {"action": "removed", "emoji": payload.emoji}
        return {"action": "added", "emoji": payload.emoji, "data": {}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/messages/{message_id}/reactions/{emoji}")
def remove_reaction(
    message_id: str,
    emoji: str,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Explicitly remove a specific reaction."""
    try:
        msg_repo.remove_reaction(message_id, user_id, emoji)
        return {"message": "Reaction removed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


DELETE_WINDOW_MINUTES = 15


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: str,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Soft-delete a message for everyone (sender only, within 15 minutes of sending)"""
    try:
        message = msg_repo.get_message_fields(
            message_id, "id, sender_id, created_at, is_deleted"
        )

        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if message["sender_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the sender can delete this message")

        if message.get("is_deleted"):
            raise HTTPException(status_code=400, detail="Message already deleted")

        created_at = _to_utc_datetime(message["created_at"])
        elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
        if elapsed > DELETE_WINDOW_MINUTES * 60:
            raise HTTPException(
                status_code=403,
                detail=f"Messages can only be deleted within {DELETE_WINDOW_MINUTES} minutes of sending",
            )

        msg_repo.soft_delete_message(message_id)

        return {"message": "Message deleted for everyone"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/unread-count")
def get_unread_count(
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Get count of conversations (not individual messages) that have unread messages.
    This is what the notification badge should show -- e.g. '3' means 3 chats have
    unread messages, not that there are 3 total unread messages.
    Returns 0 on timeout instead of error.
    """
    try:
        conversation_ids = msg_repo.get_user_conversation_ids(user_id)
        if not conversation_ids:
            return {"count": 0}

        conversations_with_unread = msg_repo.count_total_unread(user_id, conversation_ids)
        return {"count": conversations_with_unread}
    except Exception as e:
        print(f"Warning: messages unread_count query failed for {user_id}: {e}")
        return {"count": 0}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    user_id: str = Depends(require_auth),
    msg_repo=Depends(get_message_repo),
):
    """Delete/leave a conversation"""
    try:
        # Verify user is participant
        if not msg_repo.is_participant(conversation_id, user_id):
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")

        # Remove user from conversation
        msg_repo.remove_participant(conversation_id, user_id)

        # Check if conversation has any participants left
        remaining = msg_repo.count_participants(conversation_id)

        # If no participants left, delete the conversation and messages
        if remaining == 0:
            msg_repo.delete_conversation(conversation_id)

        return {"message": "Conversation deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
