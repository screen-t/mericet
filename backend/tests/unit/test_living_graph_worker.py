import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone
from app.services.living_graph import (
    LivingGraphEngine,
    RawAchievement,
    ProviderFetchResult,
    GitHubAdapter,
    LeetCodeAdapter,
    CredlyAdapter,
    FuelerAdapter,
    GoogleSearchConsoleAdapter,
)
from app.worker import run_once
from app.models.vault import VaultCategory, VerificationTier


class MockVaultRepository:
    def __init__(self):
        self.items = {}
        self.counter = 1

    def get_by_id(self, item_id: str):
        return self.items.get(item_id)

    def get_by_user(self, user_id: str, category=None, is_public_only=False, limit=100, offset=0):
        results = [
            item for item in self.items.values()
            if item["user_id"] == user_id
            and (category is None or item["category"] == category)
            and (not is_public_only or item.get("is_public", True))
        ]
        return results[offset:offset + limit]

    def get_by_external_id(self, user_id: str, external_id: str):
        for item in self.items.values():
            if item["user_id"] == user_id and item.get("metadata", {}).get("external_id") == external_id:
                return item
        return None

    def get_by_metric_name(self, user_id: str, provider: str, metric_name: str):
        for item in self.items.values():
            if (item["user_id"] == user_id and
                item.get("metadata", {}).get("provider") == provider and
                item.get("metadata", {}).get("metric_name") == metric_name):
                return item
        return None

    def create(self, data: dict):
        item_id = f"item-{self.counter}"
        self.counter += 1
        new_item = {
            "id": item_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {},
            "verification_metadata": {},
            "verification_tier": "none",
            "is_public": True,
            "display_order": 0,
            **data,
        }
        self.items[item_id] = new_item
        return new_item

    def update(self, item_id: str, data: dict):
        if item_id in self.items:
            self.items[item_id].update(data)
            return self.items[item_id]
        return None


