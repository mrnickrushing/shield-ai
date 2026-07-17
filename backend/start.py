"""Production launcher for the API, Celery worker, and Celery beat.

All Railway services use the same image and start command. ``SHIELD_PROCESS``
selects the role (``api`` by default, ``worker``, or ``beat``). Background roles
run a tiny liveness server so Railway's shared ``/health`` check reflects the
actual Celery child process instead of forcing those services to fail health
checks or disabling monitoring.

Schema is managed exclusively by the API's Alembic startup migration. A
migration failure is fatal: serving an application against an unknown schema can
corrupt data and makes a shallow database health check misleading.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
import signal
import subprocess
import threading


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )


def run_migrations() -> None:
    """Bring the database schema to head or abort startup."""
    result = _run(["alembic", "upgrade", "head"])
    if result.returncode != 0:
        combined = ((result.stdout or "") + (result.stderr or ""))[-4000:]
        raise RuntimeError(f"alembic upgrade head failed (rc={result.returncode}):\n{combined}")
    print("[startup] alembic upgrade head: OK")
    if result.stdout:
        print(result.stdout)


def promote_initial_admins() -> None:
    """One-shot admin promotion: reads INITIAL_ADMIN_EMAILS (comma-separated),
    sets is_admin=True for those users, then does nothing if the var is unset.
    Passwords are never changed at startup; promotion is the only idempotent
    bootstrap action."""
    emails_raw = os.environ.get("INITIAL_ADMIN_EMAILS", "").strip()
    if not emails_raw:
        return
    emails = [e.strip() for e in emails_raw.split(",") if e.strip()]
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(os.environ["DATABASE_URL"])
        with engine.connect() as conn:
            result = conn.execute(
                text("UPDATE users SET is_admin = true WHERE email = ANY(:emails)"),
                {"emails": emails},
            )
            conn.commit()
            print(f"[startup] promoted {result.rowcount} user(s) to admin: {emails}")

    except Exception as exc:
        print(f"[startup] admin promotion skipped: {exc}")


class _ProcessHealthHandler(BaseHTTPRequestHandler):
    """Report the supervised Celery process rather than merely opening a port."""

    child: subprocess.Popen | None = None

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        healthy = self.path == "/health" and self.child is not None and self.child.poll() is None
        status = 200 if healthy else 503
        body = b'{"status":"healthy"}' if healthy else b'{"status":"unhealthy"}'
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def _run_background_process(role: str) -> int:
    from app.core.config import validate_runtime_settings

    validate_runtime_settings()
    commands = {
        "worker": [
            "celery",
            "-A",
            "app.workers.celery_app.celery_app",
            "worker",
            "--loglevel=info",
            "--concurrency=2",
        ],
        "beat": [
            "celery",
            "-A",
            "app.workers.celery_app.celery_app",
            "beat",
            "--loglevel=info",
        ],
    }
    command = commands[role]
    port = int(os.environ.get("PORT", "8000"))
    child = subprocess.Popen(command, start_new_session=True)
    _ProcessHealthHandler.child = child
    try:
        server = ThreadingHTTPServer(("0.0.0.0", port), _ProcessHealthHandler)
    except Exception:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=10)
        raise
    server.daemon_threads = True
    health_thread = threading.Thread(target=server.serve_forever, daemon=True)
    health_thread.start()

    def forward_signal(signum: int, _frame: object) -> None:
        if child.poll() is None:
            os.killpg(child.pid, signum)

    signal.signal(signal.SIGTERM, forward_signal)
    signal.signal(signal.SIGINT, forward_signal)
    try:
        return child.wait()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    process_role = os.environ.get("SHIELD_PROCESS", "api").strip().lower()
    if process_role in {"worker", "beat"}:
        raise SystemExit(_run_background_process(process_role))
    if process_role != "api":
        raise RuntimeError("SHIELD_PROCESS must be one of: api, worker, beat")

    import uvicorn

    run_migrations()
    promote_initial_admins()
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)
