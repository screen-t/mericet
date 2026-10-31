import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.deps import get_auth_service, get_user_repo, get_login_activity_repo


@pytest.fixture
def mock_auth_service():
    service = MagicMock()
    return service


@pytest.fixture
def mock_user_repo():
    repo = MagicMock()
    repo.check_username_available.return_value = True
    repo.get_by_id.return_value = {"id": "user-123", "suspended_at": None}
    return repo


@pytest.fixture
def mock_login_repo():
    repo = MagicMock()
    return repo


@pytest.fixture
def client(mock_auth_service, mock_user_repo, mock_login_repo):
    app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
    app.dependency_overrides[get_user_repo] = lambda: mock_user_repo
    app.dependency_overrides[get_login_activity_repo] = lambda: mock_login_repo

    yield TestClient(app)

    app.dependency_overrides.clear()


def test_signup_success(client, mock_auth_service, mock_user_repo):
    mock_auth_res = MagicMock()
    mock_auth_res.user.id = "user-123"
    mock_auth_res.session.access_token = "mock-token"
    mock_auth_service.sign_up.return_value = mock_auth_res

    response = client.post("/auth/signup", json={
        "email": "unit@example.com",
        "password": "Test@1234",
        "username": "unit",
        "first_name": "Unit",
        "last_name": "Test"
    })

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["user"]["email"] == "unit@example.com"
    mock_user_repo.upsert.assert_called_once()


def test_signup_duplicate_email(client, mock_auth_service):
    mock_auth_res = MagicMock()
    mock_auth_res.user = None
    mock_auth_service.sign_up.return_value = mock_auth_res

    response = client.post("/auth/signup", json={
        "email": "unit@example.com",
        "password": "Test@1234",
        "username": "unit",
        "first_name": "Unit",
        "last_name": "Test"
    })

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


def test_signup_missing_password(client):
    response = client.post("/auth/signup", json={
        "email": "unit@example.com",
        "username": "unit",
    })
    assert response.status_code == 422


def test_login_success(client, mock_auth_service):
    mock_auth_res = MagicMock()
    mock_auth_res.user.id = "user-123"
    mock_auth_res.session.access_token = "token"
    mock_auth_service.sign_in.return_value = mock_auth_res

    response = client.post("/auth/login", json={
        "email": "unit@example.com",
        "password": "Test@1234"
    })

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["user"]["id"] == "user-123"


def test_login_invalid_password(client, mock_auth_service):
    mock_auth_res = MagicMock()
    mock_auth_res.user = None
    mock_auth_service.sign_in.return_value = mock_auth_res

    response = client.post("/auth/login", json={
        "email": "unit@example.com",
        "password": "wrong"
    })

    assert response.status_code == 401


def test_me_unauthorized():
    client = TestClient(app)
    response = client.get("/auth/me")
    assert response.status_code == 401

