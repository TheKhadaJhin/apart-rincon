"""Run from backend with: python -m app.hash_password"""
from getpass import getpass

from .security import hash_password


def main() -> None:
    password = getpass("Nueva contraseña del administrador (12–256 caracteres): ")
    confirmation = getpass("Repetí la contraseña: ")
    if password != confirmation:
        raise SystemExit("Las contraseñas no coinciden")
    try:
        encoded = hash_password(password)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print("Copiá esta línea completa a backend/.env (no la subas a Git):")
    print(f"ADMIN_PASSWORD_HASH='{encoded}'")


if __name__ == "__main__":
    main()
