from typing import Optional


class SupabasePostRepository:
    def __init__(self, client):
        self._client = client

    # --- Post CRUD ---

    def get_by_id(self, post_id: str) -> Optional[dict]:
        result = self._client.table("posts").select("*") \
            .eq("id", post_id).single().execute()
        return result.data if result.data else None

    def get_feed(self, visibility: str, limit: int, offset: int) -> list[dict]:
        result = self._client.table("posts").select("*") \
            .eq("is_published", True).eq("is_draft", False) \
            .eq("visibility", visibility) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def get_by_author_ids(self, author_ids: list[str],
                          limit: int, offset: int) -> list[dict]:
        if not author_ids:
            return []
        result = self._client.table("posts").select("*") \
            .in_("author_id", author_ids) \
            .eq("is_published", True).eq("is_draft", False) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def get_by_author(self, author_id: str, limit: int,
                      offset: int) -> list[dict]:
        result = self._client.table("posts").select("*") \
            .eq("author_id", author_id) \
            .eq("is_published", True).eq("is_draft", False) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def get_by_ids(self, post_ids: list[str]) -> list[dict]:
        if not post_ids:
            return []
        result = self._client.table("posts").select("*") \
            .in_("id", post_ids).execute()
        return result.data or []

    def create(self, data: dict) -> dict:
        result = self._client.table("posts").insert(data).execute()
        return result.data[0]

    def update(self, post_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("posts").update(data) \
            .eq("id", post_id).execute()
        return result.data[0] if result.data else None

    def delete(self, post_id: str) -> None:
        self._client.table("posts").delete().eq("id", post_id).execute()

    def get_owner(self, post_id: str) -> Optional[str]:
        result = self._client.table("posts").select("author_id") \
            .eq("id", post_id).single().execute()
        return result.data["author_id"] if result.data else None

    def search(self, query: str, limit: int = 20) -> list[dict]:
        result = self._client.table("posts").select("*") \
            .eq("is_published", True) \
            .ilike("content", f"%{query}%") \
            .limit(limit).execute()
        return result.data or []

    def get_trending(self, days: int, limit: int) -> list[dict]:
        try:
            result = self._client.rpc("get_trending_posts", {
                "days_ago": days, "result_limit": limit,
            }).execute()
            return result.data or []
        except Exception:
            return []

    # --- Engagement ---

    def add_like(self, post_id: str, user_id: str) -> None:
        self._client.table("post_likes").insert({
            "post_id": post_id, "user_id": user_id,
        }).execute()

    def remove_like(self, post_id: str, user_id: str) -> None:
        self._client.table("post_likes").delete() \
            .eq("post_id", post_id).eq("user_id", user_id).execute()

    def count_likes(self, post_id: str) -> int:
        result = self._client.table("post_likes") \
            .select("post_id", count="exact") \
            .eq("post_id", post_id).execute()
        return result.count or 0

    def update_like_count(self, post_id: str, count: int) -> None:
        self._client.table("posts").update({"like_count": count}) \
            .eq("id", post_id).execute()

    def add_repost(self, post_id: str, user_id: str) -> None:
        self._client.table("reposts").insert({
            "post_id": post_id, "user_id": user_id,
        }).execute()

    def remove_repost(self, post_id: str, user_id: str) -> None:
        self._client.table("reposts").delete() \
            .eq("post_id", post_id).eq("user_id", user_id).execute()

    def increment_reposts(self, post_id: str) -> None:
        self._client.rpc("increment_post_reposts", {"post_id": post_id}).execute()

    def decrement_reposts(self, post_id: str) -> None:
        self._client.rpc("decrement_post_reposts", {"post_id": post_id}).execute()

    def add_save(self, post_id: str, user_id: str) -> None:
        self._client.table("saved_posts").insert({
            "post_id": post_id, "user_id": user_id,
        }).execute()

    def remove_save(self, post_id: str, user_id: str) -> None:
        self._client.table("saved_posts").delete() \
            .eq("post_id", post_id).eq("user_id", user_id).execute()

    # --- Batch engagement (for bulk_enrich) ---

    def get_liked_post_ids(self, user_id: str,
                           post_ids: list[str]) -> set[str]:
        result = self._client.table("post_likes").select("post_id") \
            .eq("user_id", user_id).in_("post_id", post_ids).execute()
        return {r["post_id"] for r in (result.data or [])}

    def get_reposted_post_ids(self, user_id: str,
                              post_ids: list[str]) -> set[str]:
        result = self._client.table("reposts").select("post_id") \
            .eq("user_id", user_id).in_("post_id", post_ids).execute()
        return {r["post_id"] for r in (result.data or [])}

    def get_saved_post_ids(self, user_id: str,
                           post_ids: list[str]) -> set[str]:
        result = self._client.table("saved_posts").select("post_id") \
            .eq("user_id", user_id).in_("post_id", post_ids).execute()
        return {r["post_id"] for r in (result.data or [])}

    def get_like_counts(self, post_ids: list[str]) -> dict[str, int]:
        result = self._client.table("post_likes").select("post_id") \
            .in_("post_id", post_ids).execute()
        counts: dict[str, int] = {pid: 0 for pid in post_ids}
        for row in (result.data or []):
            pid = row.get("post_id")
            if pid in counts:
                counts[pid] += 1
        return counts

    # --- Media ---

    def get_media(self, post_id: str) -> list[dict]:
        result = self._client.table("post_media").select("*") \
            .eq("post_id", post_id).execute()
        return result.data or []

    def get_media_bulk(self, post_ids: list[str]) -> dict[str, list[dict]]:
        if not post_ids:
            return {}
        result = self._client.table("post_media").select("*") \
            .in_("post_id", post_ids).execute()
        media_map: dict[str, list[dict]] = {}
        for m in (result.data or []):
            media_map.setdefault(m["post_id"], []).append(m)
        return media_map

    def insert_media(self, media_list: list[dict]) -> None:
        if media_list:
            self._client.table("post_media").insert(media_list).execute()

    def delete_media(self, post_id: str) -> None:
        self._client.table("post_media").delete() \
            .eq("post_id", post_id).execute()

    # --- Polls ---

    def create_poll(self, data: dict) -> dict:
        result = self._client.table("post_polls").insert(data).execute()
        return result.data[0]

    def create_poll_options(self, options: list[dict]) -> None:
        if options:
            self._client.table("post_poll_options").insert(options).execute()

    def get_poll_by_post(self, post_id: str) -> Optional[dict]:
        result = self._client.table("post_polls") \
            .select("*, options:post_poll_options(*)") \
            .eq("post_id", post_id).maybe_single().execute()
        if result and result.data:
            poll = result.data
            if poll.get("options"):
                poll["options"].sort(key=lambda o: o.get("display_order", 0))
            return poll
        return None

    def get_polls_bulk(self, post_ids: list[str]) -> dict[str, dict]:
        if not post_ids:
            return {}
        polls_resp = self._client.table("post_polls").select("*") \
            .in_("post_id", post_ids).execute()
        polls_map: dict[str, dict] = {}
        polls_by_id: dict[str, dict] = {}
        for poll in (polls_resp.data or []):
            polls_map[poll["post_id"]] = poll
            polls_by_id[poll["id"]] = poll

        if polls_by_id:
            options_resp = self._client.table("post_poll_options") \
                .select("*").in_("poll_id", list(polls_by_id.keys())) \
                .order("display_order").execute()
            for opt in (options_resp.data or []):
                polls_by_id[opt["poll_id"]].setdefault("options", []).append(opt)
        return polls_map

    def get_poll_user_vote(self, poll_id: str, user_id: str) -> Optional[str]:
        result = self._client.table("post_poll_votes").select("option_id") \
            .eq("poll_id", poll_id).eq("user_id", user_id).execute()
        return result.data[0]["option_id"] if result.data else None

    def get_poll_user_votes_bulk(self, poll_ids: list[str],
                                 user_id: str) -> dict[str, str]:
        if not poll_ids:
            return {}
        result = self._client.table("post_poll_votes") \
            .select("poll_id, option_id").eq("user_id", user_id) \
            .in_("poll_id", poll_ids).execute()
        return {v["poll_id"]: v["option_id"] for v in (result.data or [])}

    def get_poll_id_for_post(self, post_id: str) -> Optional[str]:
        result = self._client.table("post_polls").select("id") \
            .eq("post_id", post_id).single().execute()
        return result.data["id"] if result.data else None

    def get_existing_vote(self, poll_id: str, user_id: str) -> Optional[dict]:
        result = self._client.table("post_poll_votes").select("*") \
            .eq("poll_id", poll_id).eq("user_id", user_id).execute()
        return result.data[0] if result.data else None

    def update_vote(self, poll_id: str, user_id: str, option_id: str) -> None:
        self._client.table("post_poll_votes") \
            .update({"option_id": option_id}) \
            .eq("poll_id", poll_id).eq("user_id", user_id).execute()

    def insert_vote(self, data: dict) -> None:
        self._client.table("post_poll_votes").insert(data).execute()

    def increment_poll_votes(self, option_id: str) -> None:
        self._client.rpc("increment_poll_option_votes", {"option_id": option_id}).execute()

    def decrement_poll_votes(self, option_id: str) -> None:
        self._client.rpc("decrement_poll_option_votes", {"option_id": option_id}).execute()

    # --- Comments ---

    def get_comments(self, post_id: str, limit: int, offset: int) -> list[dict]:
        result = self._client.table("comments") \
            .select("*, author:author_id(id, username, first_name, last_name, avatar_url)") \
            .eq("post_id", post_id) \
            .is_("parent_comment_id", "null") \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1).execute()
        return result.data or []

    def create_comment(self, data: dict) -> dict:
        result = self._client.table("comments").insert(data).execute()
        return result.data[0]

    def get_comment_owner(self, comment_id: str) -> Optional[dict]:
        result = self._client.table("comments") \
            .select("author_id, post_id") \
            .eq("id", comment_id).single().execute()
        return result.data if result.data else None

    def update_comment(self, comment_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("comments").update(data) \
            .eq("id", comment_id).execute()
        return result.data[0] if result.data else None

    def delete_comment(self, comment_id: str) -> None:
        self._client.table("comments").delete() \
            .eq("id", comment_id).execute()

    def increment_comments(self, post_id: str) -> None:
        self._client.rpc("increment_post_comments", {"post_id": post_id}).execute()

    def decrement_comments(self, post_id: str) -> None:
        self._client.rpc("decrement_post_comments", {"post_id": post_id}).execute()

    def get_liked_comment_ids(self, user_id: str,
                              comment_ids: list[str]) -> set[str]:
        if not comment_ids:
            return set()
        result = self._client.table("comment_likes").select("comment_id") \
            .eq("user_id", user_id).in_("comment_id", comment_ids).execute()
        return {r["comment_id"] for r in (result.data or [])}
