class SupabaseFollowRepository:
    def __init__(self, client):
        self._client = client

    def follow(self, follower_id: str, following_id: str) -> None:
        self._client.table("follows").insert({
            "follower_id": follower_id,
            "following_id": following_id,
        }).execute()

    def unfollow(self, follower_id: str, following_id: str) -> None:
        self._client.table("follows").delete() \
            .eq("follower_id", follower_id) \
            .eq("following_id", following_id).execute()

    def is_following(self, follower_id: str, following_id: str) -> bool:
        result = self._client.table("follows").select("id") \
            .eq("follower_id", follower_id) \
            .eq("following_id", following_id).execute()
        return bool(result.data)

    def get_following_ids(self, user_id: str, limit: int, offset: int) -> list[str]:
        result = self._client.table("follows").select("following_id") \
            .eq("follower_id", user_id) \
            .range(offset, offset + limit - 1).execute()
        return [r["following_id"] for r in (result.data or [])]

    def get_follower_ids(self, user_id: str, limit: int, offset: int) -> list[str]:
        result = self._client.table("follows").select("follower_id") \
            .eq("following_id", user_id) \
            .range(offset, offset + limit - 1).execute()
        return [r["follower_id"] for r in (result.data or [])]
