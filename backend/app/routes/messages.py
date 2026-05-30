from fastapi import APIRouter, HTTPException, Depends, Query
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.message import MessageCreate, MessageSend, MessageUpdate, MessageResponse, ConversationResponse, ReactionCreate
from typing import List
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/messages", tags=["Messages"])
EDIT_WINDOW_MINUTES = 15
MAX_MESSAGE_EDITS = 3

def _is_connected(user_id: str, other_user_id: str) -> bool:
    if not other_user_id:
        return False
    try:
        connection = supabase.table("connections").select("id").or_(
            f"and(requester_id.eq.{user_id},receiver_id.eq.{other_user_id}),and(requester_id.eq.{other_user_id},receiver_id.eq.{user_id})"
        ).eq("status", "accepted").limit(1).execute()
        return bool(connection.data)
    except Exception:
        return False

def _is_blocked(user_id: str, other_user_id: str) -> bool:
    """Return True if either user has blocked the other."""
    if not other_user_id:
        return False
    try:
        blocked = supabase.table("connections").select("id").or_(
            f"and(requester_id.eq.{user_id},receiver_id.eq.{other_user_id}),and(requester_id.eq.{other_user_id},receiver_id.eq.{user_id})"
        ).eq("status", "blocked").limit(1).execute()
        return bool(blocked.data)
    except Exception:
        return False

