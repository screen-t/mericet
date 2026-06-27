from typing import Optional


class SupabaseStorageService:
    def __init__(self, client):
        self._client = client

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        self._client.storage.from_(bucket).upload(
            path, data, {"content-type": content_type}
        )
        return self.get_public_url(bucket, path)

    def get_public_url(self, bucket: str, path: str) -> str:
        return self._client.storage.from_(bucket).get_public_url(path)

    def delete(self, bucket: str, path: str) -> None:
        self._client.storage.from_(bucket).remove([path])
