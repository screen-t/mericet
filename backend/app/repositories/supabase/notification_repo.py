from typing import Optional


class SupabaseNotificationRepository:
    def __init__(self, client):
        self._client = client

    def get_for_user(self, user_id: str, unread_only: bool,
                     limit: int, offset: int) -> list[dict]:
        query = self._client.table("notifications") \
            .select("*, actor:actor_id(id, username, first_name, last_name, avatar_url)") \
            .eq("user_id", user_id)
        if unread_only:
            query = query.eq("is_read", False)
        result = query.order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def count_unread(self, user_id: str) -> int:
        result = self._client.table("notifications") \
            .select("id", count="exact") \
            .eq("user_id", user_id).eq("is_read", False).execute()
        return result.count or 0

    def get_owner(self, notification_id: str) -> Optional[str]:
        result = self._client.table("notifications") \
            .select("user_id").eq("id", notification_id) \
            .single().execute()
        return result.data["user_id"] if result.data else None

    def mark_read(self, notification_id: str) -> None:
        self._client.table("notifications") \
            .update({"is_read": True}) \
            .eq("id", notification_id).execute()

    def mark_all_read(self, user_id: str) -> None:
        self._client.table("notifications") \
            .update({"is_read": True}) \
            .eq("user_id", user_id).eq("is_read", False).execute()

    def create(self, data: dict) -> None:
        self._client.table("notifications").insert(data).execute()

    def delete(self, notification_id: str) -> None:
        self._client.table("notifications") \
            .delete().eq("id", notification_id).execute()

    def clear_read(self, user_id: str) -> None:
        self._client.table("notifications") \
            .delete().eq("user_id", user_id).eq("is_read", True).execute()

    # --- Mute ---

    def mute_user(self, user_id: str, muted_user_id: str) -> None:
        self._client.table("muted_users").insert({
            "user_id": user_id, "muted_user_id": muted_user_id,
        }).execute()

    def unmute_user(self, user_id: str, muted_user_id: str) -> None:
        self._client.table("muted_users").delete() \
            .eq("user_id", user_id).eq("muted_user_id", muted_user_id).execute()

    def is_muted(self, user_id: str, muted_user_id: str) -> bool:
        result = self._client.table("muted_users").select("id") \
            .eq("user_id", user_id).eq("muted_user_id", muted_user_id).execute()
        return bool(result.data)

    def get_muted_user_ids(self, user_id: str) -> set[str]:
        result = self._client.table("muted_users").select("muted_user_id") \
            .eq("user_id", user_id).execute()
        return {r["muted_user_id"] for r in (result.data or [])}
