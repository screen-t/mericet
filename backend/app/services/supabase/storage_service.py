from typing import Optional


class SupabaseStorageService:
    def __init__(self, client):
        self._client = client

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        # upsert=true: avatar/cover paths are fixed per user (e.g. "{user_id}/avatar.jpg"),
        # so every re-upload targets the same object — without this, Supabase
        # storage rejects any upload after the first with a 409 Duplicate.
        self._client.storage.from_(bucket).upload(
            path, data, {"content-type": content_type, "upsert": "true"}
        )
        return self.get_public_url(bucket, path)

    def get_public_url(self, bucket: str, path: str) -> str:
        return self._client.storage.from_(bucket).get_public_url(path)

    def delete(self, bucket: str, path: str) -> None:
        self._client.storage.from_(bucket).remove([path])
