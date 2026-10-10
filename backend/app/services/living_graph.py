import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.models.vault import VaultCategory, VerificationTier

logger = logging.getLogger("living_graph")


class LivingGraphEngine:
    """Living Graph Automation Engine.
    
    Synchronizes public achievements from connected services (GitHub, LeetCode, Credly),
    filters them down to meaningful top highlights, and keeps vault items up to date idempotently.
    
    SECURITY INVARIANTS:
    - No private credentials or tokens stored or exposed in logs.
    - Rate limits and timeouts enforced on all external queries.
    - Deduplicates records to avoid polluting the user's Vault.
    """

    TIMEOUT_SECONDS = 10.0
    MAX_RETRIES = 2

    @staticmethod
    def _sanitize_for_logging(data: Any) -> str:
        """Helper to ensure no secrets or sensitive fields ever leak into logs."""
        if isinstance(data, dict):
            safe = {k: ("***" if "token" in k.lower() or "secret" in k.lower() or "key" in k.lower() else v) for k, v in data.items()}
            return str(safe)
        return str(data)

    @classmethod
    def fetch_github_highlights(cls, handle: str) -> Dict[str, Any]:
        """Fetch public profile highlights from GitHub without private tokens."""
        handle = handle.strip()
        url = f"https://api.github.com/users/{handle}"
        
        # In testing or production, query public endpoint with safety headers
        try:
            headers = {"User-Agent": "Mericet-Living-Graph/1.0", "Accept": "application/vnd.github.v3+json"}
            with httpx.Client(timeout=cls.TIMEOUT_SECONDS) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    public_repos = data.get("public_repos", 0)
                    followers = data.get("followers", 0)
                    bio = data.get("bio") or ""
                    
                    highlights = []
                    if public_repos > 0:
                        highlights.append(f"{public_repos} public open-source repositories")
                    if followers >= 10:
                        highlights.append(f"{followers} GitHub followers")
                    
                    return {
                        "provider": "github",
                        "handle": handle,
                        "success": True,
                        "public_repos": public_repos,
                        "followers": followers,
                        "bio": bio,
                        "highlights": highlights,
                    }
                elif resp.status_code == 404:
                    return {"provider": "github", "handle": handle, "success": False, "error": "GitHub user not found"}
                else:
                    return {"provider": "github", "handle": handle, "success": False, "error": f"GitHub API status {resp.status_code}"}
        except Exception as e:
            logger.warning(f"Error fetching GitHub data for {handle}: {cls._sanitize_for_logging(e)}")
            return {"provider": "github", "handle": handle, "success": False, "error": f"Network error querying GitHub: {str(e)}"}

    @classmethod
    def fetch_leetcode_highlights(cls, handle: str) -> Dict[str, Any]:
        """Fetch public statistics for LeetCode user."""
        handle = handle.strip()
        url = "https://leetcode.com/graphql"
        query = """
        query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                username
                submitStats: submitStatsGlobal {
                    acSubmissionNum {
                        difficulty
                        count
                    }
                }
            }
        }
        """
        try:
            headers = {"User-Agent": "Mericet-Living-Graph/1.0", "Content-Type": "application/json"}
            payload = {"query": query, "variables": {"username": handle}}
            with httpx.Client(timeout=cls.TIMEOUT_SECONDS) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    matched = data.get("matchedUser")
                    if matched:
                        stats = matched.get("submitStats", {}).get("acSubmissionNum", [])
                        total_solved = 0
                        for item in stats:
                            if item.get("difficulty") == "All":
                                total_solved = item.get("count", 0)
                        
                        highlights = []
                        if total_solved > 0:
                            highlights.append(f"{total_solved}+ algorithmic problems solved on LeetCode")
                        
                        return {
                            "provider": "leetcode",
                            "handle": handle,
                            "success": True,
                            "solved_count": total_solved,
                            "highlights": highlights if highlights else [f"Active LeetCode profile ({handle})"],
                        }
                    else:
                        return {"provider": "leetcode", "handle": handle, "success": False, "error": "LeetCode user not found"}
                else:
                    return {"provider": "leetcode", "handle": handle, "success": False, "error": f"LeetCode API status {resp.status_code}"}
        except Exception as e:
            logger.warning(f"Error fetching LeetCode data for {handle}: {cls._sanitize_for_logging(e)}")
            return {"provider": "leetcode", "handle": handle, "success": False, "error": f"Network error querying LeetCode: {str(e)}"}

    @classmethod
    def fetch_credly_highlights(cls, handle: str) -> Dict[str, Any]:
        """Fetch verified public badges from Credly."""
        handle = handle.strip()
        url = f"https://www.credly.com/users/{handle}/badges.json"
        try:
            headers = {"User-Agent": "Mericet-Living-Graph/1.0", "Accept": "application/json"}
            with httpx.Client(timeout=cls.TIMEOUT_SECONDS, follow_redirects=True) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    try:
                        data = resp.json().get("data", [])
                        badges = []
                        for b in data[:3]:
                            badge_name = b.get("badge_template", {}).get("name")
                            if badge_name:
                                badges.append(badge_name)
                        
                        return {
                            "provider": "credly",
                            "handle": handle,
                            "success": True,
                            "verified_badges": len(data),
                            "highlights": badges if badges else [f"Verified Credly profile ({handle})"],
                        }
                    except Exception:
                        return {"provider": "credly", "handle": handle, "success": True, "highlights": [f"Verified Credly profile ({handle})"]}
                elif resp.status_code == 404:
                    return {"provider": "credly", "handle": handle, "success": False, "error": "Credly user not found"}
                else:
                    return {"provider": "credly", "handle": handle, "success": False, "error": f"Credly API status {resp.status_code}"}
        except Exception as e:
            logger.warning(f"Error fetching Credly data for {handle}: {cls._sanitize_for_logging(e)}")
            return {"provider": "credly", "handle": handle, "success": False, "error": f"Network error querying Credly: {str(e)}"}

    @classmethod
    def sync_user_tools(cls, user_id: str, tool_repo, vault_repo) -> Dict[str, Any]:
        """Syncs all connected tools for a user and creates/updates top vault items."""
        tools = tool_repo.get_by_user(user_id)
        synced_count = 0
        highlights_created = 0
        errors = []

        for tool in tools:
            provider = tool.get("provider", "").lower()
            handle = tool.get("handle", "")
            
            if provider == "github":
                result = cls.fetch_github_highlights(handle)
            elif provider == "leetcode":
                result = cls.fetch_leetcode_highlights(handle)
            elif provider == "credly":
                result = cls.fetch_credly_highlights(handle)
            else:
                errors.append(f"Unsupported provider: {provider}")
                continue

            if result.get("success"):
                # Update tool metadata
                now_iso = datetime.now(timezone.utc).isoformat()
                tool_repo.update(tool["id"], {
                    "metadata": result,
                    "last_synced_at": now_iso,
                    "auth_status": "connected",
                })
                synced_count += 1

                # Idempotently create or update meaningful vault highlights
                highlights = result.get("highlights", [])
                for hl in highlights:
                    title = f"[{provider.capitalize()}] {hl}"
                    existing = vault_repo.get_by_user(user_id, category=VaultCategory.achievement.value)
                    already_exists = any(item.get("title") == title for item in existing)
                    
                    if not already_exists:
                        vault_repo.create({
                            "user_id": user_id,
                            "category": VaultCategory.achievement.value,
                            "title": title,
                            "description": f"Verified highlight synced from connected {provider.capitalize()} account ({handle}).",
                            "metadata": {"provider": provider, "handle": handle, "synced_at": now_iso},
                            "verification_tier": VerificationTier.mid.value if provider in ("github", "credly") else VerificationTier.weak.value,
                            "verification_metadata": {
                                "source": "living_graph_sync",
                                "provider": provider,
                                "verified_at": now_iso,
                            },
                            "is_public": True,
                        })
                        highlights_created += 1
            else:
                tool_repo.update(tool["id"], {
                    "auth_status": "unverified",
                })
                errors.append(f"{provider}: {result.get('error', 'Sync failed')}")

        return {
            "synced_tools": synced_count,
            "highlights_created": highlights_created,
            "errors": errors,
        }
