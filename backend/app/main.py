import json
import os
import asyncio
import contextlib
import logging
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

from .security import AdminAuth, AuthSettings
from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

load_dotenv()

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
is_production = ENVIRONMENT == "production"

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
DATABASE_PATH = os.getenv("DATABASE_PATH", "./apartrincon.db")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./static/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

BOOKING_STATUSES = {"reserved", "blocked", "pending", "completed", "cancelled"}
CONFLICTING_BOOKING_STATUSES = {"reserved", "blocked"}

app = FastAPI(
    title="ApartRincón API",
    description="API base para propiedades, galería y agenda privada de ApartRincón.",
    version="0.3.1",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)


def normalize_origin(value: str) -> str:
    value = str(value or "").strip().rstrip("/")
    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return value


frontend_origin = normalize_origin(FRONTEND_URL)
trusted_https_origins = [
    frontend_origin,
    "https://www.apartrinconcba.com",
    "https://apartrinconcba.com",
]

if is_production:
    cors_origins = [
        origin for origin in trusted_https_origins if origin.startswith("https://")
    ]
else:
    cors_origins = [
        frontend_origin,
        "https://www.apartrinconcba.com",
        "https://apartrinconcba.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

cors_origins = list(dict.fromkeys(origin for origin in cors_origins if origin))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Retry-After"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path.startswith(("/api/auth", "/api/admin")):
        response.headers["Cache-Control"] = "no-store"
    if is_production:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=1, max_length=256)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class PropertyBase(BaseModel):
    id: str
    name: str
    short_description: str = ""
    description: str = ""
    capacity: int = Field(default=1, ge=1)
    services: list[str] = []
    accessibility: list[str] = []
    images: list[str] = []
    active: bool = True


class GalleryImageBase(BaseModel):
    id: str
    image_url: str
    title: str = ""
    category: str = "general"
    created_at: str = ""


class BookingBase(BaseModel):
    property_id: str = Field(min_length=1, max_length=80)
    start_date: str
    end_date: str
    status: str = "reserved"
    guest_name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    notes: str = Field(default="", max_length=1000)

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_date(cls, value: str) -> str:
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d")
            if parsed.date().isoformat() != value:
                raise ValueError("La fecha debe usar formato YYYY-MM-DD")
        except ValueError as exc:
            raise ValueError("La fecha debe usar formato YYYY-MM-DD") from exc
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in BOOKING_STATUSES:
            raise ValueError(f"Estado inválido. Usa uno de: {', '.join(sorted(BOOKING_STATUSES))}")
        return value


class BookingCreate(BookingBase):
    pass


class BookingUpdate(BaseModel):
    property_id: Optional[str] = Field(default=None, min_length=1, max_length=80)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    guest_name: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator(
        "property_id", "start_date", "end_date", "status",
        "guest_name", "phone", "notes", mode="before"
    )
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("El campo no puede ser nulo; omitilo para conservar su valor")
        return value

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_optional_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d")
            if parsed.date().isoformat() != value:
                raise ValueError("La fecha debe usar formato YYYY-MM-DD")
        except ValueError as exc:
            raise ValueError("La fecha debe usar formato YYYY-MM-DD") from exc
        return value

    @field_validator("status")
    @classmethod
    def validate_optional_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if value not in BOOKING_STATUSES:
            raise ValueError(f"Estado inválido. Usa uno de: {', '.join(sorted(BOOKING_STATUSES))}")
        return value



@contextlib.contextmanager
def get_db():
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


auth = AdminAuth(AuthSettings.from_env(), get_db)



def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    for key in ("services", "accessibility", "images"):
        if key in data:
            data[key] = json.loads(data[key] or "[]")
    if "active" in data:
        data["active"] = bool(data["active"])
    return data



def require_admin(authorization: str = Header(default="")) -> str:
    return auth.require_session(authorization)


