from typing import Optional


class SupabaseConnectionRepository:
    def __init__(self, client):
        self._client = client

    def get_by_id(self, connection_id: str) -> Optional[dict]:
        result = self._client.table("connections").select("*") \
            .eq("id", connection_id).single().execute()
        return result.data if result.data else None

    def get_between(self, user1_id: str, user2_id: str) -> Optional[dict]:
        result = self._client.table("connections").select("*").or_(
            f"and(requester_id.eq.{user1_id},receiver_id.eq.{user2_id}),"
            f"and(requester_id.eq.{user2_id},receiver_id.eq.{user1_id})"
        ).execute()
        return result.data[0] if result.data else None

    def get_all_between(self, user1_id: str, user2_id: str) -> list[dict]:
        result = self._client.table("connections").select("*").or_(
            f"and(requester_id.eq.{user1_id},receiver_id.eq.{user2_id}),"
            f"and(requester_id.eq.{user2_id},receiver_id.eq.{user1_id})"
        ).execute()
        return result.data or []

    def get_for_user(self, user_id: str, status: str,
                     limit: int, offset: int) -> list[dict]:
        result = self._client.table("connections").select("*").or_(
            f"requester_id.eq.{user_id},receiver_id.eq.{user_id}"
        ).eq("status", status).order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def get_pending_received(self, user_id: str, limit: int = 100,
                             offset: int = 0) -> list[dict]:
        result = self._client.table("connections").select("*") \
            .eq("receiver_id", user_id).eq("status", "pending") \
            .order("created_at", desc=True).execute()
        return result.data or []

    def get_pending_sent(self, user_id: str, limit: int = 100,
                         offset: int = 0) -> list[dict]:
        result = self._client.table("connections").select("*") \
            .eq("requester_id", user_id).eq("status", "pending") \
            .order("created_at", desc=True).execute()
        return result.data or []

    def create(self, data: dict) -> dict:
        result = self._client.table("connections").insert(data).execute()
        return result.data[0]

    def update(self, connection_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("connections").update(data) \
            .eq("id", connection_id).execute()
        return result.data[0] if result.data else None

    def delete(self, connection_id: str) -> None:
        self._client.table("connections").delete() \
            .eq("id", connection_id).execute()

    def delete_between(self, user1_id: str, user2_id: str) -> None:
        self._client.table("connections").delete().or_(
            f"and(requester_id.eq.{user1_id},receiver_id.eq.{user2_id}),"
            f"and(requester_id.eq.{user2_id},receiver_id.eq.{user1_id})"
        ).execute()

    def get_connected_ids(self, user_id: str) -> list[str]:
        result = self._client.table("connections") \
            .select("requester_id, receiver_id") \
            .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}") \
            .eq("status", "accepted").execute()
        ids = set()
        for conn in (result.data or []):
            if conn["requester_id"] == user_id:
                ids.add(conn["receiver_id"])
            else:
                ids.add(conn["requester_id"])
        return list(ids)

    def get_excluded_ids(self, user_id: str) -> set[str]:
        result = self._client.table("connections") \
            .select("requester_id, receiver_id") \
            .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}") \
            .execute()
        ids = {user_id}
        for conn in (result.data or []):
            ids.add(conn["requester_id"])
            ids.add(conn["receiver_id"])
        return ids

    def is_blocked(self, blocker_id: str, blocked_id: str) -> bool:
        result = self._client.table("connections").select("id") \
            .eq("requester_id", blocker_id) \
            .eq("receiver_id", blocked_id) \
            .eq("status", "blocked").limit(1).execute()
        return bool(result.data)

    def count_accepted(self, user_id: str) -> int:
        result = self._client.table("connections") \
            .select("id", count="exact") \
            .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}") \
            .eq("status", "accepted").execute()
        return result.count or 0

    def get_suggestions(self, user_id: str, exclude_ids: list[str],
                        limit: int) -> list[dict]:
        result = self._client.table("users") \
            .select("id, username, first_name, last_name, avatar_url, headline, current_position, current_company, industry") \
            .not_.in_("id", list(exclude_ids)) \
            .eq("is_active", True).limit(limit).execute()
        return result.data or []
