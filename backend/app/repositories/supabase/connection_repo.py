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

    def either_blocked(self, user1_id: str, user2_id: str) -> bool:
        result = self._client.table("connections").select("id").or_(
            f"and(requester_id.eq.{user1_id},receiver_id.eq.{user2_id}),"
            f"and(requester_id.eq.{user2_id},receiver_id.eq.{user1_id})"
        ).eq("status", "blocked").limit(1).execute()
        return bool(result.data)

    def count_accepted(self, user_id: str) -> int:
        result = self._client.table("connections") \
            .select("id", count="exact") \
            .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}") \
            .eq("status", "accepted").execute()
        return result.count or 0

    def get_connections_of_ids(self, user_ids: list[str]) -> list[dict]:
        """Return all accepted connection pairs involving any of the given users."""
        if not user_ids:
            return []
        # Two queries (requester side + receiver side) are simpler and safer than
        # a giant OR string, then deduplicate in Python.
        r1 = self._client.table("connections") \
            .select("requester_id, receiver_id") \
            .in_("requester_id", user_ids).eq("status", "accepted").execute()
        r2 = self._client.table("connections") \
            .select("requester_id, receiver_id") \
            .in_("receiver_id", user_ids).eq("status", "accepted").execute()
        return (r1.data or []) + (r2.data or [])

    def get_suggestions(self, user_id: str, exclude_ids: list[str],
                        limit: int, my_connected_ids: list[str] | None = None,
                        my_industry: str | None = None) -> list[dict]:
        # Fetch a larger pool so we can rank and trim
        pool_size = min(limit * 5, 200)
        result = self._client.table("users") \
            .select("id, username, first_name, last_name, avatar_url, headline, current_position, current_company, industry") \
            .not_.in_("id", list(exclude_ids)) \
            .eq("is_active", True).limit(pool_size).execute()
        candidates = result.data or []
        if not candidates:
            return []

        # Build mutual-connection counts: find 2nd-degree connections
        my_set = set(my_connected_ids or [])
        candidate_id_set = {c["id"] for c in candidates}
        mutual_counts: dict[str, int] = {}
        if my_set:
            pairs = self.get_connections_of_ids(list(candidate_id_set))
            for pair in pairs:
                req, rec = pair["requester_id"], pair["receiver_id"]
                # One side is the candidate, the other is their connection peer
                if req in candidate_id_set and rec in my_set:
                    mutual_counts[req] = mutual_counts.get(req, 0) + 1
                elif rec in candidate_id_set and req in my_set:
                    mutual_counts[rec] = mutual_counts.get(rec, 0) + 1

        def _score(c: dict) -> float:
            score = mutual_counts.get(c["id"], 0) * 5.0
            if my_industry and c.get("industry") == my_industry:
                score += 3.0
            if c.get("headline"):
                score += 1.0
            if c.get("avatar_url"):
                score += 1.0
            if c.get("current_position"):
                score += 0.5
            return score

        candidates.sort(key=_score, reverse=True)
        return candidates[:limit]

    # --- Connection Notes ---

    def get_note(self, user_id: str, target_user_id: str) -> Optional[dict]:
        try:
            result = self._client.table("connection_notes").select("*") \
                .eq("user_id", user_id).eq("target_user_id", target_user_id) \
                .maybe_single().execute()
            return result.data if result and result.data else None
        except Exception:
            return None

    def upsert_note(self, user_id: str, target_user_id: str, note: str) -> dict:
        result = self._client.table("connection_notes").upsert({
            "user_id": user_id,
            "target_user_id": target_user_id,
            "note": note,
            "updated_at": "now()",
        }).execute()
        return result.data[0]

    def delete_note(self, user_id: str, target_user_id: str) -> None:
        self._client.table("connection_notes").delete() \
            .eq("user_id", user_id).eq("target_user_id", target_user_id).execute()
