"""Production launcher.

Reads $PORT in Python so there's no dependency on shell variable expansion
in the container start command, and runs Alembic migrations before serving.

Schema is managed *exclusively* by Alembic. If a previous deploy created the
tables directly (via create_all) without stamping a version, the first
`alembic upgrade head` will fail with DuplicateTable. We detect that case and
`alembic stamp head` to reconcile, so subsequent boots upgrade cleanly.
"""
import os
import subprocess


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )


def run_migrations() -> None:
    """Bring the DB schema to head. Idempotent and resilient to legacy
    create_all schemas that were never stamped."""
    try:
        result = _run(["alembic", "upgrade", "head"])
        if result.returncode == 0:
            print("[startup] alembic upgrade head: OK")
            if result.stdout:
                print(result.stdout)
            return

        combined = (result.stdout or "") + (result.stderr or "")
        print(f"[startup] alembic upgrade failed (rc={result.returncode}):")
        print(combined[-2000:])

        # Legacy DB: tables exist but alembic_version was never set. Stamp the
        # current revision so alembic treats the schema as up to date, then
        # re-run upgrade to apply anything newer.
        if "already exists" in combined or "DuplicateTable" in combined:
            print("[startup] detected pre-existing schema; stamping head to reconcile")
            stamp = _run(["alembic", "stamp", "head"])
            print(stamp.stdout or stamp.stderr)
            upgrade = _run(["alembic", "upgrade", "head"])
            print(upgrade.stdout or upgrade.stderr)
    except Exception as exc:  # never let migrations block the server from booting
        print(f"[startup] alembic step skipped due to error: {exc}")


if __name__ == "__main__":
    import uvicorn

    run_migrations()
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)
