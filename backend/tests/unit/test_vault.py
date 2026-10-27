import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.middleware.auth import require_auth
from app.deps import get_vault_repo, get_connected_tool_repo, get_living_graph_repo
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

    def get_owner(self, item_id: str):
        item = self.items.get(item_id)
        return item["user_id"] if item else None

    def create(self, data: dict):
        item_id = f"item-{self.counter}"
        self.counter += 1
        new_item = {
            "id": item_id,
            "created_at": "2026-10-10T12:00:00Z",
            "updated_at": "2026-10-10T12:00:00Z",
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

    def delete(self, item_id: str):
        self.items.pop(item_id, None)

    def count_by_user(self, user_id: str, is_public_only=False):
        return len(self.get_by_user(user_id, is_public_only=is_public_only))


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

    def get_by_user_and_provider(self, user_id: str, provider: str):
        for t in self.tools.values():
            if t["user_id"] == user_id and t["provider"] == provider:
                return t
        return None

    def upsert(self, data: dict):
        existing = self.get_by_user_and_provider(data["user_id"], data["provider"])
        if existing:
            existing.update(data)
            return existing
        tool_id = f"tool-{self.counter}"
        self.counter += 1
        new_tool = {
            "id": tool_id,
            "created_at": "2026-10-10T12:00:00Z",
            "updated_at": "2026-10-10T12:00:00Z",
            **data,
        }
        self.tools[tool_id] = new_tool
        return new_tool

    def update(self, tool_id: str, data: dict):
        if tool_id in self.tools:
            self.tools[tool_id].update(data)
            return self.tools[tool_id]
        return None

    def delete(self, tool_id: str):
        self.tools.pop(tool_id, None)

    def get_owner(self, tool_id: str):
        tool = self.tools.get(tool_id)
        return tool["user_id"] if tool else None


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


@pytest.fixture
def mock_vault_repo():
    return MockVaultRepository()


@pytest.fixture
def mock_tool_repo():
    return MockConnectedToolRepository()


@pytest.fixture
def mock_living_graph_repo():
    return MockLivingGraphRepository()


@pytest.fixture
def client(mock_vault_repo, mock_tool_repo, mock_living_graph_repo):
    app.dependency_overrides[require_auth] = lambda: "user-alice"
    app.dependency_overrides[get_vault_repo] = lambda: mock_vault_repo
    app.dependency_overrides[get_connected_tool_repo] = lambda: mock_tool_repo
    app.dependency_overrides[get_living_graph_repo] = lambda: mock_living_graph_repo

    yield TestClient(app)

    app.dependency_overrides.clear()


# ==================== TASK 3 (ISSUE #58): CRUD & AUTHORIZATION TESTS ====================

def test_unauthenticated_access_rejected():
    """Unauthenticated requests must be rejected with 401."""
    # Ensure no auth override
    app.dependency_overrides.clear()
    unauth_client = TestClient(app)

    resp_get = unauth_client.get("/vault")
    assert resp_get.status_code == 401

    resp_post = unauth_client.post("/vault", json={"title": "Test Item"})
    assert resp_post.status_code == 401

    resp_delete = unauth_client.delete("/vault/item-123")
    assert resp_delete.status_code == 401


def test_create_vault_items_all_supported_categories(client, mock_vault_repo):
    """Verify item creation for Skills, Work, Education, Projects, and Achievements."""
    categories = ["skill", "work", "education", "project", "achievement", "tool", "other"]
    for cat in categories:
        resp = client.post("/vault", json={
            "title": f"Test {cat.capitalize()}",
            "category": cat,
            "description": f"Description for {cat}",
            "metadata": {"custom_key": "custom_value"},
            "is_public": True,
            "display_order": 1,
        })
        assert resp.status_code == 200, f"Failed for category {cat}: {resp.text}"
        data = resp.json()
        assert data["title"] == f"Test {cat.capitalize()}"
        assert data["category"] == cat
        assert data["user_id"] == "user-alice"
        assert data["verification_tier"] == "none"


def test_create_vault_item_prevents_mass_assignment_of_trust_tier(client, mock_vault_repo):
    """Clients cannot set verification_tier or verification_metadata on creation."""
    resp = client.post("/vault", json={
        "title": "Hacked Gold Item",
        "category": "project",
        "verification_tier": "strong",
        "verification_metadata": {"verified": True, "fake": "claim"},
    })
    assert resp.status_code == 200
    data = resp.json()
    # verification_tier must remain 'none' regardless of client injection
    assert data["verification_tier"] == "none"
    assert data["verification_metadata"] == {}


def test_create_vault_item_with_poseidon_commitment(client):
    """Registering a Poseidon commitment hash sets Weak (Bronze) tier commitment."""
    response = client.post("/vault", json={
        "title": "ZK Identity Credential",
        "category": "achievement",
        "poseidon_hash": "0x1234567890abcdef1234567890abcdef",
        "is_public": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["poseidon_hash"] == "0x1234567890abcdef1234567890abcdef"
    assert data["verification_tier"] == "weak"


def test_create_vault_item_invalid_payloads(client):
    """Invalid payloads (blank title, whitespace-only title, invalid hash, invalid category) return 422."""
    # Blank title
    assert client.post("/vault", json={"title": "", "category": "project"}).status_code == 422
    # Whitespace-only title
    assert client.post("/vault", json={"title": "   ", "category": "project"}).status_code == 422
    # Invalid category
    assert client.post("/vault", json={"title": "Valid", "category": "nonexistent_cat"}).status_code == 422
    # Malformed poseidon hash
    assert client.post("/vault", json={"title": "Valid", "poseidon_hash": "has spaces and symbols!!"}).status_code == 422


def test_get_my_vault_items_and_bounded_pagination(client, mock_vault_repo):
    """List authenticated user items with category filter and bounded pagination."""
    for i in range(15):
        mock_vault_repo.create({"user_id": "user-alice", "title": f"Skill {i}", "category": "skill"})
    mock_vault_repo.create({"user_id": "user-alice", "title": "Project One", "category": "project"})
    mock_vault_repo.create({"user_id": "user-bob", "title": "Bob Skill", "category": "skill"})

    # Filter by category
    resp = client.get("/vault?category=skill&limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 10
    assert all(item["category"] == "skill" and item["user_id"] == "user-alice" for item in data)

    # Offset pagination
    resp_page2 = client.get("/vault?category=skill&limit=10&offset=10")
    assert resp_page2.status_code == 200
    assert len(resp_page2.json()) == 5

    # Out of bounds limit rejected
    assert client.get("/vault?limit=200").status_code == 422
    assert client.get("/vault?limit=0").status_code == 422
    assert client.get("/vault?offset=-1").status_code == 422


def test_get_single_vault_item_and_invalid_id(client, mock_vault_repo):
    """Retrieving nonexistent item returns 404."""
    resp = client.get("/vault/nonexistent-item-id")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_cross_user_data_isolation(client, mock_vault_repo):
    """Strict authorization: Alice cannot read, update, delete, or verify Bob's private vault."""
    bob_private_item = mock_vault_repo.create({
        "user_id": "user-bob",
        "title": "Bob Confidential Patent",
        "category": "project",
        "is_public": False,
    })

    # Alice cannot read Bob's private item
    assert client.get(f"/vault/{bob_private_item['id']}").status_code == 403

    # Alice cannot update Bob's item
    put_resp = client.put(f"/vault/{bob_private_item['id']}", json={"title": "Hacked"})
    assert put_resp.status_code == 403
    assert mock_vault_repo.items[bob_private_item["id"]]["title"] == "Bob Confidential Patent"

    # Alice cannot delete Bob's item
    del_resp = client.delete(f"/vault/{bob_private_item['id']}")
    assert del_resp.status_code == 403
    assert bob_private_item["id"] in mock_vault_repo.items

    # Alice cannot verify Bob's item
    verify_resp = client.post(f"/vault/{bob_private_item['id']}/verify", json={
        "proof_type": "issuer_credential",
        "evidence": {}
    })
    assert verify_resp.status_code == 403


def test_public_user_vault_privacy_boundary(client, mock_vault_repo):
    """When viewing another user's vault, private items are omitted."""
    mock_vault_repo.create({"user_id": "user-bob", "title": "Bob Public Project", "category": "project", "is_public": True})
    mock_vault_repo.create({"user_id": "user-bob", "title": "Bob Secret Project", "category": "project", "is_public": False})

    # Alice views Bob's profile vault
    resp = client.get("/vault/user/user-bob")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Bob Public Project"


def test_update_and_delete_own_vault_item(client, mock_vault_repo):
    """Authenticated user can update and delete their own items."""
    item = mock_vault_repo.create({"user_id": "user-alice", "title": "Original Skill", "category": "skill"})

    # Update title and description
    put_resp = client.put(f"/vault/{item['id']}", json={
        "title": "Updated Skill",
        "description": "Updated details",
    })
    assert put_resp.status_code == 200
    assert put_resp.json()["title"] == "Updated Skill"

    # Delete item
    del_resp = client.delete(f"/vault/{item['id']}")
    assert del_resp.status_code == 200
    assert item["id"] not in mock_vault_repo.items

    # Second delete returns 404
    assert client.delete(f"/vault/{item['id']}").status_code == 404


# ==================== CONNECTED TOOLS & OBSERVABILITY TESTS ====================

def test_connected_tools_management(client, mock_tool_repo):
    """Connect, list, and disconnect third party tools."""
    # Connect GitHub
    resp = client.post("/vault/tools", json={"provider": "github", "handle": "alice_dev"})
    assert resp.status_code == 200
    tool = resp.json()
    assert tool["provider"] == "github"
    assert tool["handle"] == "alice_dev"

    # List tools
    tools = client.get("/vault/tools/list").json()
    assert len(tools) == 1
    assert tools[0]["id"] == tool["id"]

    # Disconnect tool
    del_resp = client.delete(f"/vault/tools/{tool['id']}")
    assert del_resp.status_code == 200
    assert client.get("/vault/tools/list").json() == []


def test_living_graph_audit_runs_endpoint(client, mock_living_graph_repo):
    """Observability endpoint returns recent worker execution audit logs."""
    mock_living_graph_repo.create_sync_run({
        "started_at": "2026-10-27T12:00:00Z",
        "status": "completed",
        "synced_tools": 3,
        "highlights_created": 2,
    })
    resp = client.get("/vault/living-graph/runs")
    assert resp.status_code == 200
    runs = resp.json()
    assert len(runs) == 1
    assert runs[0]["synced_tools"] == 3


# ==================== SECURITY AUDIT REGRESSION TESTS ====================

def test_updating_claim_title_invalidates_verified_badge(client, mock_vault_repo):
    """REGRESSION: Editing title of a verified item invalidates trust tier to prevent title hijacking."""
    # Create item with Strong (Gold) verification
    item = mock_vault_repo.create({
        "user_id": "user-alice",
        "title": "AWS Certified Solutions Architect",
        "category": "achievement",
        "verification_tier": "strong",
        "verification_metadata": {"verified": True, "verifier": "Credly"},
    })

    # Alice changes title to an unverified claim
    resp = client.put(f"/vault/{item['id']}", json={"title": "Principal Architect at OpenAI"})
    assert resp.status_code == 200
    updated = resp.json()
    # Trust tier must be reset to none (not strong!)
    assert updated["verification_tier"] == "none"
    assert updated["verification_metadata"].get("reverification_required") is True
    assert "modified after verification" in updated["verification_metadata"].get("reason", "")


def test_mass_assignment_stripping_on_update(client, mock_vault_repo):
    """REGRESSION: Attempting to modify user_id or verification_tier via PUT is stripped."""
    item = mock_vault_repo.create({
        "user_id": "user-alice",
        "title": "Legit Project",
        "category": "project",
        "verification_tier": "none",
    })

    resp = client.put(f"/vault/{item['id']}", json={
        "title": "Legit Project v2",
        "user_id": "user-bob",
        "verification_tier": "strong",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == "user-alice"
    assert data["verification_tier"] == "none"