class MockConnectedToolRepository:
    def __init__(self):
        self.tools = {}
        self.counter = 1

    def get_by_id(self, tool_id: str):
        return self.tools.get(tool_id)

    def get_by_user(self, user_id: str):
        return [t for t in self.tools.values() if t["user_id"] == user_id]

    def get_all_active(self, limit: int = 500):
        return [t for t in self.tools.values() if t.get("auth_status") == "connected"][:limit]

    def upsert(self, data: dict):
        tool_id = f"tool-{self.counter}"
        self.counter += 1
        new_tool = {
            "id": tool_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        self.tools[tool_id] = new_tool
        return new_tool

    def update(self, tool_id: str, data: dict):
        if tool_id in self.tools:
            self.tools[tool_id].update(data)
            return self.tools[tool_id]
        return None


class MockLivingGraphRepository:
    def __init__(self):
        self.locks = {}
        self.runs = []
        self.counter = 1

    def acquire_lease(self, lock_key: str, acquired_by: str, lease_duration_seconds: int = 600):
        if lock_key in self.locks and self.locks[lock_key]["acquired_by"] != acquired_by:
            return False
        self.locks[lock_key] = {"acquired_by": acquired_by}
        return True

    def release_lease(self, lock_key: str, acquired_by: str):
        if lock_key in self.locks and self.locks[lock_key]["acquired_by"] == acquired_by:
            del self.locks[lock_key]

    def create_sync_run(self, data: dict):
        run_id = f"run-{self.counter}"
        self.counter += 1
        record = {"id": run_id, **data}
        self.runs.append(record)
        return record

    def update_sync_run(self, run_id: str, data: dict):
        for r in self.runs:
            if r["id"] == run_id:
                r.update(data)
                return r
        return None

    def get_recent_sync_runs(self, limit: int = 20):
        return self.runs[-limit:]


# ==================== TESTS ====================

def test_pipeline_fetch_to_persist(monkeypatch):
    """Full 8-stage pipeline: Fetch -> Normalize -> Validate -> Deduplicate -> Score -> Filter -> Persist -> Audit."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()

    tool_repo.upsert({
        "user_id": "user-alice",
        "provider": "github",
        "handle": "alice-dev",
        "auth_status": "connected",
    })

    # Mock GitHub adapter fetch
    monkeypatch.setattr(GitHubAdapter, "fetch", lambda self, handle, cursor=None, credentials=None: ProviderFetchResult(
        success=True,
        provider="github",
        handle=handle,
        raw_achievements=[
            RawAchievement(
                provider="github",
                handle=handle,
                external_id="github:user:alice-dev:repos_milestone",
                achievement_type="metric_milestone",
                title="10+ Public Open Source Repositories",
                description="Published 12 public repositories on GitHub.",
                source_url="https://github.com/alice-dev",
                raw_metric_value=12.0,
                metric_name="public_repos",
                metadata={"total_repos": 12},
            ),
            RawAchievement(
                provider="github",
                handle=handle,
                external_id="github:repo:9999",
                achievement_type="project_milestone",
                title="Open Source Project: fast-indexer",
                description="High performance indexer (15 stars, 4 forks)",
                source_url="https://github.com/alice-dev/fast-indexer",
                raw_metric_value=15.0,
                metric_name="repo_stars",
                metadata={"stars": 15, "forks": 4},
            ),
        ],
        summary_stats={"public_repos": 12, "followers": 30},
    ))

    res = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert res["synced_tools"] == 1
    assert res["highlights_created"] == 2
    assert len(res["errors"]) == 0

    items = vault_repo.get_by_user("user-alice", category=VaultCategory.achievement.value)
    assert len(items) == 2
    assert any("fast-indexer" in it["title"] for it in items)
    assert any("Repositories" in it["title"] for it in items)


def test_worker_idempotency(monkeypatch):
    """Rerunning the sync multiple times does NOT create duplicate achievements."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()

    tool_repo.upsert({
        "user_id": "user-alice",
        "provider": "credly",
        "handle": "alice_cert",
        "auth_status": "connected",
    })

    monkeypatch.setattr(CredlyAdapter, "fetch", lambda self, handle, cursor=None, credentials=None: ProviderFetchResult(
        success=True,
        provider="credly",
        handle=handle,
        raw_achievements=[
            RawAchievement(
                provider="credly",
                handle=handle,
                external_id="credly:badge:aws-solutions-architect",
                achievement_type="credential",
                title="AWS Certified Solutions Architect - Associate",
                description="Verified cloud architecture credential.",
                source_url="https://www.credly.com/badges/abc-123",
                raw_metric_value=1.0,
                metric_name="verified_credential",
            )
        ],
    ))

    # Run 1: Creates 1 highlight
    res1 = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert res1["highlights_created"] == 1

    # Run 2: Exact same data -> 0 created (Idempotent!)
    res2 = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert res2["highlights_created"] == 0
    assert len(vault_repo.get_by_user("user-alice")) == 1

    # Run 3: Exact same data -> 0 created
    res3 = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert res3["highlights_created"] == 0
    assert len(vault_repo.get_by_user("user-alice")) == 1


def test_highest_metric_milestone_retention(monkeypatch):
    """When the same metric is observed repeatedly, retain the highest relevant milestone rather than emitting duplicate entries."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()

    tool_repo.upsert({
        "user_id": "user-alice",
        "provider": "leetcode",
        "handle": "alice_lc",
        "auth_status": "connected",
    })

    # Step 1: User has solved 50 problems
    monkeypatch.setattr(LeetCodeAdapter, "fetch", lambda self, handle, cursor=None, credentials=None: ProviderFetchResult(
        success=True,
        provider="leetcode",
        handle=handle,
        raw_achievements=[
            RawAchievement(
                provider="leetcode",
                handle=handle,
                external_id="leetcode:user:alice_lc:solved_milestone",
                achievement_type="algorithmic_milestone",
                title="50+ Algorithmic Challenges Solved",
                description="Solved 50 algorithm problems on LeetCode.",
                raw_metric_value=50.0,
                metric_name="leetcode_solved",
            )
        ],
    ))

    res1 = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert res1["highlights_created"] == 1
    item = vault_repo.get_by_user("user-alice")[0]
    assert "50+" in item["title"]

    # Step 2: Next month, user has now solved 150 problems
    monkeypatch.setattr(LeetCodeAdapter, "fetch", lambda self, handle, cursor=None, credentials=None: ProviderFetchResult(
        success=True,
        provider="leetcode",
        handle=handle,
        raw_achievements=[
            RawAchievement(
                provider="leetcode",
                handle=handle,
                external_id="leetcode:user:alice_lc:solved_milestone",
                achievement_type="algorithmic_milestone",
                title="100+ Algorithmic Challenges Solved",
                description="Solved 150 algorithm problems on LeetCode.",
                raw_metric_value=150.0,
                metric_name="leetcode_solved",
            )
        ],
    ))

    res2 = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert res2["highlights_created"] == 0
    assert res2["highlights_updated"] == 1

    # Total achievements must still be 1, updated to the higher milestone!
    items = vault_repo.get_by_user("user-alice")
    assert len(items) == 1
    assert "100+" in items[0]["title"]
    assert items[0]["metadata"]["raw_metric_value"] == 150.0

    # Step 3: Run again with same 150 count -> 0 created, 0 updated (retained as highest)
    res3 = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert res3["highlights_created"] == 0
    assert res3["highlights_updated"] == 0


def test_filtering_insignificant_counters(monkeypatch):
    """Trivial counters (e.g. 1 problem solved, 0-star spam repos) are filtered out."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()

    tool_repo.upsert({
        "user_id": "user-bob",
        "provider": "leetcode",
        "handle": "bob_newbie",
        "auth_status": "connected",
    })

    # User solved only 1 problem -> low score < 0.70
    monkeypatch.setattr(LeetCodeAdapter, "fetch", lambda self, handle, cursor=None, credentials=None: ProviderFetchResult(
        success=True,
        provider="leetcode",
        handle=handle,
        raw_achievements=[
            RawAchievement(
                provider="leetcode",
                handle=handle,
                external_id="leetcode:user:bob:1_solved",
                achievement_type="algorithmic_milestone",
                title="1 Algorithmic Challenge Solved",
                description="Solved 1 problem.",
                raw_metric_value=1.0,
                metric_name="leetcode_solved",
                metadata={"milestone_bracket": 1},
            )
        ],
    ))

    res = LivingGraphEngine.sync_user_tools("user-bob", tool_repo, vault_repo)
    assert res["highlights_created"] == 0
    assert res["highlights_filtered"] == 1
    assert len(res["diagnostics"]["rejected_items"]) == 1
    assert "below relevance threshold" in res["diagnostics"]["rejected_items"][0]["reason"]
    # Vault must have 0 spam items
    assert len(vault_repo.get_by_user("user-bob")) == 0


def test_concurrency_lease_locking():
    """Overlapping worker runs are prevented using distributed lease locking."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()
    living_graph_repo = MockLivingGraphRepository()

    # Worker 1 acquires lock
    res1 = LivingGraphEngine.run_scheduled_sync(tool_repo, vault_repo, living_graph_repo, worker_id="worker-1")
    assert res1["status"] == "completed"

    # Simulate another worker attempting to run while lease is held
    living_graph_repo.locks["living_graph_sync_job"] = {"acquired_by": "worker-1"}
    res2 = LivingGraphEngine.run_scheduled_sync(tool_repo, vault_repo, living_graph_repo, worker_id="worker-2")
    assert res2["status"] == "skipped"
    assert "active lease" in res2["message"]

    # Once released, worker 2 can run
    del living_graph_repo.locks["living_graph_sync_job"]
    res3 = LivingGraphEngine.run_scheduled_sync(tool_repo, vault_repo, living_graph_repo, worker_id="worker-2")
    assert res3["status"] == "completed"


def test_per_user_and_provider_isolation(monkeypatch):
    """Failure in one provider/user does not halt the scheduled worker."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()
    living_graph_repo = MockLivingGraphRepository()

    # User 1 has a broken GitHub handle (fails)
    tool_repo.upsert({"user_id": "user-broken", "provider": "github", "handle": "broken-user", "auth_status": "connected"})
    # User 2 has a working Credly profile (succeeds)
    tool_repo.upsert({"user_id": "user-ok", "provider": "credly", "handle": "ok-user", "auth_status": "connected"})

    def mock_github(self, handle, cursor=None, credentials=None):
        return ProviderFetchResult(success=False, provider="github", handle=handle, error="Rate limited or user 404")

    def mock_credly(self, handle, cursor=None, credentials=None):
        return ProviderFetchResult(
            success=True,
            provider="credly",
            handle=handle,
            raw_achievements=[
                RawAchievement(
                    provider="credly",
                    handle=handle,
                    external_id="credly:badge:cert-1",
                    achievement_type="credential",
                    title="Certified Security Specialist",
                    description="Security credential.",
                )
            ],
        )

    monkeypatch.setattr(GitHubAdapter, "fetch", mock_github)
    monkeypatch.setattr(CredlyAdapter, "fetch", mock_credly)

    summary = LivingGraphEngine.run_scheduled_sync(tool_repo, vault_repo, living_graph_repo)
    assert summary["status"] == "completed"
    assert summary["synced_tools"] == 1
    assert summary["highlights_created"] == 1
    assert len(summary["errors"]) == 1

    # User 2 has their highlight saved
    assert len(vault_repo.get_by_user("user-ok")) == 1


def test_disconnected_tool_is_skipped(monkeypatch):
    """Disconnected tools are skipped during sync to respect revocation/deletion policies."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()

    tool_repo.upsert({
        "user_id": "user-alice",
        "provider": "github",
        "handle": "alice-dev",
        "auth_status": "disconnected",
    })

    fetch_mock = MagicMock()
    monkeypatch.setattr(GitHubAdapter, "fetch", fetch_mock)

    res = LivingGraphEngine.sync_user_tools("user-alice", tool_repo, vault_repo)
    assert fetch_mock.called is False
    assert res["synced_tools"] == 0


def test_unconfigured_adapters_clean_boundary():
    """Unconfigured providers (Fueler, Google Search Console) return safe unconfigured responses."""
    fueler = FuelerAdapter()
    assert fueler.is_configured() is False
    res_f = fueler.fetch("my-handle")
    assert res_f.success is False
    assert "awaiting" in res_f.error

    gsc = GoogleSearchConsoleAdapter()
    assert gsc.is_configured() is False
    res_g = gsc.fetch("my-domain")
    assert res_g.success is False
    assert "awaiting" in res_g.error


def test_worker_run_once_cli(monkeypatch):
    """The run_once function in worker.py executes cleanly."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()
    living_graph_repo = MockLivingGraphRepository()

    summary = run_once(tool_repo=tool_repo, vault_repo=vault_repo, living_graph_repo=living_graph_repo)
    assert summary["status"] == "completed"
    assert len(living_graph_repo.runs) == 1


# ==================== REGRESSION TESTS ====================

def test_metric_decrease_does_not_downgrade_highest_milestone(monkeypatch):
    """REGRESSION: If metric counter decreases, highest milestone is retained and not downgraded."""
    vault_repo = MockVaultRepository()
    tool_repo = MockConnectedToolRepository()

    tool_repo.upsert({
        "user_id": "user-charlie",
        "provider": "leetcode",
        "handle": "charlie_lc",
        "auth_status": "connected",
    })

    # User originally solved 250 problems (high milestone)
    monkeypatch.setattr(LeetCodeAdapter, "fetch", lambda self, handle, cursor=None, credentials=None: ProviderFetchResult(
        success=True,
        provider="leetcode",
        handle=handle,
        raw_achievements=[
            RawAchievement(
                provider="leetcode",
                handle=handle,
                external_id="leetcode:user:charlie_lc:solved_milestone",
                achievement_type="algorithmic_milestone",
                title="250+ Algorithmic Challenges Solved",
                description="Solved 250 problems.",
                raw_metric_value=250.0,
                metric_name="leetcode_solved",
            )
        ],
    ))
    LivingGraphEngine.sync_user_tools("user-charlie", tool_repo, vault_repo)

    # Next sync: reported metric is 200 (lower)
    monkeypatch.setattr(LeetCodeAdapter, "fetch", lambda self, handle, cursor=None, credentials=None: ProviderFetchResult(
        success=True,
        provider="leetcode",
        handle=handle,
        raw_achievements=[
            RawAchievement(
                provider="leetcode",
                handle=handle,
                external_id="leetcode:user:charlie_lc:solved_milestone",
                achievement_type="algorithmic_milestone",
                title="100+ Algorithmic Challenges Solved",
                description="Solved 200 problems.",
                raw_metric_value=200.0,
                metric_name="leetcode_solved",
            )
        ],
    ))
    res2 = LivingGraphEngine.sync_user_tools("user-charlie", tool_repo, vault_repo)
    # Must NOT update or downgrade
    assert res2["highlights_updated"] == 0
    items = vault_repo.get_by_user("user-charlie")
    assert len(items) == 1
    assert "250+" in items[0]["title"]
    assert items[0]["metadata"]["raw_metric_value"] == 250.0


def test_worker_lease_reclaims_stale_expired_lock():
    """REGRESSION: Worker reclaims lock if a prior worker crashed and lease expired."""
    from app.repositories.supabase.vault_repo import SupabaseLivingGraphRepository

    class MockTable:
        def __init__(self):
            # Simulate a stale lock expired in the past
            self.data = [{
                "lock_key": "living_graph_sync_job",
                "acquired_at": "2020-01-01T00:00:00+00:00",
                "expires_at": "2020-01-01T00:10:00+00:00",
                "acquired_by": "crashed-worker-999",
            }]
            self.updated = False

        def select(self, *args, **kwargs):
            return self

        def eq(self, col, val):
            return self

        def execute(self):
            return MagicMock(data=self.data)

        def update(self, data):
            self.updated = True
            self.data = [data]
            return self

    mock_client = MagicMock()
    mock_table = MockTable()
    mock_client.table.return_value = mock_table

    repo = SupabaseLivingGraphRepository(mock_client)
    # Stale lock should be successfully reclaimed
    acquired = repo.acquire_lease("living_graph_sync_job", "new-worker-101", lease_duration_seconds=600)
    assert acquired is True
    assert mock_table.updated is True


def test_github_retry_exponential_backoff_on_429(monkeypatch):
    """REGRESSION: GitHub adapter retries on 429 rate limit with backoff and succeeds on next attempt."""
    mock_resp_429 = MagicMock()
    mock_resp_429.status_code = 429

    mock_resp_200 = MagicMock()
    mock_resp_200.status_code = 200
    mock_resp_200.json.return_value = {"public_repos": 10, "followers": 5}

    calls = []

    def mock_get(url, headers):
        calls.append(url)
        if len(calls) == 1:
            return mock_resp_429
        return mock_resp_200

    mock_client = MagicMock()
    mock_client.get = mock_get

    # Patch time.sleep so test runs instantly without delay
    monkeypatch.setattr("time.sleep", lambda s: None)

    resp = GitHubAdapter._execute_with_retry(mock_client, "https://api.github.com/users/test", {})
    assert resp.status_code == 200
    assert len(calls) == 2

