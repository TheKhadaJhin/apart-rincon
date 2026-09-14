import base64
import sqlite3
from pathlib import Path

from app import main

# A synthetic one-pixel PNG; no customer files or production data are used.
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFj8AAAAASUVORK5CYII="
)


def test_uploads_require_auth_and_reject_disguised_files(client, headers):
    path = "/api/admin/gallery/images"
    assert client.post(path, files={"file": ("pixel.png", PNG, "image/png")}).status_code == 401
    assert client.post(path, headers=headers, files={
        "file": ("fake.png", b"not an image", "image/png")
    }).status_code == 400
    assert client.post(path, headers=headers, files={
        "file": ("pixel.jpg", PNG, "image/jpeg")
    }).status_code == 400


def test_upload_size_limit(client, headers, monkeypatch):
    monkeypatch.setenv("UPLOAD_MAX_BYTES", "8")
    assert client.post("/api/admin/gallery/images", headers=headers, files={
        "file": ("pixel.png", PNG, "image/png")
    }).status_code == 413


def test_gallery_upload_and_delete_remove_local_file(client, headers):
    response = client.post("/api/admin/gallery/images", headers=headers, files={
        "file": ("pixel.png", PNG, "image/png")
    })
    assert response.status_code == 200
    item = response.json()
    saved = main.UPLOAD_DIR / Path(item["image_url"]).name
    assert saved.read_bytes() == PNG
    assert client.delete("/api/admin/gallery/" + item["id"], headers=headers).status_code == 200
    assert not saved.exists()


def test_property_edit_and_image_removal(client, headers):
    response = client.post("/api/admin/properties/depto-1/images", headers=headers, files={
        "file": ("pixel.png", PNG, "image/png")
    })
    assert response.status_code == 200
    property_data = response.json()
    saved = main.UPLOAD_DIR / Path(property_data["images"][0]).name
    assert saved.exists()
    response = client.put("/api/admin/properties/depto-1", headers=headers, json={
        **property_data, "name": "Synthetic property", "images": []
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Synthetic property"
    assert not saved.exists()


def test_retention_removes_only_personal_fields(client, headers, booking_data):
    response = client.post("/api/admin/bookings", headers=headers, json={
        **booking_data, "start_date": "2000-01-10", "end_date": "2000-01-12",
        "phone": "synthetic-phone", "notes": "synthetic note"
    })
    assert response.status_code == 200
    booking = response.json()
    result = client.post("/api/admin/privacy/purge-bookings", headers=headers)
    assert result.status_code == 200
    assert result.json()["purged_bookings"] == 1
    remaining = client.get("/api/admin/bookings", headers=headers).json()[0]
    assert remaining["id"] == booking["id"]
    assert remaining["start_date"] == booking["start_date"]
    assert remaining["status"] == booking["status"]
    assert remaining["personal_data_purged_at"]
    for field in ("guest_name", "phone", "notes"):
        assert remaining[field] == ""
    assert client.post("/api/admin/privacy/purge-bookings", headers=headers).json()["purged_bookings"] == 0


def test_existing_database_migration_preserves_bookings(client, headers, booking_data, tmp_path, monkeypatch):
    response = client.post("/api/admin/bookings", headers=headers, json=booking_data)
    assert response.status_code == 200
    original = response.json()
    legacy_path = tmp_path / "legacy.db"
    with main.get_db() as source:
        legacy = sqlite3.connect(legacy_path)
        try:
            source.backup(legacy)
            legacy.execute("ALTER TABLE bookings DROP COLUMN personal_data_purged_at")
            legacy.commit()
        finally:
            legacy.close()
    monkeypatch.setattr(main, "DATABASE_PATH", str(legacy_path))
    main.init_db()
    main.auth.initialize()
    with main.get_db() as db:
        migrated = dict(db.execute("SELECT * FROM bookings").fetchone())
        columns = {row["name"] for row in db.execute("PRAGMA table_info(bookings)")}
    assert "personal_data_purged_at" in columns
    for field, value in original.items():
        assert migrated[field] == value