IMAGE_TYPES = {
    "image/jpeg": {"extensions": {".jpg", ".jpeg"}, "default": ".jpg"},
    "image/png": {"extensions": {".png"}, "default": ".png"},
    "image/webp": {"extensions": {".webp"}, "default": ".webp"},
    "image/gif": {"extensions": {".gif"}, "default": ".gif"},
}


def detect_image_type(data: bytes) -> Optional[str]:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    return None


def read_validated_image(file: UploadFile) -> tuple[bytes, str]:
    max_bytes = max(1, int(os.getenv("UPLOAD_MAX_BYTES", str(8 * 1024 * 1024))))
    data = file.file.read(max_bytes + 1)

    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="La imagen no puede superar 8 MB")

    detected_type = detect_image_type(data)
    declared_type = (file.content_type or "").lower().strip()
    suffix = Path(file.filename or "").suffix.lower()

    if not detected_type or detected_type not in IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="El archivo no es una imagen JPG, PNG, WEBP o GIF válida")
    if declared_type != detected_type:
        raise HTTPException(status_code=400, detail="El tipo declarado no coincide con el archivo")
    if suffix not in IMAGE_TYPES[detected_type]["extensions"]:
        raise HTTPException(status_code=400, detail="La extensión no coincide con el contenido")

    return data, suffix or IMAGE_TYPES[detected_type]["default"]


def delete_local_upload(image_url: str) -> None:
    if not str(image_url or "").startswith("/uploads/"):
        return

    filename = Path(str(image_url).removeprefix("/uploads/")).name
    candidate = (UPLOAD_DIR / filename).resolve()
    upload_root = UPLOAD_DIR.resolve()

    if candidate.parent == upload_root and candidate.is_file():
        candidate.unlink()


def purge_expired_booking_personal_data() -> int:
    retention_days = max(1, int(os.getenv("BOOKING_PERSONAL_DATA_RETENTION_DAYS", "365")))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).date().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        cursor = db.execute(
            """
            UPDATE bookings
            SET guest_name = '', phone = '', notes = '',
                personal_data_purged_at = ?, updated_at = ?
            WHERE end_date <= ?
              AND (guest_name != '' OR phone != '' OR notes != '')
            """,
            (now, now, cutoff),
        )
        db.commit()
        return cursor.rowcount



