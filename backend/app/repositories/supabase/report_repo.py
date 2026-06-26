from typing import Optional


class SupabaseReportRepository:
    def __init__(self, client):
        self._client = client

    def create(self, data: dict) -> dict:
        result = self._client.table("reports").insert(data).execute()
        return result.data[0]

    def get_existing(self, reporter_id: str, target_type: str,
                     target_id: str) -> Optional[dict]:
        result = self._client.table("reports").select("*") \
            .eq("reporter_id", reporter_id) \
            .eq("target_type", target_type) \
            .eq("target_id", target_id) \
            .limit(1).execute()
        return result.data[0] if result.data else None

    def get_by_reporter(self, reporter_id: str, limit: int,
                        offset: int) -> list[dict]:
        result = self._client.table("reports").select("*") \
            .eq("reporter_id", reporter_id) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def get_queue(self, status: str, limit: int, offset: int) -> list[dict]:
        result = self._client.table("reports").select("*") \
            .eq("status", status) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def update_status(self, report_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("reports") \
            .update(data).eq("id", report_id).execute()
        return result.data[0] if result.data else None

    def target_exists(self, target_type: str, target_id: str) -> bool:
        table = "posts" if target_type == "post" else "users" if target_type == "user" else None
        if not table:
            return False
        try:
            result = self._client.table(table).select("id") \
                .eq("id", target_id).limit(1).execute()
            return bool(result.data)
        except Exception:
            return False

    def get_user_profile(self, user_id: str) -> Optional[dict]:
        try:
            result = self._client.table("users") \
                .select("id, username, email") \
                .eq("id", user_id).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None
