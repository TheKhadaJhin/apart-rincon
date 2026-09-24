from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from app import main


def create(client, headers, data, **changes):
    response = client.post("/api/admin/bookings", headers=headers, json={**data, **changes})
    assert response.status_code == 200, response.text
    return response.json()


def test_booking_create_edit_move_and_delete(client, headers, booking_data):
    booking = create(client, headers, booking_data)
    response = client.patch("/api/admin/bookings/" + booking["id"], headers=headers, json={
        "property_id": "depto-2", "guest_name": "", "notes": "Synthetic update"
    })
    assert response.status_code == 200
    updated = response.json()
    assert updated["property_id"] == "depto-2"
    assert updated["guest_name"] == ""
    assert updated["start_date"] == booking["start_date"]
    assert updated["notes"] == "Synthetic update"
    assert client.delete("/api/admin/bookings/" + booking["id"], headers=headers).status_code == 200
    assert client.get("/api/admin/bookings", headers=headers).json() == []


@pytest.mark.parametrize("field", [
    "property_id", "start_date", "end_date", "status", "guest_name", "phone", "notes"
])
def test_explicit_null_is_rejected_without_changing_booking(client, headers, booking_data, field):
    booking = create(client, headers, booking_data)
    response = client.patch("/api/admin/bookings/" + booking["id"], headers=headers, json={field: None})
    assert response.status_code == 422
    assert client.get("/api/admin/bookings", headers=headers).json() == [booking]


def test_unknown_property_is_rejected_on_create_and_edit(client, headers, booking_data):
    response = client.post("/api/admin/bookings", headers=headers, json={
        **booking_data, "property_id": "does-not-exist"
    })
    assert response.status_code == 404
    booking = create(client, headers, booking_data)
    response = client.patch("/api/admin/bookings/" + booking["id"], headers=headers, json={
        "property_id": "does-not-exist"
    })
    assert response.status_code == 404
    assert client.get("/api/admin/bookings", headers=headers).json() == [booking]


@pytest.mark.parametrize("date", ["2035-1-09", "2035-02-30", "not-a-date"])
def test_noncanonical_or_invalid_dates_are_rejected(client, headers, booking_data, date):
    assert client.post("/api/admin/bookings", headers=headers, json={
        **booking_data, "start_date": date
    }).status_code == 422
    booking = create(client, headers, booking_data)
    assert client.patch("/api/admin/bookings/" + booking["id"], headers=headers, json={
        "start_date": date
    }).status_code == 422


@pytest.mark.parametrize("end_date", ["2035-01-10", "2035-01-09"])
def test_checkout_must_be_after_checkin(client, headers, booking_data, end_date):
    assert client.post("/api/admin/bookings", headers=headers, json={
        **booking_data, "end_date": end_date
    }).status_code == 400
    booking = create(client, headers, booking_data)
    assert client.patch("/api/admin/bookings/" + booking["id"], headers=headers, json={
        "end_date": end_date
    }).status_code == 400


@pytest.mark.parametrize("status", ["reserved", "blocked"])
def test_overlap_rejected_but_adjacent_dates_and_other_property_allowed(client, headers, booking_data, status):
    create(client, headers, booking_data, status=status)
    assert client.post("/api/admin/bookings", headers=headers, json=booking_data).status_code == 409
    create(client, headers, booking_data, start_date="2035-01-12", end_date="2035-01-14")
    create(client, headers, booking_data, property_id="depto-2")


def test_edit_ignores_itself_but_cannot_move_into_another_booking(client, headers, booking_data):
    first = create(client, headers, booking_data)
    assert client.patch("/api/admin/bookings/" + first["id"], headers=headers, json={
        "notes": "No date change"
    }).status_code == 200
    second = create(client, headers, booking_data, start_date="2035-01-13", end_date="2035-01-15")
    assert client.patch("/api/admin/bookings/" + second["id"], headers=headers, json={
        "start_date": "2035-01-11"
    }).status_code == 409


def test_pending_booking_can_overlap_but_confirmation_checks_conflicts(client, headers, booking_data):
    reserved = create(client, headers, booking_data)
    pending = create(client, headers, booking_data, status="pending")
    path = "/api/admin/bookings/" + pending["id"]
    assert client.patch(path, headers=headers, json={"status": "reserved"}).status_code == 409
    assert client.patch("/api/admin/bookings/" + reserved["id"], headers=headers, json={
        "status": "cancelled"
    }).status_code == 200
    assert client.patch(path, headers=headers, json={"status": "reserved"}).status_code == 200


def test_simultaneous_creates_do_not_double_book(client, headers, booking_data):
    barrier = Barrier(2)

    def attempt():
        barrier.wait(timeout=5)
        return client.post("/api/admin/bookings", headers=headers, json=booking_data).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(results) == [200, 409]
    assert len(client.get("/api/admin/bookings", headers=headers).json()) == 1


def test_sqlite_foreign_keys_are_enabled(client):
    with main.get_db() as db:
        assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_missing_booking_returns_404(client, headers):
    path = "/api/admin/bookings/missing"
    assert client.patch(path, headers=headers, json={"notes": "synthetic"}).status_code == 404
    assert client.delete(path, headers=headers).status_code == 404
