import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.middleware.auth import require_auth
from app.deps import get_vault_repo, get_connected_tool_repo
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


@pytest.fixture
def mock_vault_repo():
    return MockVaultRepository()


@pytest.fixture
def mock_tool_repo():
    return MockConnectedToolRepository()


@pytest.fixture
def client(mock_vault_repo, mock_tool_repo):
    app.dependency_overrides[require_auth] = lambda: "user-alice"
    app.dependency_overrides[get_vault_repo] = lambda: mock_vault_repo
    app.dependency_overrides[get_connected_tool_repo] = lambda: mock_tool_repo
    
    yield TestClient(app)
    
    app.dependency_overrides.clear()


# ==================== ISSUE #58 TESTS ====================

def test_create_vault_item(client, mock_vault_repo):
    response = client.post("/vault", json={
        "title": "Mericet Distributed Engine",
        "category": "project",
        "description": "High performance backend infrastructure",
        "metadata": {"repo_url": "https://github.com/screen-t/mericet"},
        "is_public": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Mericet Distributed Engine"
    assert data["user_id"] == "user-alice"
    assert data["verification_tier"] == "none"
    assert data["id"] in mock_vault_repo.items


def test_create_vault_item_with_poseidon_commitment(client):
    response = client.post("/vault", json={
        "title": "ZK Identity Credential",
        "category": "achievement",
        "description": "Zero knowledge verified badge",
        "poseidon_hash": "0x1234567890abcdef1234567890abcdef",
        "is_public": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["poseidon_hash"] == "0x1234567890abcdef1234567890abcdef"
    assert data["verification_tier"] == "weak"  # Local commitment registered


def test_create_vault_item_invalid_hash(client):
    response = client.post("/vault", json={
        "title": "Invalid Hash Item",
        "category": "project",
        "poseidon_hash": "invalid hash with spaces!!!"
    })
    assert response.status_code == 422


def test_get_my_vault_items(client, mock_vault_repo):
    mock_vault_repo.create({"user_id": "user-alice", "title": "Project Alpha", "category": "project"})
    mock_vault_repo.create({"user_id": "user-alice", "title": "Project Beta", "category": "project"})
    mock_vault_repo.create({"user_id": "user-bob", "title": "Bob Secret Project", "category": "project"})

    response = client.get("/vault")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(item["user_id"] == "user-alice" for item in data)


def test_cross_user_data_isolation(client, mock_vault_repo):
    # Bob creates a private project
    bob_item = mock_vault_repo.create({
        "user_id": "user-bob",
        "title": "Bob Private Project",
        "category": "project",
        "is_public": False
    })

    # Alice tries to view Bob's private item
    response = client.get(f"/vault/{bob_item['id']}")
    assert response.status_code == 403

    # Alice tries to update Bob's item
    put_resp = client.put(f"/vault/{bob_item['id']}", json={"title": "Hacked Title"})
    assert put_resp.status_code == 403

    # Alice tries to delete Bob's item
    del_resp = client.delete(f"/vault/{bob_item['id']}")
    assert del_resp.status_code == 403
    assert bob_item["id"] in mock_vault_repo.items


def test_update_and_delete_own_vault_item(client, mock_vault_repo):
    item = mock_vault_repo.create({"user_id": "user-alice", "title": "Original Title", "category": "skill"})
    
    put_resp = client.put(f"/vault/{item['id']}", json={"title": "Updated Title"})
    assert put_resp.status_code == 200
    assert put_resp.json()["title"] == "Updated Title"

    del_resp = client.delete(f"/vault/{item['id']}")
    assert del_resp.status_code == 200
    assert item["id"] not in mock_vault_repo.items


# ==================== ISSUE #62 & #64 VERIFICATION TESTS ====================

def test_verify_official_issuer_credly(client, mock_vault_repo):
    item = mock_vault_repo.create({"user_id": "user-alice", "title": "AWS Solutions Architect", "category": "achievement"})
    
    resp = client.post(f"/vault/{item['id']}/verify", json={
        "proof_type": "issuer_credential",
        "evidence": {
            "credential_url": "https://www.credly.com/badges/abc-123-xyz",
            "issuer": "Credly"
        }
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["verification"]["tier"] == "strong"
    assert data["verification"]["verified"] is True
    assert mock_vault_repo.items[item["id"]]["verification_tier"] == "strong"


def test_verify_official_issuer_invalid(client, mock_vault_repo):
    item = mock_vault_repo.create({"user_id": "user-alice", "title": "Fake Certificate", "category": "achievement"})
    
    resp = client.post(f"/vault/{item['id']}/verify", json={
        "proof_type": "issuer_credential",
        "evidence": {
            "credential_url": "https://unverified-random-site.com/fake-cert"
        }
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["verification"]["tier"] == "none"
    assert data["verification"]["verified"] is False


def test_verify_cryptographic_proof_zkp(client, mock_vault_repo):
    item = mock_vault_repo.create({
        "user_id": "user-alice",
        "title": "ZKP Proof Item",
        "category": "project",
        "poseidon_hash": "0x1234567890abcdef"
    })
    
    # Valid Groth16 structured proof payload
    resp = client.post(f"/vault/{item['id']}/verify", json={
        "proof_type": "cryptographic_proof",
        "evidence": {
            "poseidon_hash": "0x1234567890abcdef",
            "proof": {
                "pi_a": ["0x1", "0x2"],
                "pi_b": [["0x3", "0x4"], ["0x5", "0x6"]],
                "pi_c": ["0x7", "0x8"],
                "protocol": "groth16",
                "curve": "bn128"
            }
        }
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["verification"]["tier"] == "weak"
    assert data["verification"]["verified"] is True


def test_verify_proof_of_work_github(client, mock_vault_repo):
    item = mock_vault_repo.create({"user_id": "user-alice", "title": "FastAPI Repo", "category": "project"})
    
    resp = client.post(f"/vault/{item['id']}/verify", json={
        "proof_type": "proof_of_work",
        "evidence": {
            "repo_url": "https://github.com/alice/fastapi-app",
            "commit_hash": "a1b2c3d4e5f6789012345678901234567890abcd",
            "author": "alice",
            "live_url": "https://fastapi-app.vercel.app"
        }
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["verification"]["tier"] == "mid"
    assert data["verification"]["verified"] is True


def test_unsupported_verification_path_fails_safely(client, mock_vault_repo):
    item = mock_vault_repo.create({"user_id": "user-alice", "title": "Unsupported Item", "category": "project"})
    
    resp = client.post(f"/vault/{item['id']}/verify", json={
        "proof_type": "unsupported_magic_protocol",
        "evidence": {}
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["verification"]["tier"] == "none"
    assert data["verification"]["verified"] is False


# ==================== ISSUE #60 LIVING GRAPH TESTS ====================

def test_connected_tools_and_living_graph_sync(client, mock_vault_repo, mock_tool_repo, monkeypatch):
    # Mock external GitHub fetch to be deterministic
    from app.services.living_graph import LivingGraphEngine
    monkeypatch.setattr(LivingGraphEngine, "fetch_github_highlights", lambda handle: {
        "provider": "github",
        "handle": handle,
        "success": True,
        "public_repos": 10,
        "followers": 25,
        "highlights": ["10 public repositories", "Active Open Source Contributor"],
    })
    monkeypatch.setattr(LivingGraphEngine, "fetch_leetcode_highlights", lambda handle: {
        "provider": "leetcode",
        "handle": handle,
        "success": True,
        "solved_count": 150,
        "highlights": ["150+ algorithmic problems solved on LeetCode"],
    })

    # 1. Connect GitHub
    resp = client.post("/vault/tools", json={
        "provider": "github",
        "handle": "alice-dev"
    })
    assert resp.status_code == 200
    tool = resp.json()
    assert tool["provider"] == "github"
    assert tool["handle"] == "alice-dev"

    # 2. Connect LeetCode
    client.post("/vault/tools", json={
        "provider": "leetcode",
        "handle": "alice_codes"
    })

    # 3. Trigger Living Graph sync
    sync_resp = client.post("/vault/living-graph/sync")
    assert sync_resp.status_code == 200
    sync_data = sync_resp.json()
    assert sync_data["result"]["synced_tools"] == 2
    assert sync_data["result"]["highlights_created"] > 0

    # 4. Check that synced highlights exist in vault items as achievements
    items = mock_vault_repo.get_by_user("user-alice", category="achievement")
    assert len(items) > 0
    assert any("[Github]" in item["title"] or "[Leetcode]" in item["title"] for item in items)

