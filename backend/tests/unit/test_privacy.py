import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app

@pytest.mark.skip(reason="Privacy tests skeleton — implement mocks and assertions later")
def test_profile_privacy_hides_email_for_other_users():
    # TODO: mock supabase responses for users/work_experience/education and assert
    # that when email_visible is False, the public GET /profile/{username} does not return email
    client = TestClient(app)
    response = client.get("/profile/someuser")
    # placeholder assertion; replace with concrete checks after implementing mocks
    assert response.status_code in (200, 404, 400)

@pytest.mark.skip(reason="Privacy tests skeleton — implement mocks and assertions later")
def test_profile_privacy_shows_all_fields_for_owner():
    # TODO: call GET /profile/{identifier} authenticated as owner and assert fields are present
    client = TestClient(app)
    response = client.get("/profile/someuser")
    assert response.status_code in (200, 404, 400)
