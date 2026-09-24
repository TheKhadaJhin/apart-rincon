import pytest
from fastapi.testclient import TestClient

from app import main
from app.security import AdminAuth, AuthSettings, hash_password

TEST_PASSWORD = "test-only-password-for-api-tests"


@pytest.fixture(scope="session")
def password_hash():
    return hash_password(TEST_PASSWORD)


@pytest.fixture
def api(tmp_path, monkeypatch, password_hash):
    monkeypatch.setattr(main, "DATABASE_PATH", str(tmp_path / "test.db"))
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(main, "UPLOAD_DIR", upload_dir)
    clock = [2_000_000_000.0]
    auth = AdminAuth(AuthSettings("test-admin", password_hash), main.get_db, lambda: clock[0])
    monkeypatch.setattr(main, "auth", auth)
    with TestClient(main.app) as test_client:
        yield test_client, clock


@pytest.fixture
def client(api):
    return api[0]


@pytest.fixture
def headers(client):
    response = client.post("/api/auth/login", json={
        "username": "test-admin", "password": TEST_PASSWORD
    })
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.fixture
def booking_data():
    return {
        "property_id": "depto-1",
        "start_date": "2035-01-10",
        "end_date": "2035-01-12",
        "status": "reserved",
        "guest_name": "Synthetic guest",
        "phone": "",
        "notes": "",
    }