def init_db() -> None:
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS properties (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                short_description TEXT DEFAULT '',
                description TEXT DEFAULT '',
                capacity INTEGER DEFAULT 1,
                services TEXT DEFAULT '[]',
                accessibility TEXT DEFAULT '[]',
                images TEXT DEFAULT '[]',
                active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                property_id TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'reserved',
                guest_name TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                personal_data_purged_at TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(property_id) REFERENCES properties(id)
            )
            """
        )

        booking_columns = {
            row["name"] for row in db.execute("PRAGMA table_info(bookings)").fetchall()
        }
        if "personal_data_purged_at" not in booking_columns:
            db.execute(
                "ALTER TABLE bookings ADD COLUMN personal_data_purged_at TEXT DEFAULT ''"
            )
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_bookings_end_date ON bookings(end_date)"
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS gallery_images (
                id TEXT PRIMARY KEY,
                image_url TEXT NOT NULL,
                title TEXT DEFAULT '',
                category TEXT DEFAULT 'general',
                created_at TEXT NOT NULL
            )
            """
        )

        count = db.execute("SELECT COUNT(*) AS total FROM properties").fetchone()["total"]
        if count == 0:
            now = datetime.utcnow().isoformat()
            seed_properties = [
                {
                    "id": "depto-1",
                    "name": "Departamento 1",
                    "short_description": "Departamento por temporada en Alta Gracia, preparado para una estadía cómoda, tranquila y funcional.",
                    "description": "Unidad equipada para huéspedes que buscan descanso, limpieza, seguridad y atención cercana. Ideal para consultar disponibilidad de forma directa por WhatsApp.",
                    "capacity": 4,
                    "services": ["WiFi", "Cocina equipada", "Ropa de cama", "Aire / calefacción", "TV"],
                    "accessibility": ["Ingreso cómodo", "Espacios funcionales"],
                    "images": [],
                    "active": 1,
                },
                {
                    "id": "depto-2",
                    "name": "Departamento 2",
                    "short_description": "Opción confortable para viajes, descanso o estadías temporarias cerca de Alta Gracia.",
                    "description": "Departamento equipado con servicios esenciales, distribución práctica y comunicación directa para coordinar fechas, consultas y condiciones de estadía.",
                    "capacity": 3,
                    "services": ["WiFi", "Cocina equipada", "Baño privado", "Ropa de cama", "Atención por WhatsApp"],
                    "accessibility": ["Circulación simple", "Ambientes prácticos"],
                    "images": [],
                    "active": 1,
                },
            ]

            for item in seed_properties:
                db.execute(
                    """
                    INSERT INTO properties (
                        id, name, short_description, description, capacity,
                        services, accessibility, images, active, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item["id"],
                        item["name"],
                        item["short_description"],
                        item["description"],
                        item["capacity"],
                        json.dumps(item["services"], ensure_ascii=False),
                        json.dumps(item["accessibility"], ensure_ascii=False),
                        json.dumps(item["images"], ensure_ascii=False),
                        item["active"],
                        now,
                        now,
                    ),
                )

        db.commit()


async def booking_privacy_cleanup_loop() -> None:
    interval = max(
        300,
        int(os.getenv("PRIVACY_CLEANUP_INTERVAL_SECONDS", "3600")),
    )
    while True:
        await asyncio.sleep(interval)
        try:
            purged = purge_expired_booking_personal_data()
            if purged:
                logger.info("Anonymized %s expired booking records", purged)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Booking privacy cleanup failed")


@app.on_event("startup")
async def startup() -> None:
    init_db()
    auth.initialize()
    purge_expired_booking_personal_data()
    app.state.privacy_cleanup_task = asyncio.create_task(
        booking_privacy_cleanup_loop()
    )


@app.on_event("shutdown")
async def shutdown() -> None:
    cleanup_task = getattr(app.state, "privacy_cleanup_task", None)
    if cleanup_task:
        cleanup_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await cleanup_task


@app.get("/")
def root() -> dict[str, str]:
    return {
        "status": "ok",
        "docs": "disabled" if is_production else "/docs",
        "properties": "/api/properties",
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request) -> LoginResponse:
    client_host = request.client.host if request.client else "unknown"
    return LoginResponse(**auth.login(payload.username, payload.password, client_host))


@app.post("/api/auth/logout")
def logout(session_hash: str = Depends(require_admin)) -> dict[str, str]:
    auth.logout(session_hash)
    return {"status": "ok"}


@app.get("/api/properties")
def list_public_properties() -> list[dict[str, Any]]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM properties WHERE active = 1 ORDER BY created_at ASC").fetchall()
    return [row_to_dict(row) for row in rows]


@app.get("/api/admin/properties", dependencies=[Depends(require_admin)])
def list_admin_properties() -> list[dict[str, Any]]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM properties ORDER BY created_at ASC").fetchall()
    return [row_to_dict(row) for row in rows]


@app.get("/api/gallery")
def list_public_gallery() -> list[dict[str, Any]]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM gallery_images ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/admin/gallery", dependencies=[Depends(require_admin)])
def list_admin_gallery() -> list[dict[str, Any]]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM gallery_images ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]


@app.post("/api/admin/gallery/images", dependencies=[Depends(require_admin)])
def upload_gallery_image(file: UploadFile = File(...)) -> dict[str, Any]:
    image_data, suffix = read_validated_image(file)

    image_id = str(uuid.uuid4())
    filename = f"gallery-{uuid.uuid4().hex}{suffix}"
    destination = UPLOAD_DIR / filename

    with destination.open("xb") as buffer:
        buffer.write(image_data)

    now = datetime.utcnow().isoformat()
    image_url = f"/uploads/{filename}"

    try:
        with get_db() as db:
            db.execute(
                """
                INSERT INTO gallery_images (id, image_url, title, category, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (image_id, image_url, "", "general", now),
            )
            db.commit()
            row = db.execute("SELECT * FROM gallery_images WHERE id = ?", (image_id,)).fetchone()
    except Exception:
        delete_local_upload(image_url)
        raise

    return dict(row)


@app.delete("/api/admin/gallery/{image_id}", dependencies=[Depends(require_admin)])
def delete_gallery_image(image_id: str) -> dict[str, str]:
    with get_db() as db:
        row = db.execute("SELECT * FROM gallery_images WHERE id = ?", (image_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")

        image_url = row["image_url"] or ""
        if image_url.startswith("/uploads/"):
            delete_local_upload(image_url)

        db.execute("DELETE FROM gallery_images WHERE id = ?", (image_id,))
        db.commit()

    return {"status": "deleted"}


@app.get("/api/properties/{property_id}")
def get_property(property_id: str) -> dict[str, Any]:
    with get_db() as db:
        row = db.execute("SELECT * FROM properties WHERE id = ? AND active = 1", (property_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    return row_to_dict(row)


@app.put("/api/admin/properties/{property_id}", dependencies=[Depends(require_admin)])
def update_property(property_id: str, payload: PropertyBase) -> dict[str, Any]:
    now = datetime.utcnow().isoformat()

    with get_db() as db:
        current = db.execute("SELECT * FROM properties WHERE id = ?", (property_id,)).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Propiedad no encontrada")

        previous_images = set(row_to_dict(current).get("images") or [])

        db.execute(
            """
            UPDATE properties
            SET name = ?, short_description = ?, description = ?, capacity = ?,
                services = ?, accessibility = ?, images = ?, active = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                payload.name,
                payload.short_description,
                payload.description,
                payload.capacity,
                json.dumps(payload.services, ensure_ascii=False),
                json.dumps(payload.accessibility, ensure_ascii=False),
                json.dumps(payload.images, ensure_ascii=False),
                1 if payload.active else 0,
                now,
                property_id,
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM properties WHERE id = ?", (property_id,)).fetchone()

    for removed_image in previous_images - set(payload.images):
        delete_local_upload(removed_image)

    return row_to_dict(row)


@app.post("/api/admin/properties/{property_id}/images", dependencies=[Depends(require_admin)])
def upload_property_image(property_id: str, file: UploadFile = File(...)) -> dict[str, Any]:
    image_data, suffix = read_validated_image(file)

    safe_property_id = "".join(
        character for character in property_id if character.isalnum() or character in {"-", "_"}
    )[:60] or "property"
    filename = f"{safe_property_id}-{uuid.uuid4().hex}{suffix}"
    destination = UPLOAD_DIR / filename

    image_url = f"/uploads/{filename}"
    try:
        with get_db() as db:
            row = db.execute("SELECT * FROM properties WHERE id = ?", (property_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Propiedad no encontrada")

            with destination.open("xb") as buffer:
                buffer.write(image_data)

            data = row_to_dict(row)
            images = data.get("images") or []
            images.append(image_url)
            now = datetime.utcnow().isoformat()

            db.execute(
                "UPDATE properties SET images = ?, updated_at = ? WHERE id = ?",
                (json.dumps(images, ensure_ascii=False), now, property_id),
            )
            db.commit()
            updated = db.execute("SELECT * FROM properties WHERE id = ?", (property_id,)).fetchone()
    except Exception:
        delete_local_upload(image_url)
        raise

    return row_to_dict(updated)



def validate_booking_dates(start_date: str, end_date: str) -> None:
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    if end <= start:
        raise HTTPException(status_code=400, detail="La fecha de salida debe ser posterior a la fecha de entrada")



def has_booking_conflict(
    db: sqlite3.Connection,
    property_id: str,
    start_date: str,
    end_date: str,
    ignore_booking_id: Optional[str] = None,
) -> bool:
    params: list[Any] = [property_id, end_date, start_date]
    query = """
        SELECT id FROM bookings
        WHERE property_id = ?
          AND status IN ('reserved', 'blocked')
          AND start_date < ?
          AND end_date > ?
    """

    if ignore_booking_id:
        query += " AND id != ?"
        params.append(ignore_booking_id)

    return db.execute(query, tuple(params)).fetchone() is not None


@app.get("/api/admin/bookings", dependencies=[Depends(require_admin)])
def list_admin_bookings() -> list[dict[str, Any]]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM bookings ORDER BY start_date ASC").fetchall()
    return [dict(row) for row in rows]


@app.post("/api/admin/privacy/purge-bookings", dependencies=[Depends(require_admin)])
def purge_booking_data_now() -> dict[str, Any]:
    return {
        "status": "ok",
        "purged_bookings": purge_expired_booking_personal_data(),
        "retention_days": max(
            1, int(os.getenv("BOOKING_PERSONAL_DATA_RETENTION_DAYS", "365"))
        ),
    }


@app.post("/api/admin/bookings", dependencies=[Depends(require_admin)])
def create_booking(payload: BookingCreate) -> dict[str, Any]:
    validate_booking_dates(payload.start_date, payload.end_date)

    now = datetime.utcnow().isoformat()
    booking_id = str(uuid.uuid4())

    with get_db() as db:
        # Lock before checking overlaps so concurrent writes cannot double-book.
        db.execute("BEGIN IMMEDIATE")
        property_exists = db.execute("SELECT id FROM properties WHERE id = ?", (payload.property_id,)).fetchone()
        if not property_exists:
            raise HTTPException(status_code=404, detail="Propiedad no encontrada")

        if payload.status in CONFLICTING_BOOKING_STATUSES and has_booking_conflict(
            db,
            payload.property_id,
            payload.start_date,
            payload.end_date,
        ):
            raise HTTPException(status_code=409, detail="La propiedad ya tiene una reserva o bloqueo en esas fechas")

        db.execute(
            """
            INSERT INTO bookings (
                id, property_id, start_date, end_date, status,
                guest_name, phone, notes, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                booking_id,
                payload.property_id,
                payload.start_date,
                payload.end_date,
                payload.status,
                payload.guest_name,
                payload.phone,
                payload.notes,
                now,
                now,
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()

    return dict(row)


@app.patch("/api/admin/bookings/{booking_id}", dependencies=[Depends(require_admin)])
def update_booking(booking_id: str, payload: BookingUpdate) -> dict[str, Any]:
    with get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        current = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        data = dict(current)
        updates = payload.model_dump(exclude_unset=True)
        data.update(updates)

        validate_booking_dates(data["start_date"], data["end_date"])

        property_exists = db.execute(
            "SELECT id FROM properties WHERE id = ?", (data["property_id"],)
        ).fetchone()
        if not property_exists:
            raise HTTPException(status_code=404, detail="Propiedad no encontrada")

        if data["status"] in CONFLICTING_BOOKING_STATUSES and has_booking_conflict(
            db,
            data["property_id"],
            data["start_date"],
            data["end_date"],
            ignore_booking_id=booking_id,
        ):
            raise HTTPException(status_code=409, detail="La propiedad ya tiene una reserva o bloqueo en esas fechas")

        now = datetime.utcnow().isoformat()
        db.execute(
            """
            UPDATE bookings
            SET property_id = ?, start_date = ?, end_date = ?, status = ?,
                guest_name = ?, phone = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                data["property_id"],
                data["start_date"],
                data["end_date"],
                data["status"],
                data["guest_name"],
                data["phone"],
                data["notes"],
                now,
                booking_id,
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()

    return dict(row)


@app.delete("/api/admin/bookings/{booking_id}", dependencies=[Depends(require_admin)])
def delete_booking(booking_id: str) -> dict[str, str]:
    with get_db() as db:
        exists = db.execute("SELECT id FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        db.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
        db.commit()

    return {"status": "deleted"}
