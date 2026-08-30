from typing import Optional


class SupabaseReviewRepository:
    def __init__(self, client):
        self._client = client

    def upsert(self, user_id: str, data: dict) -> dict:
        payload = {**data, "user_id": user_id}
        result = self._client.table("reviews") \
            .upsert(payload, on_conflict="user_id").execute()
        return result.data[0]

    def get_by_user(self, user_id: str) -> Optional[dict]:
        result = self._client.table("reviews").select("*") \
            .eq("user_id", user_id).limit(1).execute()
        return result.data[0] if result.data else None

    def get_by_id(self, review_id: str) -> Optional[dict]:
        result = self._client.table("reviews").select("*") \
            .eq("id", review_id).limit(1).execute()
        return result.data[0] if result.data else None

    def get_queue(self, status: str, limit: int, offset: int) -> list[dict]:
        result = self._client.table("reviews") \
            .select("*, user:user_id(id, first_name, last_name, username, avatar_url, headline)") \
            .eq("status", status) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def get_featured(self, limit: int) -> list[dict]:
        result = self._client.table("reviews") \
            .select("*, user:user_id(id, first_name, last_name, username, avatar_url, headline)") \
            .eq("status", "approved") \
            .eq("is_featured", True) \
            .order("updated_at", desc=True) \
            .limit(limit).execute()
        return result.data or []

    def update_status(self, review_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("reviews") \
            .update(data).eq("id", review_id).execute()
        return result.data[0] if result.data else None

    def get_user_profile(self, user_id: str) -> Optional[dict]:
        try:
            result = self._client.table("users") \
                .select("id, username, email, role") \
                .eq("id", user_id).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None
