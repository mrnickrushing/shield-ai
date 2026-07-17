"""Shield AI — FastAPI application entrypoint."""
import hashlib
import ipaddress
from contextlib import asynccontextmanager
from time import monotonic, time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.v1 import admin, auth, billing, coach, community, developer, education, family, identity, message_filter, monitoring, notifications, phone_reputation, recovery, scans, url_reputation, verticals
from app.core.config import settings, validate_runtime_settings
from app.db.session import get_engine

_RATE_LIMIT_BUCKETS: dict[str, tuple[int, int]] = {}
_rate_limit_redis = None


class _RequestBodyTooLarge(Exception):
    pass


class RequestBodyLimitMiddleware:
    """Reject oversized fixed-length and chunked bodies while they stream in."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        raw_length = headers.get(b"content-length", b"")
        try:
            if raw_length and int(raw_length) > self.max_bytes:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Request body is too large."},
                )
                await response(scope, receive, send)
                return
        except ValueError:
            response = JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header."})
            await response(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _RequestBodyTooLarge
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _RequestBodyTooLarge:
            response = JSONResponse(
                status_code=413,
                content={"detail": "Request body is too large."},
            )
            await response(scope, receive, send)


def _init_sentry() -> None:
    if not settings.SENTRY_DSN:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,
            send_default_pii=False,  # scan content is sensitive; never attach request bodies
        )
        print("[startup] sentry initialized")
    except Exception as exc:
        print(f"[startup] sentry init failed: {exc}")


def _run_startup_seeds() -> None:
    """Populate baseline data (never blocks the server from booting)."""
    from app.db.session import SessionLocal
    from app.services.domain_seed import seed_scam_domains
    from app.services.phone_seed import seed_scam_numbers
    from app.services.threat_intel import seed_default_patterns

    for name, seeder in (
        ("scam numbers", seed_scam_numbers),
        ("scam domains", seed_scam_domains),
        ("threat-intel patterns", seed_default_patterns),
    ):
        try:
            db = SessionLocal()
            try:
                added = seeder(db)
                if added:
                    print(f"[startup] seeded {added} {name}")
            finally:
                db.close()
        except Exception as exc:
            print(f"[startup] {name} seeding skipped: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_settings()
    _init_sentry()
    _run_startup_seeds()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.6.0",
    description="AI-powered scam, phishing, and fraud detection assistant.",
    lifespan=lifespan,
    docs_url=None if settings.ENVIRONMENT.lower() in {"production", "prod"} else "/docs",
    redoc_url=None if settings.ENVIRONMENT.lower() in {"production", "prod"} else "/redoc",
    openapi_url=None if settings.ENVIRONMENT.lower() in {"production", "prod"} else "/openapi.json",
)

# A 10 MB binary screenshot expands to roughly 13.4 MB in base64 JSON. Keep a
# small envelope allowance for the JSON keys while rejecting larger bodies
# before Pydantic, multipart parsing, image decoding, or OCR can allocate them.
_max_json_image_bytes = ((settings.MAX_UPLOAD_MB * 1024 * 1024 + 2) // 3) * 4
app.add_middleware(RequestBodyLimitMiddleware, max_bytes=_max_json_image_bytes + 128 * 1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def production_rate_limit(request: Request, call_next):
    if settings.ENVIRONMENT.lower() not in {"production", "prod"} or settings.RATE_LIMIT_PER_MINUTE <= 0:
        return await call_next(request)
    if request.url.path in {"/health", "/"} or request.url.path.startswith(("/docs", "/openapi")):
        return await call_next(request)

    forwarded = request.headers.get("x-forwarded-for", "")
    # Railway appends the connecting client to X-Forwarded-For. The left-most
    # value is attacker-controlled when a caller supplies the header; use the
    # right-most valid address instead.
    candidates = [part.strip() for part in forwarded.split(",") if part.strip()]
    ip = candidates[-1] if candidates else (request.client.host if request.client else "unknown")
    try:
        ip = str(ipaddress.ip_address(ip))
    except ValueError:
        ip = "unknown"
    route_group = "/".join(request.url.path.split("/")[1:4])
    raw_key = f"{ip}:{route_group}"
    window = int(time() // 60)
    digest = hashlib.sha256(raw_key.encode()).hexdigest()
    count: int
    try:
        global _rate_limit_redis
        if _rate_limit_redis is None:
            import redis.asyncio as redis

            _rate_limit_redis = redis.Redis.from_url(
                settings.REDIS_URL,
                socket_connect_timeout=0.3,
                socket_timeout=0.3,
                decode_responses=True,
            )
        redis_key = f"rate:{window}:{digest}"
        count = int(await _rate_limit_redis.incr(redis_key))
        if count == 1:
            await _rate_limit_redis.expire(redis_key, 120)
    except Exception:
        # Bounded process-local fallback for Redis outages. Keys are fixed
        # windows rather than permanent timestamp arrays, so memory cannot grow
        # without limit even under header/path rotation.
        prior_window, prior_count = _RATE_LIMIT_BUCKETS.get(digest, (window, 0))
        count = prior_count + 1 if prior_window == window else 1
        _RATE_LIMIT_BUCKETS[digest] = (window, count)
        if len(_RATE_LIMIT_BUCKETS) > 10_000:
            stale = [key for key, (key_window, _) in _RATE_LIMIT_BUCKETS.items() if key_window < window]
            for key in stale:
                _RATE_LIMIT_BUCKETS.pop(key, None)
            while len(_RATE_LIMIT_BUCKETS) > 10_000:
                _RATE_LIMIT_BUCKETS.pop(next(iter(_RATE_LIMIT_BUCKETS)))
    if count > settings.RATE_LIMIT_PER_MINUTE:
        return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    if settings.ENVIRONMENT.lower() in {"production", "prod"}:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(scans.router, prefix=settings.API_V1_PREFIX)
app.include_router(verticals.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(recovery.router, prefix=settings.API_V1_PREFIX)
app.include_router(family.router, prefix=settings.API_V1_PREFIX)
app.include_router(education.router, prefix=settings.API_V1_PREFIX)
app.include_router(identity.router, prefix=settings.API_V1_PREFIX)
app.include_router(coach.router, prefix=settings.API_V1_PREFIX)
app.include_router(community.router, prefix=settings.API_V1_PREFIX)
app.include_router(phone_reputation.router, prefix=settings.API_V1_PREFIX)
app.include_router(url_reputation.router, prefix=settings.API_V1_PREFIX)
app.include_router(developer.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)
app.include_router(billing.router, prefix=settings.API_V1_PREFIX)
app.include_router(message_filter.router, prefix=settings.API_V1_PREFIX)
app.include_router(monitoring.router, prefix=settings.API_V1_PREFIX)


@app.get("/.well-known/apple-app-site-association", tags=["system"], include_in_schema=False)
def apple_app_site_association():
    # Required for the messagefilter associated domain: iOS verifies this file
    # before it will send deferred SMS queries to /api/v1/message-filter.
    return {
        "applinks": {
            "details": [
                {
                    "appIDs": ["PH4AKDQ4Q7.com.shieldai.app"],
                    "components": [{"/": "/google-auth", "comment": "PKCE OAuth return"}],
                }
            ]
        },
        "messagefilter": {"apps": ["PH4AKDQ4Q7.com.shieldai.app.messagefilter"]},
    }


@app.get("/.well-known/assetlinks.json", tags=["system"], include_in_schema=False)
def android_asset_links():
    """Android App Links proof for the PKCE OAuth return URL."""
    return [
        {
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "android_app",
                "package_name": "com.shieldai.app",
                "sha256_cert_fingerprints": settings.ANDROID_APP_SHA256_CERT_FINGERPRINTS,
            },
        }
    ]


@app.get("/google-auth", tags=["system"], include_in_schema=False)
def google_auth_landing():
    from fastapi.responses import HTMLResponse

    return HTMLResponse(
        "<!doctype html><meta name=viewport content='width=device-width'>"
        "<title>Return to Shield AI</title>"
        "<main style='font:16px system-ui;max-width:32rem;margin:15vh auto;padding:2rem'>"
        "<h1>Return to Shield AI</h1><p>Open the Shield AI app to finish signing in. "
        "This one-time code cannot be used without the app's security verifier.</p></main>"
    )


_HEALTH_CACHE_SECONDS = 5.0
_health_db_ok: bool = True
_health_checked_at: float = 0.0


@app.get("/health", tags=["system"])
def health():
    global _health_db_ok, _health_checked_at
    # /health is deliberately excluded from production_rate_limit above so
    # load balancers/uptime monitors can hit it freely — but that also means
    # an unauthenticated caller can hit it freely. Cache the DB probe for a
    # few seconds so rapid/concurrent hits collapse into one real connection
    # checkout instead of each one drawing from the pool.
    now = monotonic()
    if now - _health_checked_at >= _HEALTH_CACHE_SECONDS:
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
                if settings.ENVIRONMENT.lower() in {"production", "prod"}:
                    deployed = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
                    from alembic.config import Config
                    from alembic.script import ScriptDirectory

                    expected = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
                    if deployed != expected:
                        raise RuntimeError(f"schema revision {deployed!r} does not match {expected!r}")
            _health_db_ok = True
        except Exception:
            _health_db_ok = False
        _health_checked_at = now

    if not _health_db_ok:
        return JSONResponse(status_code=503, content={"status": "unavailable", "app": settings.APP_NAME, "version": "0.6.0"})
    return {"status": "ok", "app": settings.APP_NAME, "version": "0.6.0"}


@app.get("/", tags=["system"])
def root():
    return {"message": "Shield AI API. Before you click. Before you pay. Before you trust.", "docs": "/docs"}
