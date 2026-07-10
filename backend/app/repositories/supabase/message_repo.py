from typing import Optional


class SupabaseMessageRepository:
    def __init__(self, client):
        self._client = client

    # ── Conversations ─────────────────────────────────────────────

    def get_conversation(self, conversation_id: str) -> Optional[dict]:
        result = self._client.table("conversations").select("*") \
            .eq("id", conversation_id).single().execute()
        return result.data if result.data else None

    def create_conversation(self) -> dict:
        result = self._client.table("conversations").insert({}).execute()
        return result.data[0]

    def get_conversations_for_user(self, user_id: str) -> list[dict]:
        """Return all conversations the user participates in.

        This first resolves conversation IDs from the participants table,
        then fetches the conversation rows.
        """
        participant_data = self._client.table("conversation_participants") \
            .select("conversation_id").eq("user_id", user_id).execute()
        if not participant_data.data:
            return []
        conversation_ids = [p["conversation_id"] for p in participant_data.data]
        result = self._client.table("conversations").select("*") \
            .in_("id", conversation_ids) \
            .order("created_at", desc=True).execute()
        return result.data or []

    def get_conversations_by_ids(self, conversation_ids: list[str]) -> list[dict]:
        """Fetch conversation rows by their IDs."""
        if not conversation_ids:
            return []
        result = self._client.table("conversations").select("*") \
            .in_("id", conversation_ids) \
            .order("created_at", desc=True).execute()
        return result.data or []

    def delete_conversation(self, conversation_id: str) -> None:
        self._client.table("messages").delete() \
            .eq("conversation_id", conversation_id).execute()
        self._client.table("conversations").delete() \
            .eq("id", conversation_id).execute()

    # ── Participants ──────────────────────────────────────────────

    def get_participant_ids(self, conversation_id: str) -> list[str]:
        result = self._client.table("conversation_participants") \
            .select("user_id").eq("conversation_id", conversation_id).execute()
        return [p["user_id"] for p in (result.data or [])]

    def get_other_participant_ids(self, conversation_id: str,
                                  exclude_user_id: str) -> list[str]:
        """Return participant IDs in a conversation excluding the given user."""
        result = self._client.table("conversation_participants") \
            .select("user_id").eq("conversation_id", conversation_id) \
            .neq("user_id", exclude_user_id).execute()
        return [p["user_id"] for p in (result.data or [])]

    def add_participant(self, conversation_id: str, user_id: str) -> None:
        self._client.table("conversation_participants").insert({
            "conversation_id": conversation_id,
            "user_id": user_id,
        }).execute()

    def is_participant(self, conversation_id: str, user_id: str) -> bool:
        result = self._client.table("conversation_participants") \
            .select("user_id") \
            .eq("conversation_id", conversation_id) \
            .eq("user_id", user_id).limit(1).execute()
        return bool(result.data)

    def get_user_conversation_ids(self, user_id: str) -> list[str]:
        result = self._client.table("conversation_participants") \
            .select("conversation_id").eq("user_id", user_id).execute()
        return [p["conversation_id"] for p in (result.data or [])]

    def toggle_pin(self, conversation_id: str, user_id: str) -> bool:
        row = self._client.table("conversation_participants") \
            .select("is_pinned") \
            .eq("conversation_id", conversation_id) \
            .eq("user_id", user_id).single().execute()
        if not row.data:
            return False
        new_state = not row.data.get("is_pinned", False)
        self._client.table("conversation_participants") \
            .update({"is_pinned": new_state}) \
            .eq("conversation_id", conversation_id) \
            .eq("user_id", user_id).execute()
        return new_state

    def get_pin_states(self, conversation_ids: list[str],
                       user_id: str) -> dict[str, bool]:
        """Return {conversation_id: is_pinned} for the given user."""
        if not conversation_ids:
            return {}
        result = self._client.table("conversation_participants") \
            .select("conversation_id, is_pinned") \
            .in_("conversation_id", conversation_ids) \
            .eq("user_id", user_id).execute()
        return {
            r["conversation_id"]: r.get("is_pinned", False)
            for r in (result.data or [])
        }

    def remove_participant(self, conversation_id: str, user_id: str) -> None:
        self._client.table("conversation_participants").delete() \
            .eq("conversation_id", conversation_id) \
            .eq("user_id", user_id).execute()

    def count_participants(self, conversation_id: str) -> int:
        result = self._client.table("conversation_participants") \
            .select("*", count="exact") \
            .eq("conversation_id", conversation_id).execute()
        return result.count or 0

    def get_all_other_participants(self, conversation_ids: list[str],
                                   exclude_user_id: str) -> list[dict]:
        """Batch-fetch all other participants across multiple conversations.

        Returns raw rows with conversation_id and user_id.
        """
        if not conversation_ids:
            return []
        result = self._client.table("conversation_participants") \
            .select("conversation_id, user_id") \
            .in_("conversation_id", conversation_ids) \
            .neq("user_id", exclude_user_id).execute()
        return result.data or []

    # ── Messages ──────────────────────────────────────────────────

    def get_messages(self, conversation_id: str, limit: int,
                     offset: int) -> list[dict]:
        result = self._client.table("messages").select("*") \
            .eq("conversation_id", conversation_id) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def get_message(self, message_id: str) -> Optional[dict]:
        result = self._client.table("messages").select("*") \
            .eq("id", message_id).single().execute()
        return result.data if result.data else None

    def get_message_fields(self, message_id: str,
                           fields: str) -> Optional[dict]:
        """Fetch specific columns of a single message."""
        result = self._client.table("messages").select(fields) \
            .eq("id", message_id).single().execute()
        return result.data if result.data else None

    def create_message(self, data: dict) -> dict:
        result = self._client.table("messages").insert(data).execute()
        return result.data[0]

    def update_message(self, message_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("messages").update(data) \
            .eq("id", message_id).execute()
        return result.data[0] if result.data else None

    def soft_delete_message(self, message_id: str) -> None:
        from datetime import datetime, timezone
        self._client.table("messages").update({
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "content": "",
        }).eq("id", message_id).execute()

    def get_last_message(self, conversation_id: str) -> Optional[dict]:
        result = self._client.table("messages").select("*") \
            .eq("conversation_id", conversation_id) \
            .order("created_at", desc=True).limit(1).execute()
        return result.data[0] if result.data else None

    def get_last_messages_bulk(self, conversation_ids: list[str]) -> dict[str, dict]:
        """Fetch last message per conversation.

        Supabase doesn't support DISTINCT ON, so we fetch the latest
        message for each conversation individually.  For the listing page
        this is acceptable because the number of conversations is bounded.
        """
        result: dict[str, dict] = {}
        for cid in conversation_ids:
            msg = self.get_last_message(cid)
            if msg:
                result[cid] = msg
        return result

    # ── Read receipts ─────────────────────────────────────────────

    def mark_read(self, conversation_id: str, user_id: str) -> None:
        self._client.table("messages").update({"is_read": True}) \
            .eq("conversation_id", conversation_id) \
            .neq("sender_id", user_id) \
            .eq("is_read", False).execute()

    def count_unread(self, conversation_id: str, user_id: str) -> int:
        result = self._client.table("messages") \
            .select("id", count="exact") \
            .eq("conversation_id", conversation_id) \
            .eq("is_read", False).eq("is_deleted", False) \
            .neq("sender_id", user_id).execute()
        return result.count or 0

    def count_total_unread(self, user_id: str,
                           conversation_ids: list[str]) -> int:
        """Count conversations with at least one unread message."""
        if not conversation_ids:
            return 0
        result = self._client.table("messages") \
            .select("conversation_id") \
            .in_("conversation_id", conversation_ids) \
            .eq("is_read", False).eq("is_deleted", False) \
            .neq("sender_id", user_id).execute()
        return len({r["conversation_id"] for r in (result.data or [])})

    def has_reply_after(self, conversation_id: str, sender_id: str,
                        after_ts: str) -> bool:
        result = self._client.table("messages").select("id") \
            .eq("conversation_id", conversation_id) \
            .neq("sender_id", sender_id) \
            .gt("created_at", after_ts) \
            .order("created_at", desc=False).limit(1).execute()
        return bool(result.data)

    def user_has_messages_in(self, conversation_id: str,
                             user_id: str) -> bool:
        """Check whether the user has sent any message in the conversation."""
        result = self._client.table("messages").select("id") \
            .eq("conversation_id", conversation_id) \
            .eq("sender_id", user_id).limit(1).execute()
        return bool(result.data)

    def has_messages_from_others(self, conversation_id: str,
                                 user_id: str) -> bool:
        """Check whether the conversation has any message NOT from user_id."""
        result = self._client.table("messages").select("id") \
            .eq("conversation_id", conversation_id) \
            .neq("sender_id", user_id).limit(1).execute()
        return bool(result.data)

    def get_sender_id_from_last_other_message(
        self, conversation_id: str, user_id: str
    ) -> Optional[str]:
        """Return the sender_id of the most recent message NOT sent by user_id."""
        result = self._client.table("messages").select("sender_id") \
            .eq("conversation_id", conversation_id) \
            .neq("sender_id", user_id) \
            .order("created_at", desc=True).limit(1).execute()
        return result.data[0]["sender_id"] if result.data else None

    # ── Reactions ─────────────────────────────────────────────────

    def get_reactions(self, message_ids: list[str]) -> dict[str, list[dict]]:
        if not message_ids:
            return {}
        result = self._client.table("message_reactions").select("*") \
            .in_("message_id", message_ids).execute()
        grouped: dict[str, list[dict]] = {}
        for r in (result.data or []):
            grouped.setdefault(r["message_id"], []).append(r)
        return grouped

    def toggle_reaction(self, message_id: str, user_id: str,
                        emoji: str) -> str:
        existing = self._client.table("message_reactions").select("id") \
            .eq("message_id", message_id) \
            .eq("user_id", user_id) \
            .eq("emoji", emoji).execute()
        if existing.data:
            self._client.table("message_reactions").delete() \
                .eq("id", existing.data[0]["id"]).execute()
            return "removed"
        self._client.table("message_reactions").insert({
            "message_id": message_id,
            "user_id": user_id,
            "emoji": emoji,
        }).execute()
        return "added"

    def remove_reaction(self, message_id: str, user_id: str,
                        emoji: str) -> None:
        self._client.table("message_reactions").delete() \
            .eq("message_id", message_id) \
            .eq("user_id", user_id) \
            .eq("emoji", emoji).execute()

    # ── Search ────────────────────────────────────────────────────

    def search_messages(self, conversation_ids: list[str],
                        query: str, limit: int) -> list[dict]:
        if not conversation_ids:
            return []
        result = self._client.table("messages").select("*") \
            .in_("conversation_id", conversation_ids) \
            .ilike("content", f"%{query}%") \
            .eq("is_deleted", False) \
            .order("created_at", desc=True) \
            .limit(limit).execute()
        return result.data or []

    # ── Find conversation between two users ───────────────────────

    def find_conversation_between(self, user_id: str,
                                  other_user_id: str) -> Optional[str]:
        """Return conversation_id if both users participate in the same conversation.

        Also repairs missing participant rows (data integrity fallback).
        """
        my_convs = self._client.table("conversation_participants") \
            .select("conversation_id").eq("user_id", user_id).execute()
        if not my_convs.data:
            return None

        for conv in my_convs.data:
            cid = conv["conversation_id"]
            check = self._client.table("conversation_participants") \
                .select("user_id") \
                .eq("conversation_id", cid) \
                .eq("user_id", other_user_id).execute()
            if check.data:
                return cid

        # Repair fallback: other user may have sent messages without a
        # participant row.
        for conv in my_convs.data:
            cid = conv["conversation_id"]
            try:
                msg_check = self._client.table("messages").select("id") \
                    .eq("conversation_id", cid) \
                    .eq("sender_id", other_user_id).limit(1).execute()
                if msg_check.data:
                    try:
                        self._client.table("conversation_participants").insert({
                            "conversation_id": cid,
                            "user_id": other_user_id,
                        }).execute()
                        print(f"Repaired missing participant row: conv={cid} user={other_user_id}")
                    except Exception as repair_err:
                        print(f"Note: participant repair skipped for conv {cid}: {repair_err}")
                    return cid
            except Exception:
                pass

        return None
