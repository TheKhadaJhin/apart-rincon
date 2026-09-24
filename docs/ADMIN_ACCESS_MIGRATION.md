# Migrar el acceso del administrador

Esta versión reemplaza la contraseña en texto plano y los tokens anteriores por una contraseña con hash Argon2id y sesiones revocables. Las propiedades, imágenes y reservas se conservan en sus ubicaciones actuales.

## 1. Preparar la configuración

En una copia local del proyecto, desde `backend/` y con el entorno virtual activo:

```bash
python -m pip install -r requirements.txt
python -m app.hash_password
```

Ingresá dos veces una contraseña privada de 12–256 caracteres. El comando oculta la entrada e imprime una línea `ADMIN_PASSWORD_HASH='...'`.

- En `backend/.env`, pegá la línea completa con sus comillas y configurá tu `ADMIN_USER`.
- En el panel de variables del proveedor, usá la clave `ADMIN_PASSWORD_HASH` y pegá solamente el hash completo, sin las comillas externas.
- Conservá `ADMIN_SESSION_MINUTES=60` o elegí entre 5 y 1440 minutos.
- Retirá `ADMIN_PASSWORD` y `ADMIN_TOKEN`: esta versión ya no los utiliza.
- Conservá los valores existentes de `DATABASE_PATH` y `UPLOAD_DIR`, ambos en almacenamiento persistente. No copies estos secretos al frontend ni al repositorio.

Si faltan el usuario o el hash, el catálogo público sigue disponible y el login devuelve `503`; las rutas privadas permanecen cerradas. Un hash con formato inválido impide iniciar la API.

## 2. Actualizar una instalación existente

1. Guardá una copia consistente de SQLite y de las imágenes antes del despliegue.
2. Configurá las variables nuevas y desplegá primero el backend. Reiniciá todos sus workers para que usen las mismas credenciales.
3. Desplegá el frontend de esta misma versión.
4. Abrí `/admin` e ingresá con la contraseña que elegiste. Los tokens anteriores dejan de servir.
5. Comprobá la lectura de propiedades y agenda, una edición de prueba y el cierre de sesión. Al salir, volver a una ruta privada debe exigir un nuevo login.

El inicio de la API crea las tablas de sesiones e intentos de acceso sin reemplazar las tablas existentes. Se conserva también la política de retención de la PR: por defecto, nombre, teléfono y notas de reservas se anonimizan 365 días después de la salida. Revisá `BOOKING_PERSONAL_DATA_RETENTION_DAYS` antes de iniciar una instalación con datos existentes.

Si necesitás volver a una versión anterior, coordiná backend, frontend y variables como una unidad. No borres ni reemplaces la base para resolver un problema de acceso.

## 3. Comportamiento de las sesiones

- El token queda solamente en memoria del navegador. Recargar o cerrar la pestaña requiere volver a ingresar.
- La API verifica el vencimiento en cada petición protegida. El frontend también cierra el panel al vencer.
- “Cerrar sesión” revoca el token actual en SQLite. Si falla la conexión, el panel se cierra localmente y avisa que la revocación no pudo confirmarse; el token del servidor conserva su vencimiento original.
- Cambiar `ADMIN_USER` o `ADMIN_PASSWORD_HASH` e iniciar todos los workers con esa configuración invalida las sesiones previas.
- La base guarda el resumen SHA-256 del token, no el token utilizable. Las sesiones y los intentos se comparten entre workers que acceden al mismo archivo SQLite.

## 4. Límite de intentos y proxy

Se permiten cinco intentos por IP en una ventana de 15 minutos. Un ingreso correcto reinicia el contador; cambiar el nombre de usuario no lo evita. Al superar el límite, la API responde `429` y el tiempo restante en `Retry-After`.

La aplicación toma la IP de `request.client.host`, proporcionada por el servidor ASGI. No interpreta directamente `X-Forwarded-For`. Si usás un proxy inverso, configurá Uvicorn para confiar solamente en las direcciones reales de ese proxy y verificá que la dirección del cliente llegue correctamente. No habilites confianza indiscriminada en encabezados enviados desde Internet. Con una configuración incorrecta, varios usuarios pueden compartir el límite de la IP del proxy.

## Pruebas reproducibles

Desde `backend/`:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest tests -v --cov=app --cov-report=term-missing
```

Desde `frontend/`:

```bash
npm ci
npm test
npm run build
```

Las pruebas usan credenciales sintéticas y bases temporales. Los resultados reales de cada commit quedan en [GitHub Actions](https://github.com/TheKhadaJhin/apart-rincon/actions/workflows/quality.yml).
