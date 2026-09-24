"""Password verification and revocable, expiring admin sessions."""
import hashlib
import math
import os
import secrets
import sqlite3
import time
from dataclasses import dataclass
from typing import Callable, ContextManager

from argon2 import PasswordHasher, Type, extract_parameters
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException

PASSWORD_HASHER = PasswordHasher()


def hash_password(password: str) -> str:
    if not 12 <= len(password) <= 256:
        raise ValueError("La contraseña debe tener entre 12 y 256 caracteres")
    return PASSWORD_HASHER.hash(password)


@dataclass(frozen=True)
class AuthSettings:
    username: str
    password_hash: str
    session_minutes: int = 60
    max_attempts: int = 5
    window_seconds: int = 15 * 60

    def __post_init__(self):
        if not 5 <= self.session_minutes <= 1440:
            raise ValueError("ADMIN_SESSION_MINUTES must be between 5 and 1440")
        if self.password_hash:
            try:
                parameters = extract_parameters(self.password_hash)
            except (InvalidHashError, ValueError) as exc:
                raise ValueError("ADMIN_PASSWORD_HASH must be a valid Argon2id hash") from exc
            if parameters.type != Type.ID:
                raise ValueError("ADMIN_PASSWORD_HASH must use Argon2id")

    @classmethod
    def from_env(cls):
        return cls(
            username=os.getenv("ADMIN_USER", "").strip(),
            password_hash=os.getenv("ADMIN_PASSWORD_HASH", "").strip(),
            session_minutes=int(os.getenv("ADMIN_SESSION_MINUTES", "60")),
        )

    @property
    def configured(self) -> bool:
        return bool(self.username and self.password_hash)

    @property
    def credential_version(self) -> str:
        return hashlib.sha256(
            (self.username + "\0" + self.password_hash).encode("utf-8")
        ).hexdigest()


class AdminAuth:
    def __init__(
        self,
        settings: AuthSettings,
        database: Callable[[], ContextManager[sqlite3.Connection]],
        clock: Callable[[], float] = time.time,
    ):
        self.settings = settings
        self.database = database
        self.clock = clock

    def initialize(self) -> None:
        with self.database() as db:
            db.execute(
                """CREATE TABLE IF NOT EXISTS admin_sessions (
                    token_hash TEXT PRIMARY KEY,
                    expires_at INTEGER NOT NULL,
                    credential_version TEXT NOT NULL
                )"""
            )
            db.execute(
                """CREATE TABLE IF NOT EXISTS admin_login_attempts (
                    client_hash TEXT PRIMARY KEY,
                    attempts INTEGER NOT NULL,
                    window_ends INTEGER NOT NULL
                )"""
            )

    def _reserve_attempt(self, client_host: str) -> str:
        # Use the ASGI peer address, never an untrusted forwarded header.
        # A shared DB also enforces this limit across workers and restarts.
        client_hash = hashlib.sha256(client_host.encode("utf-8")).hexdigest()
        now = self.clock()
        with self.database() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM admin_login_attempts WHERE window_ends <= ?", (now,))
            row = db.execute(
                "SELECT * FROM admin_login_attempts WHERE client_hash = ?",
                (client_hash,),
            ).fetchone()
            if row and row["attempts"] >= self.settings.max_attempts:
                raise HTTPException(
                    status_code=429,
                    detail="Demasiados intentos. Volvé a intentar más tarde.",
                    headers={"Retry-After": str(max(1, math.ceil(row["window_ends"] - now)))},
                )
            if row:
                db.execute(
                    "UPDATE admin_login_attempts SET attempts = attempts + 1 WHERE client_hash = ?",
                    (client_hash,),
                )
            else:
                db.execute(
                    "INSERT INTO admin_login_attempts VALUES (?, ?, ?)",
                    (client_hash, 1, math.ceil(now + self.settings.window_seconds)),
                )
        return client_hash

    def login(self, username: str, password: str, client_host: str) -> dict:
        if not self.settings.configured:
            raise HTTPException(
                status_code=503,
                detail="El acceso administrativo todavía no fue configurado",
            )

        client_hash = self._reserve_attempt(client_host)
        # Verify the hash even for an unknown username to avoid a cheap username probe.
        try:
            valid_password = PASSWORD_HASHER.verify(self.settings.password_hash, password)
        except (VerificationError, InvalidHashError):
            valid_password = False
        valid_user = secrets.compare_digest(
            username.strip().encode("utf-8"), self.settings.username.encode("utf-8")
        )
        if not valid_user or not valid_password:
            raise HTTPException(
                status_code=401,
                detail="Credenciales inválidas",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = secrets.token_urlsafe(32)
        expires_in = self.settings.session_minutes * 60
        now = self.clock()
        with self.database() as db:
            db.execute("DELETE FROM admin_login_attempts WHERE client_hash = ?", (client_hash,))
            db.execute(
                "DELETE FROM admin_sessions WHERE expires_at <= ? OR credential_version != ?",
                (now, self.settings.credential_version),
            )
            # Only the digest is retained; a database dump does not contain bearer tokens.
            db.execute(
                "INSERT INTO admin_sessions VALUES (?, ?, ?)",
                (
                    hashlib.sha256(token.encode("utf-8")).hexdigest(),
                    math.ceil(now + expires_in),
                    self.settings.credential_version,
                ),
            )
        return {"access_token": token, "token_type": "bearer", "expires_in": expires_in}

    def require_session(self, authorization: str) -> str:
        scheme, _, token = authorization.partition(" ")
        token = token.strip()
        if self.settings.configured and scheme.lower() == "bearer" and 1 <= len(token) <= 256:
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            with self.database() as db:
                row = db.execute(
                    "SELECT expires_at FROM admin_sessions WHERE token_hash = ? AND credential_version = ?",
                    (token_hash, self.settings.credential_version),
                ).fetchone()
            if row and row["expires_at"] > self.clock():
                return token_hash
        raise HTTPException(
            status_code=401,
            detail="La sesión venció o no es válida. Volvé a ingresar.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    def logout(self, token_hash: str) -> None:
        with self.database() as db:
            db.execute("DELETE FROM admin_sessions WHERE token_hash = ?", (token_hash,))
