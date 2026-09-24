import hashlib

import pytest
from fastapi.testclient import TestClient

from app import main
from app.security import AdminAuth, AuthSettings, hash_password
from conftest import TEST_PASSWORD


def login(client, **changes):
    credentials = {"username": "test-admin", "password": TEST_PASSWORD}
    return client.post("/api/auth/login", json={**credentials, **changes})


def test_public_routes_work_without_login(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert len(client.get("/api/properties").json()) == 2
    assert client.get("/api/gallery").status_code == 200


@pytest.mark.parametrize("path", [
    "/api/admin/properties", "/api/admin/bookings", "/api/admin/gallery"
])
def test_private_reads_reject_missing_and_forged_tokens(client, path):
    for token in ("", "old-static-token", "fake.jwt.signature"):
        response = client.get(path, headers={"Authorization": "Bearer " + token})
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("changes", [
    {"username": "unknown"}, {"password": "wrong-password"}
])
def test_wrong_credentials_have_same_error(client, changes):
    response = login(client, **changes)
    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"
    assert response.headers["Cache-Control"] == "no-store"


def test_sessions_are_unique_and_only_digests_are_stored(client):
    first = login(client).json()
    second = login(client).json()
    assert first["token_type"] == "bearer"
    assert first["expires_in"] == 3600
    assert first["access_token"] != second["access_token"]
    with main.get_db() as db:
        rows = db.execute("SELECT * FROM admin_sessions").fetchall()
    stored = {row["token_hash"] for row in rows}
    for session in (first, second):
        token = session["access_token"]
        assert token not in stored
        assert hashlib.sha256(token.encode()).hexdigest() in stored


def test_expiry_is_enforced_by_server(api, headers):
    client, clock = api
    assert client.get("/api/admin/bookings", headers=headers).status_code == 200
    clock[0] += 3600
    assert client.get("/api/admin/bookings", headers=headers).status_code == 401


def test_logout_revokes_only_current_session(client, headers):
    other = login(client).json()["access_token"]
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/admin/bookings", headers=headers).status_code == 401
    assert client.post("/api/auth/logout", headers=headers).status_code == 401
    assert client.get("/api/admin/bookings", headers={
        "Authorization": "Bearer " + other
    }).status_code == 200


def test_sessions_survive_an_auth_worker_restart(api, headers, monkeypatch):
    client, clock = api
    replacement = AdminAuth(main.auth.settings, main.get_db, lambda: clock[0])
    replacement.initialize()
    monkeypatch.setattr(main, "auth", replacement)
    assert client.get("/api/admin/bookings", headers=headers).status_code == 200


@pytest.mark.parametrize("change", ["username", "password"])
def test_credential_rotation_invalidates_sessions(api, headers, monkeypatch, change):
    client, clock = api
    settings = main.auth.settings
    replacement = AuthSettings(
        "changed-admin" if change == "username" else settings.username,
        hash_password("another-test-only-password") if change == "password" else settings.password_hash,
    )
    monkeypatch.setattr(main, "auth", AdminAuth(replacement, main.get_db, lambda: clock[0]))
    assert client.get("/api/admin/bookings", headers=headers).status_code == 401


def test_unconfigured_admin_fails_closed_but_public_pages_work(client, monkeypatch):
    monkeypatch.setattr(main, "auth", AdminAuth(AuthSettings("", ""), main.get_db))
    assert login(client).status_code == 503
    assert client.get("/api/admin/bookings").status_code == 401
    assert client.get("/api/properties").status_code == 200


def test_rate_limit_survives_restart_and_username_or_header_rotation(api, monkeypatch):
    client, clock = api
    for number in range(5):
        assert login(client, username=f"unknown-{number}").status_code == 401
    monkeypatch.setattr(
        main, "auth", AdminAuth(main.auth.settings, main.get_db, lambda: clock[0])
    )
    blocked = client.post("/api/auth/login", json={
        "username": "test-admin", "password": TEST_PASSWORD
    }, headers={"X-Forwarded-For": "198.51.100.99"})
    assert blocked.status_code == 429
    assert 1 <= int(blocked.headers["Retry-After"]) <= 900
    clock[0] += 901
    assert login(client).status_code == 200


def test_successful_login_resets_attempt_window(client):
    for _ in range(4):
        assert login(client, password="wrong").status_code == 401
    assert login(client).status_code == 200
    for _ in range(5):
        assert login(client, password="wrong").status_code == 401
    assert login(client).status_code == 429


def test_different_peer_ip_has_its_own_attempt_window(client):
    for _ in range(5):
        assert login(client, password="wrong").status_code == 401
    assert login(client).status_code == 429
    # Startup is already managed by the fixture; a second peer shares the database.
    other = TestClient(main.app, client=("198.51.100.77", 50000))
    try:
        assert login(other).status_code == 200
    finally:
        other.close()


@pytest.mark.parametrize("value", ["plaintext-password", "$argon2id$broken"])
def test_invalid_password_hash_is_rejected(value):
    with pytest.raises(ValueError, match="ADMIN_PASSWORD_HASH"):
        AuthSettings("test-admin", value)


@pytest.mark.parametrize("minutes", [0, 4, 1441])
def test_invalid_session_lifetime_is_rejected(password_hash, minutes):
    with pytest.raises(ValueError, match="ADMIN_SESSION_MINUTES"):
        AuthSettings("test-admin", password_hash, session_minutes=minutes)


def test_password_hashes_use_salts_and_minimum_length():
    first = hash_password(TEST_PASSWORD)
    second = hash_password(TEST_PASSWORD)
    assert first.startswith("$argon2id$")
    assert first != second
    assert TEST_PASSWORD not in first
    with pytest.raises(ValueError, match="12"):
        hash_password("short")
