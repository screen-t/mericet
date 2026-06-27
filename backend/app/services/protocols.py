from typing import Protocol, Optional
from dataclasses import dataclass, field


@dataclass
class AuthUser:
    id: str
    email: Optional[str] = None
    user_metadata: Optional[dict] = field(default_factory=dict)


@dataclass
class AuthSession:
    access_token: str
    refresh_token: str


@dataclass
class AuthResult:
    user: Optional[AuthUser] = None
    session: Optional[AuthSession] = None


class AuthService(Protocol):
    def validate_token(self, token: str) -> Optional[str]:
        """Validate bearer token, return user_id or None."""
        ...

    def sign_up(self, email: str, password: str) -> AuthResult: ...
    def sign_in(self, email: str, password: str) -> AuthResult: ...
    def sign_out(self, refresh_token: str) -> None: ...
    def refresh_session(self, refresh_token: str) -> AuthResult: ...
    def reset_password_email(self, email: str) -> None: ...
    def update_password(self, access_token: str, new_password: str) -> None: ...
    def get_user_by_id(self, user_id: str) -> Optional[AuthUser]: ...


class StorageService(Protocol):
    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        """Upload file and return public URL."""
        ...

    def get_public_url(self, bucket: str, path: str) -> str: ...
    def delete(self, bucket: str, path: str) -> None: ...
