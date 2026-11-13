import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

class SupabaseWorkVerificationRepository:
    def __init__(self, client):
        self._client = client

    def get_by_id(self, experience_id: str) -> Optional[Dict[str, Any]]:
        result = self._client.table("work_experience").select("*").eq("id", experience_id).single().execute()
        return result.data if result and result.data else None

    def search_coworkers(self, company: str, exclude_user_id: str) -> List[Dict[str, Any]]:
        """Search users who have the exact or matching company in their work experience profile."""
        clean_company = company.strip()
        if not clean_company:
            return []

        # Query work_experience with ilike
        result = self._client.table("work_experience") \
            .select("user_id, company, title, position, users(id, username, first_name, last_name)") \
            .ilike("company", f"%{clean_company}%") \
            .neq("user_id", exclude_user_id) \
            .execute()

        matches = result.data or []
        coworkers_map = {}

        for item in matches:
            u_id = item.get("user_id")
            if not u_id or u_id == exclude_user_id:
                continue

            user_obj = item.get("users") or {}
            # Fallback if users relation wasn't expanded
            if not user_obj and u_id not in coworkers_map:
                try:
                    u_res = self._client.table("users").select("id, username, first_name, last_name").eq("id", u_id).single().execute()
                    user_obj = u_res.data or {}
                except Exception:
                    user_obj = {"id": u_id}

            if u_id not in coworkers_map:
                coworkers_map[u_id] = {
                    "id": u_id,
                    "username": user_obj.get("username") or "",
                    "first_name": user_obj.get("first_name") or "",
                    "last_name": user_obj.get("last_name") or "",
                    "company": item.get("company") or clean_company,
                    "title": item.get("title") or item.get("position") or "",
                }

        return list(coworkers_map.values())

    def create_verification_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        result = self._client.table("work_verification_requests").insert(data).execute()
        return result.data[0]

    def get_verification_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        result = self._client.table("work_verification_requests").select("*").eq("id", request_id).single().execute()
        return result.data if result and result.data else None

    def get_latest_verification_request(self, experience_id: str) -> Optional[Dict[str, Any]]:
        result = self._client.table("work_verification_requests") \
            .select("*") \
            .eq("experience_id", experience_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        return result.data[0] if result.data and len(result.data) > 0 else None

    def update_verification_request(self, request_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("work_verification_requests").update(data).eq("id", request_id).execute()
        return result.data[0] if result.data and len(result.data) > 0 else None

    def add_peer_invites(self, request_id: str, peer_user_ids: List[str]) -> List[Dict[str, Any]]:
        rows = [
            {"request_id": request_id, "peer_user_id": pid, "status": "PENDING"}
            for pid in peer_user_ids
        ]
        result = self._client.table("work_p2p_peer_invites").insert(rows).execute()
        return result.data or []

    def get_peer_invite(self, request_id: str, peer_user_id: str) -> Optional[Dict[str, Any]]:
        result = self._client.table("work_p2p_peer_invites") \
            .select("*") \
            .eq("request_id", request_id) \
            .eq("peer_user_id", peer_user_id) \
            .single() \
            .execute()
        return result.data if result and result.data else None

    def update_peer_invite(self, invite_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        data["responded_at"] = datetime.now(timezone.utc).isoformat()
        result = self._client.table("work_p2p_peer_invites").update(data).eq("id", invite_id).execute()
        return result.data[0] if result.data and len(result.data) > 0 else None

    def get_pending_invites_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        result = self._client.table("work_p2p_peer_invites") \
            .select("id, request_id, status, created_at, work_verification_requests(experience_id, company, user_id)") \
            .eq("peer_user_id", user_id) \
            .eq("status", "PENDING") \
            .execute()
        return result.data or []

    def record_blind_approval(self, request_id: str, key_image: str, blind_signature: Dict[str, Any]) -> Dict[str, Any]:
        """Records a blinded ring signature without storing the peer user_id (Anonymity invariant)."""
        row = {
            "request_id": request_id,
            "key_image": key_image,
            "blind_signature": blind_signature,
        }
        result = self._client.table("work_p2p_blind_approvals").insert(row).execute()
        return result.data[0]

    def get_blind_approvals(self, request_id: str) -> List[Dict[str, Any]]:
        result = self._client.table("work_p2p_blind_approvals").select("*").eq("request_id", request_id).execute()
        return result.data or []
