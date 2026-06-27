from typing import Optional
from datetime import datetime
import logging


class SupabaseUserRepository:
    def __init__(self, client):
        self._client = client

    def get_by_id(self, user_id: str, fields: str = "*") -> Optional[dict]:
        result = self._client.table("users").select(fields) \
            .eq("id", user_id).single().execute()
        return result.data if result.data else None

    def get_by_username(self, username: str) -> Optional[dict]:
        result = self._client.table("users").select("*") \
            .eq("username", username).single().execute()
        return result.data if result.data else None

    def get_many_by_ids(self, user_ids: list[str], fields: str = "*") -> list[dict]:
        if not user_ids:
            return []
        result = self._client.table("users").select(fields) \
            .in_("id", user_ids).execute()
        return result.data or []

    def create(self, data: dict) -> dict:
        result = self._client.table("users").insert(data).execute()
        return result.data[0]

    def upsert(self, data: dict) -> dict:
        result = self._client.table("users").upsert(data).execute()
        return result.data[0]

    def update(self, user_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("users").update(data) \
            .eq("id", user_id).execute()
        return result.data[0] if result.data else None

    def check_username_available(self, username: str) -> bool:
        try:
            result = self._client.table("users").select("id") \
                .eq("username", username.lower()).execute()
            if hasattr(result, 'data') and result.data is not None:
                return len(result.data) == 0
            return False
        except Exception:
            return False

    def check_email_available(self, email: str) -> bool:
        result = self._client.table("users").select("id") \
            .eq("email", email).limit(1).execute()
        return not bool(result.data)

    def search(self, query: str, limit: int = 20) -> list[dict]:
        result = self._client.table("users") \
            .select("id, username, first_name, last_name, avatar_url, headline") \
            .or_(f"username.ilike.%{query}%,first_name.ilike.%{query}%,last_name.ilike.%{query}%") \
            .limit(limit).execute()
        return result.data or []

    def get_connections_count(self, user_id: str) -> int:
        try:
            result = self._client.table("connections") \
                .select("id", count="exact") \
                .or_(f"requester_id.eq.{user_id},receiver_id.eq.{user_id}") \
                .eq("status", "accepted").execute()
            return result.count or 0
        except Exception:
            return 0

    def search_companies(self, query: str, limit: int = 20) -> list[str]:
        search_term = f"%{query}%"
        result = self._client.table("users").select("current_company") \
            .ilike("current_company", search_term) \
            .neq("current_company", None).limit(limit * 3).execute()
        seen = set()
        companies = []
        for row in (result.data or []):
            name = (row.get("current_company") or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            companies.append(name)
            if len(companies) >= limit:
                break
        return companies

    def get_followers_count(self, user_id: str) -> int:
        try:
            result = self._client.table("follows") \
                .select("id", count="exact") \
                .eq("following_id", user_id).execute()
            return result.count or 0
        except Exception:
            return 0


class SupabaseWorkExperienceRepository:
    def __init__(self, client):
        self._client = client

    def get_by_user(self, user_id: str) -> list[dict]:
        result = self._client.table("work_experience").select("*") \
            .eq("user_id", user_id).order("start_date", desc=True).execute()
        return result.data or []

    def get_owner(self, experience_id: str) -> Optional[str]:
        result = self._client.table("work_experience").select("user_id") \
            .eq("id", experience_id).single().execute()
        return result.data["user_id"] if result.data else None

    def create(self, data: dict) -> dict:
        result = self._client.table("work_experience").insert(data).execute()
        return result.data[0]

    def update(self, experience_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("work_experience") \
            .update(data).eq("id", experience_id).execute()
        return result.data[0] if result.data else None

    def delete(self, experience_id: str) -> None:
        self._client.table("work_experience") \
            .delete().eq("id", experience_id).execute()


class SupabaseEducationRepository:
    def __init__(self, client):
        self._client = client

    def get_by_user(self, user_id: str) -> list[dict]:
        result = self._client.table("education").select("*") \
            .eq("user_id", user_id).order("start_date", desc=True).execute()
        return result.data or []

    def get_owner(self, education_id: str) -> Optional[str]:
        result = self._client.table("education").select("user_id") \
            .eq("id", education_id).single().execute()
        return result.data["user_id"] if result.data else None

    def create(self, data: dict) -> dict:
        result = self._client.table("education").insert(data).execute()
        return result.data[0]

    def update(self, education_id: str, data: dict) -> Optional[dict]:
        result = self._client.table("education") \
            .update(data).eq("id", education_id).execute()
        return result.data[0] if result.data else None

    def delete(self, education_id: str) -> None:
        self._client.table("education") \
            .delete().eq("id", education_id).execute()


class SupabaseSkillRepository:
    def __init__(self, client):
        self._client = client

    def get_by_user(self, user_id: str) -> list[dict]:
        result = self._client.table("user_skills").select("*") \
            .eq("user_id", user_id).execute()
        return result.data or []

    def get_owner(self, skill_id: str) -> Optional[str]:
        result = self._client.table("user_skills").select("user_id") \
            .eq("id", skill_id).single().execute()
        return result.data["user_id"] if result.data else None

    def create(self, data: dict) -> dict:
        result = self._client.table("user_skills").insert(data).execute()
        return result.data[0]

    def delete(self, skill_id: str) -> None:
        self._client.table("user_skills") \
            .delete().eq("id", skill_id).execute()


class SupabaseLoginActivityRepository:
    def __init__(self, client):
        self._client = client

    def track(self, data: dict) -> None:
        try:
            self._client.table("login_activity").insert(data).execute()
        except Exception as e:
            logging.warning(f"Failed to track login activity (non-fatal): {e}")

    def deactivate_session(self, session_id: str) -> None:
        try:
            self._client.table("login_activity").update({
                "is_active": False,
                "logout_at": datetime.utcnow().isoformat(),
            }).eq("session_id", session_id).execute()
        except Exception as e:
            logging.warning(f"Failed to deactivate session (non-fatal): {e}")