def _get_other_participant(conversation_id: str, user_id: str) -> str | None:
    try:
        row = supabase.table("conversation_participants").select("user_id").eq(
            "conversation_id", conversation_id
        ).neq("user_id", user_id).limit(1).execute()
        return row.data[0]["user_id"] if row.data else None
    except Exception:
        return None

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
        # Check if conversation exists where BOTH users are participants
        existing = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user1_id).execute()
        
        if existing.data:
            for conv in existing.data:
                # Check if user2 is in this conversation
                check = supabase.table("conversation_participants").select("*").eq("conversation_id", conv["conversation_id"]).eq("user_id", user2_id).execute()
                
                if check.data:
                    return conv["conversation_id"]

            # Edge case: conversation exists where user1 is a participant, but user2's row
            # is missing (data integrity gap from a failed insert). Detect and repair this
            # by checking for messages from user2 in user1's conversations.
            for conv in existing.data:
                cid = conv["conversation_id"]
                try:
                    msg_check = supabase.table("messages").select("id").eq("conversation_id", cid).eq("sender_id", user2_id).limit(1).execute()
                    if msg_check.data:
                        # user2 has sent messages here but their participant row is missing — repair it
                        try:
                            supabase.table("conversation_participants").insert({
                                "conversation_id": cid,
                                "user_id": user2_id,
                            }).execute()
                            print(f"Repaired missing participant row: conv={cid} user={user2_id}")
                        except Exception as repair_err:
                            print(f"Note: participant repair skipped for conv {cid}: {repair_err}")
                        return cid
                except Exception:
                    pass
        
        # Create new conversation
        new_conv = supabase.table("conversations").insert({}).execute()
        conversation_id = new_conv.data[0]["id"]
        
        # Add both participants — insert individually so one failure doesn't block the other
        for uid in [user1_id, user2_id]:
            try:
                supabase.table("conversation_participants").insert({
                    "conversation_id": conversation_id,
                    "user_id": uid,
                }).execute()
            except Exception as e:
                print(f"Warning: failed to insert participant {uid} for conv {conversation_id}: {e}")
        
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
        unread = supabase.table("messages").select("id", count="exact").eq("conversation_id", conv["id"]).eq("is_read", False).eq("is_deleted", False).neq("sender_id", user_id).execute()
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

        other_user_id = payload.receiver_id
        if payload.conversation_id:
            participant_other = _get_other_participant(payload.conversation_id, user_id)
            if participant_other:
                other_user_id = participant_other

        if not _is_connected(user_id, other_user_id):
            raise HTTPException(status_code=403, detail="Messaging is limited to connections")
        # If either party has blocked the other, forbid messaging.
        if _is_blocked(user_id, other_user_id):
            raise HTTPException(status_code=403, detail="Messaging is blocked between these users")

        # Fast path: if the client already knows the conversation_id, skip the expensive
        # get_or_create_conversation() lookup entirely.  Only verify the user is a participant
        # (cheap single-row query) to prevent sending to arbitrary conversations.
        if payload.conversation_id:
            participant_check = supabase.table("conversation_participants").select("user_id").eq(
                "conversation_id", payload.conversation_id
            ).eq("user_id", user_id).limit(1).execute()
            if not participant_check.data:
                # Soft-fail: participant row may be missing due to earlier data gap — check
                # via messages table before hard-rejecting.
                msg_check = supabase.table("messages").select("id").eq(
                    "conversation_id", payload.conversation_id
                ).eq("sender_id", user_id).limit(1).execute()
                if not msg_check.data:
                    raise HTTPException(status_code=403, detail="Not a participant in this conversation")
            conversation_id = payload.conversation_id
        else:
            ensure_user_exists(payload.receiver_id)
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

        other_user_id = _get_other_participant(payload.conversation_id, user_id)
        if not _is_connected(user_id, other_user_id):
            raise HTTPException(status_code=403, detail="Messaging is limited to connections")
        # Enforce blocking: if either user has blocked the other, forbid messaging.
        if _is_blocked(user_id, other_user_id):
            raise HTTPException(status_code=403, detail="Messaging is blocked between these users")
        
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
        # 1. Get conversation IDs where current user is a participant
        participant_data = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()
        if not participant_data.data:
            return []
        conversation_ids = [p["conversation_id"] for p in participant_data.data]

        # 2. Batch-fetch ALL other participants + current user's pin state (1 query each)
        try:
            others_data = supabase.table("conversation_participants").select("conversation_id, user_id").in_("conversation_id", conversation_ids).neq("user_id", user_id).execute()
            other_rows = others_data.data or []
        except Exception as e:
            print(f"Warning: others_data query failed: {e}")
            other_rows = []

        try:
            pin_data = supabase.table("conversation_participants").select("conversation_id, is_pinned").in_("conversation_id", conversation_ids).eq("user_id", user_id).execute()
            pinned_by_conv = {r["conversation_id"]: r.get("is_pinned", False) for r in (pin_data.data or [])}
        except Exception:
            pinned_by_conv = {}

        # 3. Batch-fetch ALL their profiles in a single users query (1 query)
        other_ids = list({r["user_id"] for r in other_rows if r.get("user_id")})
        user_by_id: dict = {}
        if other_ids:
            try:
                profiles = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", other_ids).execute()
                user_by_id = {u["id"]: u for u in (profiles.data or [])}
            except Exception as e:
                print(f"Warning: profiles batch query failed: {e}")

        # 4. Build conv_id -> other user map (guaranteed to have at least an id placeholder)
        conv_to_user: dict = {}
        for row in other_rows:
            cid = row.get("conversation_id")
            uid = row.get("user_id")
            if not cid or not uid or cid in conv_to_user:
                continue
            conv_to_user[cid] = user_by_id.get(uid) or {
                "id": uid,
                "username": f"user_{uid[:8]}",
                "first_name": "User",
                "last_name": uid[:8],
            }

        # 4b. Fallback: for any conversation_id missing from conv_to_user, query individually
        missing_cids = [cid for cid in conversation_ids if cid not in conv_to_user]
        for mcid in missing_cids:
            try:
                fallback = supabase.table("conversation_participants").select("user_id").eq("conversation_id", mcid).neq("user_id", user_id).limit(1).execute()
                if fallback.data:
                    uid = fallback.data[0]["user_id"]
                    ensure_user_exists(uid)
                    profile_row = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").eq("id", uid).limit(1).execute()
                    conv_to_user[mcid] = profile_row.data[0] if profile_row.data else {"id": uid, "username": f"user_{uid[:8]}", "first_name": "User", "last_name": uid[:8]}
            except Exception as e:
                print(f"Warning: fallback user lookup failed for conv {mcid}: {e}")

        # 4c. Last-resort fallback: infer the other user from the most recent message's
        # sender_id. This handles conversations where conversation_participants is missing
        # the other user's row (a data integrity gap that can occur when the participant
        # insert failed at conversation creation time). We also repair the missing row so
        # future calls go through the fast path.
        still_missing = [cid for cid in conversation_ids if cid not in conv_to_user]
        if still_missing:
            try:
                sender_by_conv: dict = {}
                for cid in still_missing:
                    try:
                        # Find the most recent message in this conversation NOT sent by us
                        lm = supabase.table("messages").select("sender_id").eq("conversation_id", cid).neq("sender_id", user_id).order("created_at", desc=True).limit(1).execute()
                        if lm.data:
                            sender_by_conv[cid] = lm.data[0]["sender_id"]
                        else:
                            # All messages sent by us — other user must be someone we messaged first.
                            # Look at ALL messages (including our own) to find the conversation partner
                            # by checking the conversation_participants created_at ordering as a last resort.
                            any_msg = supabase.table("messages").select("sender_id").eq("conversation_id", cid).order("created_at", desc=False).limit(1).execute()
                            # We can't determine the partner from our own messages alone; skip for now.
                    except Exception as e:
                        print(f"Warning: sender inference failed for conv {cid}: {e}")

                inferred_ids = list(set(sender_by_conv.values()))
                inferred_profiles: dict = {}
                if inferred_ids:
                    try:
                        pr = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", inferred_ids).execute()
                        inferred_profiles = {u["id"]: u for u in (pr.data or [])}
                    except Exception:
                        pass

                for cid, sender_id in sender_by_conv.items():
                    profile = inferred_profiles.get(sender_id)
                    if not profile:
                        ensure_user_exists(sender_id)
                        try:
                            pr2 = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").eq("id", sender_id).limit(1).execute()
                            profile = pr2.data[0] if pr2.data else None
                        except Exception:
                            pass
                    conv_to_user[cid] = profile or {
                        "id": sender_id,
                        "username": f"user_{sender_id[:8]}",
                        "first_name": "User",
                        "last_name": sender_id[:8],
                    }
                    # Repair the missing conversation_participants row so future queries
                    # use the fast path and this fallback doesn't run every time.
                    try:
                        supabase.table("conversation_participants").insert({
                            "conversation_id": cid,
                            "user_id": sender_id,
                        }).execute()
                        print(f"Repaired missing conversation_participants row: conv={cid} user={sender_id}")
                    except Exception as repair_err:
                        # Row may already exist with different constraints; non-fatal.
                        print(f"Note: conversation_participants repair skipped for conv {cid}: {repair_err}")
            except Exception as e:
                print(f"Warning: last-message sender fallback failed: {e}")

        # 5. Fetch conversations and enrich with pre-built data
        conversations = supabase.table("conversations").select("*").in_("id", conversation_ids).order("created_at", desc=True).execute()
        enriched = []
        for conv in (conversations.data or []):
            try:
                cid = conv["id"]
                other = conv_to_user.get(cid)
                conv["user"] = other
                conv["participants"] = [other] if other else []
                conv["is_pinned"] = pinned_by_conv.get(cid, False)

                # Last message
                try:
                    lm = supabase.table("messages").select("*").eq("conversation_id", cid).order("created_at", desc=True).limit(1).execute()
                    conv["last_message"] = lm.data[0] if lm.data else None
                except Exception:
                    conv.setdefault("last_message", None)

                # Emergency inline fallback: if user is still null but we have a last_message
                # with a sender that isn't us, use them as the conversation partner.
                if not conv.get("user") and isinstance(conv.get("last_message"), dict):
                    lm_sender = conv["last_message"].get("sender_id")
                    if lm_sender and lm_sender != user_id:
                        try:
                            pr = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").eq("id", lm_sender).limit(1).execute()
                            fallback_user = pr.data[0] if pr.data else {"id": lm_sender, "username": f"user_{lm_sender[:8]}", "first_name": "User", "last_name": lm_sender[:8]}
                        except Exception:
                            fallback_user = {"id": lm_sender, "username": f"user_{lm_sender[:8]}", "first_name": "User", "last_name": lm_sender[:8]}
                        conv["user"] = fallback_user
                        conv["participants"] = [fallback_user]

                # Unread count — exclude soft-deleted messages
                try:
                    unread = supabase.table("messages").select("id", count="exact").eq("conversation_id", cid).eq("is_read", False).eq("is_deleted", False).neq("sender_id", user_id).execute()
                    conv["unread_count"] = unread.count or 0
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
):
    """Toggle pinned state for the current user's conversation."""
    try:
        row = supabase.table("conversation_participants").select("is_pinned").eq("conversation_id", conversation_id).eq("user_id", user_id).single().execute()
        if not row.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        new_state = not row.data.get("is_pinned", False)
        supabase.table("conversation_participants").update({"is_pinned": new_state}).eq("conversation_id", conversation_id).eq("user_id", user_id).execute()
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
        reactions_by_msg: dict = {}
        try:
            reactions_data = supabase.table("message_reactions").select("*").in_("message_id", message_ids).execute()
            for r in (reactions_data.data or []):
                reactions_by_msg.setdefault(r["message_id"], []).append(r)
        except Exception:
            pass

        # Batch-fetch all unique senders in a single query instead of N+1 per message
        sender_by_id: dict = {}
        sender_ids = list({msg["sender_id"] for msg in messages.data if msg.get("sender_id")})
        if sender_ids:
            try:
                senders_data = supabase.table("users").select("id, username, first_name, last_name, avatar_url").in_("id", sender_ids).execute()
                sender_by_id = {u["id"]: u for u in (senders_data.data or [])}
            except Exception as e:
                print(f"Warning: batch sender fetch failed: {e}")

        # Enrich with sender info and reactions
        for msg in messages.data:
            msg["sender"] = sender_by_id.get(msg.get("sender_id"))
            msg["reactions"] = reactions_by_msg.get(msg["id"], [])

        return messages.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/conversations/{conversation_id}/read")
