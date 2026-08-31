import json
import os
import asyncio
import contextlib
import logging
import secrets
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Optional
from urllib.parse import urlparse

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

load_dotenv()

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
is_production = ENVIRONMENT == "production"

ADMIN_USER = os.getenv("ADMIN_USER", "").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
ADMIN_SESSION_MINUTES = max(5, int(os.getenv("ADMIN_SESSION_MINUTES", "60")))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
DATABASE_PATH = os.getenv("DATABASE_PATH", "./apartrincon.db")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./static/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

if is_production and (
    not ADMIN_USER
    or not ADMIN_PASSWORD
    or len(ADMIN_PASSWORD) < 12
    or len(ADMIN_TOKEN) < 32
):
    raise RuntimeError(
        "Production requires a private ADMIN_USER, strong ADMIN_PASSWORD and ADMIN_TOKEN of at least 32 characters"
    )

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


ADMIN_LOGIN_MAX_FAILED = 5
ADMIN_LOGIN_LOCKOUT_SECONDS = 15 * 60
_admin_login_attempts: dict[str, dict[str, float]] = {}
_admin_login_attempts_lock = Lock()


def _admin_login_key(request: Request, username: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{client_host}:{username.strip().lower()}"


def _check_admin_login_lock(key: str) -> int:
    now = time.monotonic()
    with _admin_login_attempts_lock:
        # Keep this process-local guard bounded even if an attacker rotates usernames.
        expired = [
            item_key
            for item_key, item in _admin_login_attempts.items()
            if item.get("blocked_until", 0) <= now and item.get("last_attempt", 0) + ADMIN_LOGIN_LOCKOUT_SECONDS <= now
        ]
        for item_key in expired:
            _admin_login_attempts.pop(item_key, None)

        item = _admin_login_attempts.get(key)
        if not item:
            return 0

        blocked_until = item.get("blocked_until", 0)
        if blocked_until > now:
            return max(1, int(blocked_until - now))

        return 0


def _record_admin_login_failure(key: str) -> bool:
    now = time.monotonic()
    with _admin_login_attempts_lock:
        if key not in _admin_login_attempts and len(_admin_login_attempts) >= 10_000:
            oldest_key = min(
                _admin_login_attempts,
                key=lambda item_key: _admin_login_attempts[item_key].get("last_attempt", 0),
            )
            _admin_login_attempts.pop(oldest_key, None)

        item = _admin_login_attempts.setdefault(key, {"failed": 0.0})
        item["failed"] = item.get("failed", 0) + 1
        item["last_attempt"] = now
        if item["failed"] >= ADMIN_LOGIN_MAX_FAILED:
            item["blocked_until"] = now + ADMIN_LOGIN_LOCKOUT_SECONDS
            return True
    return False


def _clear_admin_login_failures(key: str) -> None:
    with _admin_login_attempts_lock:
        _admin_login_attempts.pop(key, None)


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
            datetime.strptime(value, "%Y-%m-%d")
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

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_optional_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            datetime.strptime(value, "%Y-%m-%d")
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



def get_db() -> sqlite3.Connection:
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection



def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    for key in ("services", "accessibility", "images"):
        if key in data:
            data[key] = json.loads(data[key] or "[]")
    if "active" in data:
        data["active"] = bool(data["active"])
    return data



def create_admin_token() -> str:
    if not ADMIN_USER or not ADMIN_PASSWORD or len(ADMIN_TOKEN) < 32:
        raise HTTPException(
            status_code=503,
            detail="El acceso administrativo todavía no fue configurado",
        )

    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": ADMIN_USER,
            "type": "admin",
            "iat": now,
            "exp": now + timedelta(minutes=ADMIN_SESSION_MINUTES),
        },
        ADMIN_TOKEN,
        algorithm="HS256",
    )


def require_admin(authorization: str = Header(default="")) -> None:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión requerida")

    try:
        payload = jwt.decode(
            authorization[7:],
            ADMIN_TOKEN,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="La sesión venció. Volvé a ingresar")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Sesión inválida")

    if payload.get("type") != "admin" or payload.get("sub") != ADMIN_USER:
        raise HTTPException(status_code=401, detail="Sesión inválida")


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
    if not ADMIN_USER or not ADMIN_PASSWORD or len(ADMIN_TOKEN) < 32:
        raise HTTPException(
            status_code=503,
            detail="El acceso administrativo todavía no fue configurado",
        )

    attempt_key = _admin_login_key(request, payload.username)
    retry_after = _check_admin_login_lock(attempt_key)
    if retry_after:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Volvé a intentar más tarde.",
            headers={"Retry-After": str(retry_after)},
        )

    valid_user = secrets.compare_digest(
        payload.username.strip().encode("utf-8"), ADMIN_USER.encode("utf-8")
    )
    valid_password = secrets.compare_digest(
        payload.password.encode("utf-8"), ADMIN_PASSWORD.encode("utf-8")
    )
    if not valid_user or not valid_password:
        locked = _record_admin_login_failure(attempt_key)
        if locked:
            raise HTTPException(
                status_code=429,
                detail="Demasiados intentos. Volvé a intentar más tarde.",
                headers={"Retry-After": str(ADMIN_LOGIN_LOCKOUT_SECONDS)},
            )
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    _clear_admin_login_failures(attempt_key)
    return LoginResponse(access_token=create_admin_token())


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
        current = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        data = dict(current)
        updates = payload.model_dump(exclude_unset=True)
        data.update(updates)

        validate_booking_dates(data["start_date"], data["end_date"])

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
