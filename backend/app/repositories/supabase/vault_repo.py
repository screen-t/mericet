from typing import Optional
from datetime import datetime, timezone


class SupabaseVaultRepository:
    def __init__(self, client):
        self._client = client

    def get_by_id(self, item_id: str) -> Optional[dict]:
        result = self._client.table("vault_items").select("*").eq("id", item_id).execute()
        return result.data[0] if result.data else None

    def get_by_user(self, user_id: str, category: Optional[str] = None,
                    is_public_only: bool = False, limit: int = 100, offset: int = 0) -> list[dict]:
        query = self._client.table("vault_items").select("*").eq("user_id", user_id)
        if category:
            query = query.eq("category", category)
        if is_public_only:
            query = query.eq("is_public", True)
        
        query = query.order("display_order").order("created_at", desc=True).range(offset, offset + limit - 1)
        result = query.execute()
        return result.data or []

    def get_owner(self, item_id: str) -> Optional[str]:
        result = self._client.table("vault_items").select("user_id").eq("id", item_id).execute()
        return result.data[0]["user_id"] if result.data else None

    def create(self, data: dict) -> dict:
        result = self._client.table("vault_items").insert(data).execute()
        return result.data[0]

    def update(self, item_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("vault_items").update(data).eq("id", item_id).execute()
        return result.data[0] if result.data else None

    def delete(self, item_id: str) -> None:
        self._client.table("vault_items").delete().eq("id", item_id).execute()

    def count_by_user(self, user_id: str, is_public_only: bool = False) -> int:
        query = self._client.table("vault_items").select("id", count="exact").eq("user_id", user_id)
        if is_public_only:
            query = query.eq("is_public", True)
        result = query.execute()
        return result.count if result.count is not None else len(result.data or [])


class SupabaseConnectedToolRepository:
    def __init__(self, client):
        self._client = client

    def get_by_id(self, tool_id: str) -> Optional[dict]:
        result = self._client.table("connected_tools").select("*").eq("id", tool_id).execute()
        return result.data[0] if result.data else None

    def get_by_user(self, user_id: str) -> list[dict]:
        result = self._client.table("connected_tools").select("*").eq("user_id", user_id).order("created_at").execute()
        return result.data or []

    def get_by_user_and_provider(self, user_id: str, provider: str) -> Optional[dict]:
        result = self._client.table("connected_tools").select("*").eq("user_id", user_id).eq("provider", provider).execute()
        return result.data[0] if result.data else None

    def upsert(self, data: dict) -> dict:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("connected_tools").upsert(data, on_conflict="user_id,provider").execute()
        return result.data[0]

    def update(self, tool_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("connected_tools").update(data).eq("id", tool_id).execute()
        return result.data[0] if result.data else None

    def delete(self, tool_id: str) -> None:
        self._client.table("connected_tools").delete().eq("id", tool_id).execute()

    def get_owner(self, tool_id: str) -> Optional[str]:
        result = self._client.table("connected_tools").select("user_id").eq("id", tool_id).execute()
        return result.data[0]["user_id"] if result.data else None