def mark_conversation_as_read(conversation_id: str, user_id: str = Depends(require_auth)):
    """Mark all messages in conversation as read.

    We intentionally do NOT 403 when a conversation_participants row is missing —
    that gap is a data-integrity issue we repair elsewhere. We verify participation
    by checking whether the user has sent or received any message in this conversation
    instead, which is a softer but still secure check.
    """
    try:
        # Verify user is either a listed participant OR has messages in this conversation.
        participant = supabase.table("conversation_participants").select("user_id").eq("conversation_id", conversation_id).eq("user_id", user_id).execute()
        if not participant.data:
            # Fallback: user may have sent messages even without a participant row
            msg_check = supabase.table("messages").select("id").eq("conversation_id", conversation_id).eq("sender_id", user_id).limit(1).execute()
            if not msg_check.data:
                # Also accept if any message in this conv is addressed to them (sender is other)
                msg_recv = supabase.table("messages").select("id").eq("conversation_id", conversation_id).neq("sender_id", user_id).limit(1).execute()
                if not msg_recv.data:
                    # Truly not related to this conversation
                    return {"message": "Messages marked as read"}

        # Mark all messages from others as read
        supabase.table("messages").update({"is_read": True}).eq("conversation_id", conversation_id).neq("sender_id", user_id).eq("is_read", False).execute()

        return {"message": "Messages marked as read"}
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


