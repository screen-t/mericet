from typing import Optional, List
from datetime import datetime, timezone, timedelta


class SupabaseVaultRepository:
    def __init__(self, client):
        self._client = client

    def get_by_id(self, item_id: str) -> Optional[dict]:
        try:
            result = self._client.table("vault_items").select("*").eq("id", item_id).execute()
            return result.data[0] if (result.data and len(result.data) > 0) else None
        except Exception:
            return None

    def get_by_user(self, user_id: str, category: Optional[str] = None,
                    is_public_only: bool = False, limit: int = 100, offset: int = 0) -> list[dict]:
        try:
            query = self._client.table("vault_items").select("*").eq("user_id", user_id)
            if category:
                query = query.eq("category", category)
            if is_public_only:
                query = query.eq("is_public", True)
            
            query = query.order("display_order").order("created_at", desc=True).range(offset, offset + limit - 1)
            result = query.execute()
            return result.data or []
        except Exception:
            return []

    def get_by_external_id(self, user_id: str, external_id: str) -> Optional[dict]:
        """Finds vault item by external milestone identifier in metadata."""
        items = self.get_by_user(user_id=user_id, limit=200)
        for item in items:
            meta = item.get("metadata") or {}
            if meta.get("external_id") == external_id:
                return item
        return None

    def get_by_metric_name(self, user_id: str, provider: str, metric_name: str) -> Optional[dict]:
        """Finds existing milestone for a specific metric counter to enable highest-metric retention."""
        items = self.get_by_user(user_id=user_id, limit=200)
        for item in items:
            meta = item.get("metadata") or {}
            if meta.get("provider") == provider and meta.get("metric_name") == metric_name:
                return item
        return None

    def get_owner(self, item_id: str) -> Optional[str]:
        try:
            result = self._client.table("vault_items").select("user_id").eq("id", item_id).execute()
            return result.data[0]["user_id"] if (result.data and len(result.data) > 0) else None
        except Exception:
            return None

    def create(self, data: dict) -> dict:
        result = self._client.table("vault_items").insert(data).execute()
        return result.data[0] if (result.data and len(result.data) > 0) else data

    def update(self, item_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("vault_items").update(data).eq("id", item_id).execute()
        return result.data[0] if (result.data and len(result.data) > 0) else None

    def delete(self, item_id: str) -> None:
        self._client.table("vault_items").delete().eq("id", item_id).execute()

    def count_by_user(self, user_id: str, is_public_only: bool = False) -> int:
        try:
            query = self._client.table("vault_items").select("id", count="exact").eq("user_id", user_id)
            if is_public_only:
                query = query.eq("is_public", True)
            result = query.execute()
            return result.count if result.count is not None else len(result.data or [])
        except Exception:
            return 0


class SupabaseConnectedToolRepository:
    def __init__(self, client):
        self._client = client

    def get_by_id(self, tool_id: str) -> Optional[dict]:
        try:
            result = self._client.table("connected_tools").select("*").eq("id", tool_id).execute()
            return result.data[0] if (result.data and len(result.data) > 0) else None
        except Exception:
            return None

    def get_by_user(self, user_id: str) -> list[dict]:
        try:
            result = self._client.table("connected_tools").select("*").eq("user_id", user_id).order("created_at").execute()
            return result.data or []
        except Exception:
            return []

    def get_all_active(self, limit: int = 500) -> list[dict]:
        """Fetch all connected tools across all users where auth_status is connected."""
        try:
            result = self._client.table("connected_tools").select("*").eq("auth_status", "connected").limit(limit).execute()
            return result.data or []
        except Exception:
            return []

    def get_by_user_and_provider(self, user_id: str, provider: str) -> Optional[dict]:
        try:
            result = self._client.table("connected_tools").select("*").eq("user_id", user_id).eq("provider", provider).execute()
            return result.data[0] if (result.data and len(result.data) > 0) else None
        except Exception:
            return None

    def upsert(self, data: dict) -> dict:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("connected_tools").upsert(data, on_conflict="user_id,provider").execute()
        return result.data[0] if (result.data and len(result.data) > 0) else data

    def update(self, tool_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("connected_tools").update(data).eq("id", tool_id).execute()
        return result.data[0] if (result.data and len(result.data) > 0) else None

    def delete(self, tool_id: str) -> None:
        self._client.table("connected_tools").delete().eq("id", tool_id).execute()

    def get_owner(self, tool_id: str) -> Optional[str]:
        try:
            result = self._client.table("connected_tools").select("user_id").eq("id", tool_id).execute()
            return result.data[0]["user_id"] if (result.data and len(result.data) > 0) else None
        except Exception:
            return None


class SupabaseLivingGraphRepository:
    """Manages worker concurrency leases and sync run audit records without Redis."""

    def __init__(self, client):
        self._client = client

    def acquire_lease(self, lock_key: str, acquired_by: str, lease_duration_seconds: int = 600) -> bool:
        """Acquires a distributed lease to prevent overlapping worker jobs."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=lease_duration_seconds)

        try:
            # Check existing lock
            res = self._client.table("worker_locks").select("*").eq("lock_key", lock_key).execute()
            if res.data:
                lock = res.data[0]
                lock_expires = datetime.fromisoformat(lock["expires_at"].replace("Z", "+00:00"))
                if lock_expires > now:
                    # Lease is actively held by another process
                    return False
                # Lease is expired (stale lock from crashed worker) -> reclaim it
                self._client.table("worker_locks").update({
                    "acquired_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "acquired_by": acquired_by,
                }).eq("lock_key", lock_key).execute()
                return True
            else:
                # No existing lock -> insert new lease
                self._client.table("worker_locks").insert({
                    "lock_key": lock_key,
                    "acquired_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "acquired_by": acquired_by,
                }).execute()
                return True
        except Exception:
            # Concurrency safety: fail closed if database lock check fails
            return False

    def release_lease(self, lock_key: str, acquired_by: str) -> None:
        """Releases the held lease."""
        try:
            self._client.table("worker_locks").delete().eq("lock_key", lock_key).eq("acquired_by", acquired_by).execute()
        except Exception:
            pass

    def create_sync_run(self, data: dict) -> dict:
        """Records initial worker run audit log."""
        try:
            res = self._client.table("living_graph_sync_runs").insert(data).execute()
            return res.data[0] if res.data else {"id": "local-run", **data}
        except Exception:
            return {"id": "local-run", **data}

    def update_sync_run(self, run_id: str, data: dict) -> Optional[dict]:
        """Updates worker run audit log upon completion."""
        try:
            res = self._client.table("living_graph_sync_runs").update(data).eq("id", run_id).execute()
            return res.data[0] if res.data else None
        except Exception:
            return None

    def get_recent_sync_runs(self, limit: int = 20) -> list[dict]:
        try:
            res = self._client.table("living_graph_sync_runs").select("*").order("started_at", desc=True).limit(limit).execute()
            return res.data or []
        except Exception:
            return []
