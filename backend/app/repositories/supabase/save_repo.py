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
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return [s["post_id"] for s in (result.data or [])]

    def get_unsorted_post_ids(self, user_id: str, limit: int,
                              offset: int) -> list[str]:
        result = self._client.table("saved_posts").select("post_id") \
            .eq("user_id", user_id).is_("folder_id", None) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
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

    # --- Public folder helpers ---

    def get_any_folder(self, folder_id: str) -> Optional[dict]:
        """Fetch a folder without ownership check (for public access)."""
        result = self._client.table("save_folders").select("*") \
            .eq("id", folder_id).execute()
        return result.data[0] if result.data else None

    def get_public_folder_by_token(self, share_token: str) -> Optional[dict]:
        result = self._client.table("save_folders").select("*") \
            .eq("share_token", share_token).eq("is_public", True).execute()
        return result.data[0] if result.data else None

    def toggle_folder_public(self, folder_id: str, user_id: str,
                             is_public: bool) -> Optional[dict]:
        result = self._client.table("save_folders") \
            .update({"is_public": is_public,
                     "updated_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("id", folder_id).eq("user_id", user_id).execute()
        return result.data[0] if result.data else None

    def get_public_folder_post_ids(self, folder_id: str,
                                   limit: int, offset: int) -> list[str]:
        result = self._client.table("saved_posts").select("post_id") \
            .eq("folder_id", folder_id) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return [s["post_id"] for s in (result.data or [])]

    def get_folder_post_counts_any(self, folder_ids: list[str]) -> dict[str, int]:
        """Count posts per folder regardless of owner (used for followed folders)."""
        if not folder_ids:
            return {}
        result = self._client.table("saved_posts").select("folder_id") \
            .in_("folder_id", folder_ids).execute()
        counts: dict[str, int] = {}
        for row in (result.data or []):
            fid = row["folder_id"]
            counts[fid] = counts.get(fid, 0) + 1
        return counts

    # --- Folder follows ---

    def follow_folder(self, user_id: str, folder_id: str) -> None:
        self._client.table("folder_follows").insert(
            {"user_id": user_id, "folder_id": folder_id}
        ).execute()

    def unfollow_folder(self, user_id: str, folder_id: str) -> None:
        self._client.table("folder_follows").delete() \
            .eq("user_id", user_id).eq("folder_id", folder_id).execute()

    def is_following_folder(self, user_id: str, folder_id: str) -> bool:
        result = self._client.table("folder_follows").select("id") \
            .eq("user_id", user_id).eq("folder_id", folder_id).execute()
        return bool(result.data)

    def get_folder_follower_ids(self, folder_id: str) -> list[str]:
        result = self._client.table("folder_follows").select("user_id") \
            .eq("folder_id", folder_id).execute()
        return [r["user_id"] for r in (result.data or [])]

    def get_folder_follower_count(self, folder_id: str) -> int:
        result = self._client.table("folder_follows").select("id", count="exact") \
            .eq("folder_id", folder_id).execute()
        return result.count or 0

    def get_following_folders(self, user_id: str) -> list[dict]:
        """All public folders the user follows."""
        result = self._client.table("folder_follows").select("folder_id") \
            .eq("user_id", user_id).execute()
        folder_ids = [r["folder_id"] for r in (result.data or [])]
        if not folder_ids:
            return []
        folders = self._client.table("save_folders").select("*") \
            .in_("id", folder_ids).eq("is_public", True).execute()
        return folders.data or []

    # --- Thumbnail helpers ---

    def get_folder_thumbnails(self, folder_ids: list[str]) -> dict[str, str]:
        """
        Returns {folder_id: thumbnail_url} for folders that have image posts.
        Uses 2 queries total regardless of how many folders there are.
        """
        if not folder_ids:
            return {}
        sp = self._client.table("saved_posts").select("folder_id, post_id") \
            .in_("folder_id", folder_ids).order("created_at", desc=True).execute()

        folder_post_ids: dict[str, list[str]] = {}
        for row in (sp.data or []):
            fid = row["folder_id"]
            if fid not in folder_post_ids:
                folder_post_ids[fid] = []
            if len(folder_post_ids[fid]) < 5:
                folder_post_ids[fid].append(row["post_id"])

        all_post_ids = list({pid for pids in folder_post_ids.values() for pid in pids})
        if not all_post_ids:
            return {}

        # post_media is the canonical media table; exclude video entries
        media_res = self._client.table("post_media").select("post_id, url, media_type") \
            .in_("post_id", all_post_ids).execute()
        post_images: dict[str, str] = {}
        for row in (media_res.data or []):
            pid = row["post_id"]
            if pid not in post_images and row.get("media_type") != "video":
                url = row.get("url")
                if url:
                    post_images[pid] = url

        thumbnails: dict[str, str] = {}
        for folder_id, post_ids in folder_post_ids.items():
            for pid in post_ids:
                if pid in post_images:
                    thumbnails[folder_id] = post_images[pid]
                    break
        return thumbnails
