from typing import Optional
from app.services.protocols import AuthService, AuthUser, AuthResult, AuthSession
import logging


class SupabaseAuthService:
    def __init__(self, client):
        self._client = client

    def validate_token(self, token: str) -> Optional[str]:
        try:
            user_res = self._client.auth.get_user(token)
            if not user_res.user:
                return None
            return user_res.user.id
        except Exception:
            return None

    def sign_up(self, email: str, password: str) -> AuthResult:
        res = self._client.auth.sign_up({"email": email, "password": password})
        return self._to_auth_result(res)

    def sign_in(self, email: str, password: str) -> AuthResult:
        res = self._client.auth.sign_in_with_password({
            "email": email, "password": password
        })
        return self._to_auth_result(res)

    def sign_out(self, refresh_token: str) -> None:
        self._client.auth.sign_out(refresh_token)

    def refresh_session(self, refresh_token: str) -> AuthResult:
        res = self._client.auth.refresh_session(refresh_token)
        return self._to_auth_result(res)

    def reset_password_email(self, email: str) -> None:
        self._client.auth.reset_password_email(email)

    def update_password(self, access_token: str, new_password: str) -> None:
        self._client.auth.update_user(access_token, {"password": new_password})

    def get_user_by_id(self, user_id: str) -> Optional[AuthUser]:
        try:
            res = self._client.auth.admin.get_user_by_id(user_id)
            user = res.user if res else None
            if not user:
                return None
            metadata = user.user_metadata if user.user_metadata else {}
            return AuthUser(
                id=user.id,
                email=user.email,
                user_metadata=metadata,
            )
        except Exception as e:
            logging.warning(f"get_user_by_id failed for {user_id}: {e}")
            return None

    def _to_auth_result(self, res) -> AuthResult:
        user = None
        session = None
        if res.user:
            metadata = res.user.user_metadata if hasattr(res.user, 'user_metadata') else {}
            user = AuthUser(
                id=res.user.id,
                email=res.user.email,
                user_metadata=metadata or {},
            )
        if res.session:
            session = AuthSession(
                access_token=res.session.access_token,
                refresh_token=res.session.refresh_token,
            )
        return AuthResult(user=user, session=session)
