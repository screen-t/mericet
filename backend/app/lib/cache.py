import time
from threading import Lock
from typing import Any, Optional


class TTLCache:
    def __init__(self, default_ttl: int = 60, max_size: int = 1000):
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = Lock()
        self._default_ttl = default_ttl
        self._max_size = max_size

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        with self._lock:
            if len(self._store) >= self._max_size:
                self._evict_expired()
            expires_at = time.monotonic() + (ttl or self._default_ttl)
            self._store[key] = (value, expires_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [k for k, (_, exp) in self._store.items() if now > exp]
        for k in expired:
            del self._store[k]
        if len(self._store) >= self._max_size:
            oldest = sorted(self._store.items(), key=lambda x: x[1][1])
            for k, _ in oldest[:len(self._store) // 4]:
                del self._store[k]


user_cache = TTLCache(default_ttl=120, max_size=500)
post_cache = TTLCache(default_ttl=30, max_size=500)
