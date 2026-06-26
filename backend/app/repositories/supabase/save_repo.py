from typing import Optional
from datetime import datetime, timezone


class SupabaseSaveRepository:
    def __init__(self, client):
        self._client = client

    # --- Folders ---

    def create_folder(self, data: dict) -> dict:
        result = self._client.table("save_folders").insert(data).execute()
        return result.data[0]

    def get_folders(self, user_id: str) -> list[dict]:
        result = self._client.table("save_folders").select("*") \
            .eq("user_id", user_id).order("created_at").execute()
        return result.data or []

    def get_folder(self, folder_id: str, user_id: str) -> Optional[dict]:
        result = self._client.table("save_folders").select("*") \
            .eq("id", folder_id).eq("user_id", user_id).execute()
        return result.data[0] if result.data else None

    def update_folder(self, folder_id: str, user_id: str,
                      data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("save_folders").update(data) \
            .eq("id", folder_id).eq("user_id", user_id).execute()
        return result.data[0] if result.data else None

    def delete_folder(self, folder_id: str, user_id: str) -> None:
        self._client.table("save_folders").delete() \
            .eq("id", folder_id).execute()

    def get_folder_post_counts(self, user_id: str,
                               folder_ids: list[str]) -> dict[str, int]:
        if not folder_ids:
            return {}
        result = self._client.table("saved_posts").select("folder_id") \
            .eq("user_id", user_id).in_("folder_id", folder_ids).execute()
        counts: dict[str, int] = {}
        for row in (result.data or []):
            fid = row["folder_id"]
            counts[fid] = counts.get(fid, 0) + 1
        return counts

    # --- Save/Unsave ---

    def save_post(self, user_id: str, post_id: str,
                  folder_id: Optional[str] = None) -> str:
        existing = self._client.table("saved_posts").select("post_id") \
            .eq("post_id", post_id).eq("user_id", user_id).execute()
        if existing.data:
            self._client.table("saved_posts") \
                .update({"folder_id": folder_id}) \
                .eq("post_id", post_id).eq("user_id", user_id).execute()
            return "moved" if folder_id else "removed_from_folder"
        self._client.table("saved_posts").insert({
            "post_id": post_id, "user_id": user_id, "folder_id": folder_id,
        }).execute()
        return "saved"

    def unsave_post(self, user_id: str, post_id: str) -> None:
        self._client.table("saved_posts").delete() \
            .eq("post_id", post_id).eq("user_id", user_id).execute()

    def get_saved_post_ids(self, user_id: str, limit: int,
                           offset: int) -> list[str]:
        result = self._client.table("saved_posts").select("post_id") \
            .eq("user_id", user_id).execute()
        return [s["post_id"] for s in (result.data or [])]

    def get_unsorted_post_ids(self, user_id: str, limit: int,
                              offset: int) -> list[str]:
        result = self._client.table("saved_posts").select("post_id") \
            .eq("user_id", user_id).is_("folder_id", None).execute()
        return [s["post_id"] for s in (result.data or [])]

    def get_folder_post_ids(self, folder_id: str, user_id: str,
                            limit: int, offset: int) -> list[str]:
        result = self._client.table("saved_posts").select("post_id") \
            .eq("user_id", user_id).eq("folder_id", folder_id) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return [s["post_id"] for s in (result.data or [])]

    def search_saved(self, user_id: str, query: str,
                     limit: int, folder_id: Optional[str] = None) -> list[str]:
        q = self._client.table("saved_posts").select("post_id") \
            .eq("user_id", user_id)
        if folder_id:
            q = q.eq("folder_id", folder_id)
        result = q.execute()
        return [s["post_id"] for s in (result.data or [])]
