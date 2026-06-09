"""Production launcher. Reads $PORT in Python so there's no dependency on
shell variable expansion in the container start command."""
import os
import subprocess

import uvicorn


def run_migrations() -> None:
    """Best-effort Alembic upgrade on boot. The app's lifespan also calls
    create_all as a safety net, so a migration hiccup won't block startup."""
    try:
        subprocess.run(["alembic", "upgrade", "head"], check=False, timeout=60)
    except Exception as exc:
        print(f"[startup] alembic upgrade skipped: {exc}")


if __name__ == "__main__":
    run_migrations()
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)