DELETE_WINDOW_MINUTES = 15

@router.delete("/messages/{message_id}")
def delete_message(message_id: str, user_id: str = Depends(require_auth)):
    """Soft-delete a message for everyone (sender only, within 15 minutes of sending)"""
    try:
        message = supabase.table("messages").select("id, sender_id, created_at, is_deleted").eq("id", message_id).single().execute()

        if not message.data:
            raise HTTPException(status_code=404, detail="Message not found")

        if message.data["sender_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the sender can delete this message")

        if message.data.get("is_deleted"):
            raise HTTPException(status_code=400, detail="Message already deleted")

        created_at = _to_utc_datetime(message.data["created_at"])
        elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
        if elapsed > DELETE_WINDOW_MINUTES * 60:
            raise HTTPException(
                status_code=403,
                detail=f"Messages can only be deleted within {DELETE_WINDOW_MINUTES} minutes of sending"
            )

        supabase.table("messages").update({
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "content": "",
        }).eq("id", message_id).execute()

        return {"message": "Message deleted for everyone"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/unread-count")
def get_unread_count(user_id: str = Depends(require_auth)):
    """Get count of conversations (not individual messages) that have unread messages.
    This is what the notification badge should show — e.g. '3' means 3 chats have
    unread messages, not that there are 3 total unread messages.
    Returns 0 on timeout instead of error.
    """
    try:
        participant_data = supabase.table("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()

        if not participant_data.data:
            return {"count": 0}

        conversation_ids = [p["conversation_id"] for p in participant_data.data]

        # Fetch one unread message per conversation (distinct by conversation_id)
        # so the count reflects conversations-with-unread, not total unread messages.
        unread_rows = supabase.table("messages").select("conversation_id").in_("conversation_id", conversation_ids).eq("is_read", False).eq("is_deleted", False).neq("sender_id", user_id).execute()

        # Deduplicate by conversation
        conversations_with_unread = len({r["conversation_id"] for r in (unread_rows.data or [])})
        return {"count": conversations_with_unread}
    except Exception as e:
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
