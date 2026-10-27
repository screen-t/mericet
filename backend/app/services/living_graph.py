import os
import random
import time
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from app.models.vault import VaultCategory, VerificationTier

logger = logging.getLogger("living_graph")


# ==================== DATA STRUCTURES ====================

class RawAchievement:
    """Standardized normalized achievement from any provider."""
    def __init__(
        self,
        provider: str,
        handle: str,
        external_id: str,
        achievement_type: str,
        title: str,
        description: str,
        source_url: Optional[str] = None,
        observed_at: Optional[datetime] = None,
        raw_metric_value: Optional[float] = None,
        metric_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.provider = provider
        self.handle = handle
        self.external_id = external_id
        self.achievement_type = achievement_type
        self.title = title
        self.description = description
        self.source_url = source_url
        self.observed_at = observed_at or datetime.now(timezone.utc)
        self.fetched_at = datetime.now(timezone.utc)
        self.raw_metric_value = raw_metric_value
        self.metric_name = metric_name
        self.metadata = metadata or {}


class ProviderFetchResult:
    def __init__(
        self,
        success: bool,
        provider: str,
        handle: str,
        raw_achievements: Optional[List[RawAchievement]] = None,
        summary_stats: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        cursor: Optional[str] = None,
    ):
        self.success = success
        self.provider = provider
        self.handle = handle
        self.raw_achievements = raw_achievements or []
        self.summary_stats = summary_stats or {}
        self.error = error
        self.cursor = cursor


# ==================== PROVIDER ADAPTERS ====================

class BaseProviderAdapter:
    provider_name: str = "base"

    def is_configured(self) -> bool:
        return True

    def fetch(self, handle: str, cursor: Optional[str] = None, credentials: Optional[dict] = None) -> ProviderFetchResult:
        raise NotImplementedError


class GitHubAdapter(BaseProviderAdapter):
    provider_name = "github"
    TIMEOUT = 10.0

    @classmethod
    def _execute_with_retry(cls, client: httpx.Client, url: str, headers: dict) -> httpx.Response:
        """Bounded retry with exponential backoff and jitter."""
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                resp = client.get(url, headers=headers)
                if resp.status_code in (429, 500, 502, 503, 504) and attempt < max_retries:
                    # Exponential backoff: (1s, 2s) + jitter
                    delay = (2 ** attempt) + random.uniform(0.1, 0.5)
                    time.sleep(delay)
                    continue
                return resp
            except (httpx.ConnectError, httpx.TimeoutException, httpx.ReadTimeout):
                if attempt < max_retries:
                    delay = (2 ** attempt) + random.uniform(0.1, 0.5)
                    time.sleep(delay)
                    continue
                raise
        return resp

    def fetch(self, handle: str, cursor: Optional[str] = None, credentials: Optional[dict] = None) -> ProviderFetchResult:
        handle = handle.strip()
        user_url = f"https://api.github.com/users/{handle}"
        repos_url = f"https://api.github.com/users/{handle}/repos?sort=updated&per_page=15"
        
        headers = {
            "User-Agent": "Mericet-Living-Graph/1.0",
            "Accept": "application/vnd.github.v3+json",
        }
        # If integration credentials or server GITHUB_TOKEN exists, attach securely (never logged)
        token = (credentials or {}).get("access_token") or os.getenv("GITHUB_API_TOKEN")
        if token:
            headers["Authorization"] = f"token {token}"

        try:
            with httpx.Client(timeout=self.TIMEOUT) as client:
                user_resp = self._execute_with_retry(client, user_url, headers)
                if user_resp.status_code == 404:
                    return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error="GitHub user not found")
                elif user_resp.status_code != 200:
                    return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error=f"GitHub API status {user_resp.status_code}")

                user_data = user_resp.json()
                public_repos = user_data.get("public_repos", 0)
                followers = user_data.get("followers", 0)

                raw_achievements: List[RawAchievement] = []
                now = datetime.now(timezone.utc)

                # Milestone 1: Open source repository milestone
                if public_repos >= 5:
                    milestone_bracket = (public_repos // 10) * 10 if public_repos >= 10 else 5
                    raw_achievements.append(RawAchievement(
                        provider=self.provider_name,
                        handle=handle,
                        external_id=f"github:user:{handle}:public_repos_milestone",
                        achievement_type="metric_milestone",
                        title=f"{milestone_bracket}+ Public Open Source Repositories",
                        description=f"Authored and published {public_repos} public software repositories on GitHub.",
                        source_url=f"https://github.com/{handle}",
                        observed_at=now,
                        raw_metric_value=float(public_repos),
                        metric_name="public_repos",
                        metadata={"total_repos": public_repos, "milestone_bracket": milestone_bracket},
                    ))

                # Fetch repositories to extract notable projects (>0 stars or forks)
                try:
                    repos_resp = self._execute_with_retry(client, repos_url, headers)
                    if repos_resp.status_code == 200:
                        repos = repos_resp.json()
                        for repo in repos:
                            if not isinstance(repo, dict) or repo.get("fork"):
                                continue
                            stars = repo.get("stargazers_count", 0)
                            forks = repo.get("forks_count", 0)
                            repo_name = repo.get("name")
                            repo_desc = repo.get("description") or f"Public repository by {handle}"
                            html_url = repo.get("html_url")

                            # Capture notable projects: repo with stars or significant activity
                            if stars >= 2 or forks >= 2:
                                raw_achievements.append(RawAchievement(
                                    provider=self.provider_name,
                                    handle=handle,
                                    external_id=f"github:repo:{repo.get('id', repo_name)}",
                                    achievement_type="project_milestone",
                                    title=f"Open Source Project: {repo_name}",
                                    description=f"{repo_desc} ({stars} stars, {forks} forks)",
                                    source_url=html_url,
                                    observed_at=now,
                                    raw_metric_value=float(stars),
                                    metric_name="repo_stars",
                                    metadata={"repo_name": repo_name, "stars": stars, "forks": forks},
                                ))
                except Exception as repo_err:
                    logger.warning(f"Error fetching GitHub repos for {handle}: {str(repo_err)}")

                # Milestone 2: Followers milestone (notable peer reach)
                if followers >= 25:
                    follower_bracket = (followers // 25) * 25
                    raw_achievements.append(RawAchievement(
                        provider=self.provider_name,
                        handle=handle,
                        external_id=f"github:user:{handle}:followers_milestone",
                        achievement_type="metric_milestone",
                        title=f"{follower_bracket}+ GitHub Followers",
                        description=f"Built a verified technical following of {followers} developers on GitHub.",
                        source_url=f"https://github.com/{handle}",
                        observed_at=now,
                        raw_metric_value=float(followers),
                        metric_name="github_followers",
                        metadata={"followers": followers},
                    ))

                return ProviderFetchResult(
                    success=True,
                    provider=self.provider_name,
                    handle=handle,
                    raw_achievements=raw_achievements,
                    summary_stats={"public_repos": public_repos, "followers": followers},
                )
        except Exception as e:
            logger.warning(f"Error querying GitHub for {handle}: {str(e)}")
            return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error=f"Network error querying GitHub: {str(e)}")


class LeetCodeAdapter(BaseProviderAdapter):
    provider_name = "leetcode"
    TIMEOUT = 10.0
    GRAPHQL_URL = "https://leetcode.com/graphql"

    QUERY = """
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

    def fetch(self, handle: str, cursor: Optional[str] = None, credentials: Optional[dict] = None) -> ProviderFetchResult:
        handle = handle.strip()
        headers = {
            "User-Agent": "Mericet-Living-Graph/1.0",
            "Content-Type": "application/json",
        }
        payload = {"query": self.QUERY, "variables": {"username": handle}}

        try:
            with httpx.Client(timeout=self.TIMEOUT) as client:
                resp = client.post(self.GRAPHQL_URL, json=payload, headers=headers)
                if resp.status_code != 200:
                    return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error=f"LeetCode API status {resp.status_code}")

                data = resp.json().get("data", {})
                matched = data.get("matchedUser")
                if not matched:
                    return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error="LeetCode user not found")

                stats = matched.get("submitStats", {}).get("acSubmissionNum", [])
                total_solved = 0
                easy_solved = 0
                medium_solved = 0
                hard_solved = 0

                for item in stats:
                    diff = item.get("difficulty")
                    cnt = item.get("count", 0)
                    if diff == "All":
                        total_solved = cnt
                    elif diff == "Easy":
                        easy_solved = cnt
                    elif diff == "Medium":
                        medium_solved = cnt
                    elif diff == "Hard":
                        hard_solved = cnt

                raw_achievements: List[RawAchievement] = []
                now = datetime.now(timezone.utc)

                # Milestones: Only retain meaningful problem solving brackets
                # (e.g. 25+, 50+, 100+, 250+, 500+)
                if total_solved >= 25:
                    if total_solved >= 500:
                        bracket = 500
                    elif total_solved >= 250:
                        bracket = 250
                    elif total_solved >= 100:
                        bracket = 100
                    elif total_solved >= 50:
                        bracket = 50
                    else:
                        bracket = 25

                    raw_achievements.append(RawAchievement(
                        provider=self.provider_name,
                        handle=handle,
                        external_id=f"leetcode:user:{handle}:solved_milestone",
                        achievement_type="algorithmic_milestone",
                        title=f"{bracket}+ Algorithmic Challenges Solved",
                        description=f"Solved {total_solved} algorithm problems ({easy_solved} Easy, {medium_solved} Medium, {hard_solved} Hard) on LeetCode.",
                        source_url=f"https://leetcode.com/{handle}",
                        observed_at=now,
                        raw_metric_value=float(total_solved),
                        metric_name="leetcode_solved",
                        metadata={
                            "total_solved": total_solved,
                            "easy": easy_solved,
                            "medium": medium_solved,
                            "hard": hard_solved,
                            "milestone_bracket": bracket,
                        },
                    ))

                return ProviderFetchResult(
                    success=True,
                    provider=self.provider_name,
                    handle=handle,
                    raw_achievements=raw_achievements,
                    summary_stats={"total_solved": total_solved, "medium": medium_solved, "hard": hard_solved},
                )
        except Exception as e:
            logger.warning(f"Error querying LeetCode for {handle}: {str(e)}")
            return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error=f"Network error querying LeetCode: {str(e)}")


class CredlyAdapter(BaseProviderAdapter):
    provider_name = "credly"
    TIMEOUT = 10.0

    def fetch(self, handle: str, cursor: Optional[str] = None, credentials: Optional[dict] = None) -> ProviderFetchResult:
        handle = handle.strip()
        url = f"https://www.credly.com/users/{handle}/badges.json"
        headers = {
            "User-Agent": "Mericet-Living-Graph/1.0",
            "Accept": "application/json",
        }

        try:
            with httpx.Client(timeout=self.TIMEOUT, follow_redirects=True) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 404:
                    return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error="Credly user not found")
                elif resp.status_code != 200:
                    return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error=f"Credly API status {resp.status_code}")

                badges_data = resp.json().get("data", [])
                raw_achievements: List[RawAchievement] = []
                now = datetime.now(timezone.utc)

                # Extract each verified credential
                for b in badges_data[:10]:
                    template = b.get("badge_template") or {}
                    badge_id = b.get("id") or template.get("id")
                    badge_name = template.get("name")
                    issuer = (template.get("issuer") or {}).get("name") or "Credly Accredited Issuer"
                    badge_url = b.get("badge_url") or f"https://www.credly.com/badges/{badge_id}"

                    if badge_id and badge_name:
                        raw_achievements.append(RawAchievement(
                            provider=self.provider_name,
                            handle=handle,
                            external_id=f"credly:badge:{badge_id}",
                            achievement_type="credential",
                            title=badge_name,
                            description=f"Verified credential issued by {issuer}.",
                            source_url=badge_url,
                            observed_at=now,
                            raw_metric_value=1.0,
                            metric_name="verified_credential",
                            metadata={"badge_id": badge_id, "issuer": issuer, "badge_name": badge_name},
                        ))

                return ProviderFetchResult(
                    success=True,
                    provider=self.provider_name,
                    handle=handle,
                    raw_achievements=raw_achievements,
                    summary_stats={"total_badges": len(badges_data)},
                )
        except Exception as e:
            logger.warning(f"Error querying Credly for {handle}: {str(e)}")
            return ProviderFetchResult(success=False, provider=self.provider_name, handle=handle, error=f"Network error querying Credly: {str(e)}")


class FuelerAdapter(BaseProviderAdapter):
    """Clean adapter boundary for Fueler portfolio platform."""
    provider_name = "fueler"

    def is_configured(self) -> bool:
        # Awaits partner API key or webhook registration
        return bool(os.getenv("FUELER_API_KEY"))

    def fetch(self, handle: str, cursor: Optional[str] = None, credentials: Optional[dict] = None) -> ProviderFetchResult:
        if not self.is_configured():
            return ProviderFetchResult(
                success=False,
                provider=self.provider_name,
                handle=handle,
                error="Fueler adapter awaiting official API credentials/configuration. Fetched data is not fabricated.",
            )
        return ProviderFetchResult(success=True, provider=self.provider_name, handle=handle, raw_achievements=[])


class GoogleSearchConsoleAdapter(BaseProviderAdapter):
    """Clean adapter boundary for Google Search Console / Analytics verified metrics."""
    provider_name = "google_search_console"

    def is_configured(self) -> bool:
        return bool(os.getenv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"))

    def fetch(self, handle: str, cursor: Optional[str] = None, credentials: Optional[dict] = None) -> ProviderFetchResult:
        if not self.is_configured():
            return ProviderFetchResult(
                success=False,
                provider=self.provider_name,
                handle=handle,
                error="Google Search Console awaiting OAuth app approval. Fetched data is not fabricated.",
            )
        return ProviderFetchResult(success=True, provider=self.provider_name, handle=handle, raw_achievements=[])


# ==================== LIVING GRAPH PIPELINE & ENGINE ====================

class LivingGraphEngine:
    """Living Graph Automation Engine & Processing Pipeline.
    
    Full 8-stage pipeline:
    Fetch → Normalize → Validate → Deduplicate → Score → Filter → Persist → Audit
    
    CRITICAL INVARIANTS:
    1. Idempotent: scheduled runs never create duplicate achievements.
    2. Highest-Metric Retention: Repeated counter observations update the existing milestone in place.
    3. Filtering: Discards trivial counters, 0-star spam, and generic profile pings.
    4. Never fabricates achievements, dates, or metrics.
    5. No secrets or tokens are ever logged.
    6. Isolated execution: one user or provider failure does not interrupt the worker.
    """

    # Provider registry
    ADAPTERS: Dict[str, BaseProviderAdapter] = {
        "github": GitHubAdapter(),
        "leetcode": LeetCodeAdapter(),
        "credly": CredlyAdapter(),
        "fueler": FuelerAdapter(),
        "google_search_console": GoogleSearchConsoleAdapter(),
    }

    SCORE_THRESHOLD = 0.70

    @staticmethod
    def _sanitize_for_logging(data: Any) -> str:
        """Sanitizes sensitive values from logging output."""
        if isinstance(data, dict):
            safe = {
                k: ("***" if any(w in k.lower() for w in ("token", "secret", "key", "password", "auth")) else v)
                for k, v in data.items()
            }
            return str(safe)
        return str(data)

    # ---------- STAGE 3: VALIDATE ----------
    @classmethod
    def validate_achievement(cls, item: RawAchievement) -> Tuple[bool, Optional[str]]:
        if not item.title or not item.title.strip():
            return False, "Title is empty"
        if len(item.title) > 200:
            return False, "Title exceeds 200 chars"
        if not item.external_id or not item.external_id.strip():
            return False, "External ID is missing"
        return True, None

    # ---------- STAGE 5: SCORE ----------
    @classmethod
    def score_achievement(cls, item: RawAchievement) -> float:
        """Assigns milestone confidence/relevance score from 0.0 to 1.0."""
        # 1. Verified Issuer Credentials (Credly / certifications)
        if item.achievement_type == "credential":
            return 0.95

        # 2. Project Milestones
        if item.achievement_type == "project_milestone":
            stars = (item.metadata or {}).get("stars", 0)
            if stars >= 10:
                return 0.90
            elif stars >= 2:
                return 0.85
            return 0.75

        # 3. Algorithmic Milestones
        if item.achievement_type == "algorithmic_milestone":
            val = item.raw_metric_value or 0
            bracket = (item.metadata or {}).get("milestone_bracket") or val
            if bracket >= 100 or val >= 100:
                return 0.90
            elif bracket >= 25 or val >= 25:
                return 0.80
            return 0.50

        # 4. Metric Milestones (Repos, Followers)
        if item.achievement_type == "metric_milestone":
            val = item.raw_metric_value or 0
            if item.metric_name == "public_repos" and val >= 5:
                return 0.80
            if item.metric_name == "github_followers" and val >= 25:
                return 0.80
            return 0.50

        return 0.50

    # ---------- STAGE 6: FILTER ----------
    @classmethod
    def filter_achievement(cls, item: RawAchievement, score: float) -> Tuple[bool, Optional[str]]:
        if score < cls.SCORE_THRESHOLD:
            return False, f"Score {score:.2f} is below relevance threshold {cls.SCORE_THRESHOLD}"
        return True, None

    # ---------- STAGE 7: PERSIST (with Atomic Deduplication & Highest-Metric Retention) ----------
    @classmethod
    def persist_achievement(
        cls,
        user_id: str,
        item: RawAchievement,
        score: float,
        vault_repo,
    ) -> Tuple[bool, str]:
        """Persists or updates an achievement idempotently.
        
        Returns: (success: bool, action: 'created' | 'updated' | 'skipped')
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        clean_title = f"[{item.provider.capitalize()}] {item.title}"

        # Verification tier assignment: Credly badges have verified issuer templates (Gold tier);
        # public API milestones without TLSNotary or ring signatures are Weak (Bronze) tier.
        if item.provider == "credly":
            tier = VerificationTier.strong.value
        else:
            tier = VerificationTier.weak.value

        # Check existing item by metric_name for highest-metric retention
        if item.metric_name:
            existing_by_metric = vault_repo.get_by_metric_name(user_id, item.provider, item.metric_name)
            if existing_by_metric:
                existing_meta = existing_by_metric.get("metadata") or {}
                existing_val = existing_meta.get("raw_metric_value", 0.0)

                # Highest-metric retention: update if new metric value is higher
                if item.raw_metric_value is not None and item.raw_metric_value > existing_val:
                    vault_repo.update(existing_by_metric["id"], {
                        "title": clean_title,
                        "description": item.description,
                        "metadata": {
                            **existing_meta,
                            "raw_metric_value": item.raw_metric_value,
                            "external_id": item.external_id,
                            "updated_via_sync": now_iso,
                        },
                        "verification_metadata": {
                            "source": "living_graph_sync",
                            "provider": item.provider,
                            "score": score,
                            "verified_at": now_iso,
                        },
                    })
                    return True, "updated"
                else:
                    # Existing milestone is already at or above current metric -> retain highest, skip update
                    return True, "skipped"

        # Check existing item by external_id
        existing_by_ext = vault_repo.get_by_external_id(user_id, item.external_id)
        if existing_by_ext:
            return True, "skipped"

        # Check by title to be backward-compatible with earlier sync runs
        existing_user_items = vault_repo.get_by_user(user_id, category=VaultCategory.achievement.value, limit=200)
        for existing in existing_user_items:
            if existing.get("title") == clean_title:
                return True, "skipped"

        # Insert new achievement record
        vault_repo.create({
            "user_id": user_id,
            "category": VaultCategory.achievement.value,
            "title": clean_title,
            "description": item.description,
            "metadata": {
                "provider": item.provider,
                "handle": item.handle,
                "external_id": item.external_id,
                "metric_name": item.metric_name,
                "raw_metric_value": item.raw_metric_value,
                "source_url": item.source_url,
                "score": score,
                "synced_at": now_iso,
            },
            "verification_tier": tier,
            "verification_metadata": {
                "source": "living_graph_sync",
                "provider": item.provider,
                "external_id": item.external_id,
                "score": score,
                "verified_at": now_iso,
            },
            "is_public": True,
        })
        return True, "created"

    # ---------- COMPLETE USER SYNC ----------
    @classmethod
    def sync_user_tools(cls, user_id: str, tool_repo, vault_repo) -> Dict[str, Any]:
        """Synchronizes all active connected tools for a single user."""
        tools = tool_repo.get_by_user(user_id)
        synced_count = 0
        created_count = 0
        updated_count = 0
        filtered_count = 0
        errors: List[str] = []
        diagnostics: Dict[str, Any] = {"rejected_items": []}

        for tool in tools:
            # Respect disconnection: skip disconnected tools
            if tool.get("auth_status") == "disconnected":
                continue

            provider_name = tool.get("provider", "").lower()
            handle = tool.get("handle", "")
            adapter = cls.ADAPTERS.get(provider_name)

            if not adapter:
                errors.append(f"No adapter registered for provider '{provider_name}'")
                continue

            try:
                # 1. Fetch
                fetch_result = adapter.fetch(handle)
                if not fetch_result.success:
                    errors.append(f"{provider_name} ({handle}): {fetch_result.error or 'Failed to fetch'}")
                    tool_repo.update(tool["id"], {"auth_status": "unverified"})
                    continue

                # Update tool metadata & mark active
                now_iso = datetime.now(timezone.utc).isoformat()
                tool_repo.update(tool["id"], {
                    "metadata": fetch_result.summary_stats,
                    "last_synced_at": now_iso,
                    "auth_status": "connected",
                })
                synced_count += 1

                # 2. Normalize, Validate, Deduplicate, Score, Filter, Persist
                for item in fetch_result.raw_achievements:
                    valid, val_err = cls.validate_achievement(item)
                    if not valid:
                        filtered_count += 1
                        diagnostics["rejected_items"].append({"external_id": item.external_id, "reason": val_err})
                        continue

                    score = cls.score_achievement(item)
                    passes, filter_reason = cls.filter_achievement(item, score)
                    if not passes:
                        filtered_count += 1
                        diagnostics["rejected_items"].append({"external_id": item.external_id, "reason": filter_reason})
                        continue

                    success, action = cls.persist_achievement(user_id, item, score, vault_repo)
                    if action == "created":
                        created_count += 1
                    elif action == "updated":
                        updated_count += 1

            except Exception as tool_ex:
                # Per-tool failure isolation: log safely and continue
                logger.error(f"Error syncing tool {tool.get('id')}: {cls._sanitize_for_logging(tool_ex)}")
                errors.append(f"{provider_name}: Unexpected error during sync")

        return {
            "synced_tools": synced_count,
            "highlights_created": created_count,
            "highlights_updated": updated_count,
            "highlights_filtered": filtered_count,
            "errors": errors,
            "diagnostics": diagnostics,
        }

    # ---------- WORKER BATCH SYNC (Scheduled Cron / Background Worker) ----------
    @classmethod
    def run_scheduled_sync(
        cls,
        tool_repo,
        vault_repo,
        living_graph_repo,
        worker_id: Optional[str] = None,
        max_tools: int = 500,
    ) -> Dict[str, Any]:
        """Runs scheduled worker execution with lease locking and audit logging."""
        worker_id = worker_id or f"worker-{os.getpid()}-{int(time.time())}"
        lock_key = "living_graph_sync_job"
        start_time = datetime.now(timezone.utc)

        # 1. Acquire distributed lease
        has_lease = living_graph_repo.acquire_lease(lock_key, worker_id, lease_duration_seconds=600)
        if not has_lease:
            logger.info("Living Graph sync job already running under active lease. Skipping overlapping run.")
            return {
                "status": "skipped",
                "message": "Another worker job holds the active lease. Overlapping execution prevented.",
            }

        # 2. Record initial audit run
        run_record = living_graph_repo.create_sync_run({
            "started_at": start_time.isoformat(),
            "status": "running",
            "diagnostics": {"worker_id": worker_id},
        })
        run_id = run_record.get("id")

        total_checked = 0
        total_synced = 0
        total_created = 0
        total_updated = 0
        total_filtered = 0
        all_errors: List[str] = []

        try:
            active_tools = tool_repo.get_all_active(limit=max_tools)
            total_checked = len(active_tools)

            # Group active tools by user to process per-user
            users_map: Dict[str, List[dict]] = {}
            for t in active_tools:
                u_id = t["user_id"]
                users_map.setdefault(u_id, []).append(t)

            for u_id in users_map:
                try:
                    res = cls.sync_user_tools(u_id, tool_repo, vault_repo)
                    total_synced += res.get("synced_tools", 0)
                    total_created += res.get("highlights_created", 0)
                    total_updated += res.get("highlights_updated", 0)
                    total_filtered += res.get("highlights_filtered", 0)
                    all_errors.extend(res.get("errors", []))
                except Exception as user_ex:
                    logger.error(f"Failed sync for user {u_id}: {cls._sanitize_for_logging(user_ex)}")
                    all_errors.append(f"User {u_id}: failed sync")

            completed_at = datetime.now(timezone.utc)
            duration_ms = int((completed_at - start_time).total_seconds() * 1000)

            # 3. Update audit log
            living_graph_repo.update_sync_run(run_id, {
                "completed_at": completed_at.isoformat(),
                "status": "completed",
                "duration_ms": duration_ms,
                "total_tools_checked": total_checked,
                "synced_tools": total_synced,
                "highlights_created": total_created,
                "highlights_updated": total_updated,
                "highlights_filtered": total_filtered,
                "errors": all_errors,
            })

            return {
                "status": "completed",
                "run_id": run_id,
                "duration_ms": duration_ms,
                "total_tools_checked": total_checked,
                "synced_tools": total_synced,
                "highlights_created": total_created,
                "highlights_updated": total_updated,
                "highlights_filtered": total_filtered,
                "errors": all_errors,
            }

        except Exception as batch_ex:
            logger.error(f"Fatal error during Living Graph worker batch run: {cls._sanitize_for_logging(batch_ex)}")
            completed_at = datetime.now(timezone.utc)
            duration_ms = int((completed_at - start_time).total_seconds() * 1000)
            living_graph_repo.update_sync_run(run_id, {
                "completed_at": completed_at.isoformat(),
                "status": "failed",
                "duration_ms": duration_ms,
                "errors": [str(batch_ex)],
            })
            return {"status": "failed", "error": str(batch_ex)}
        finally:
            # 4. Release lease
            living_graph_repo.release_lease(lock_key, worker_id)
