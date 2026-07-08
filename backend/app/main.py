"""Shield AI — FastAPI application entrypoint."""
from contextlib import asynccontextmanager
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import admin, auth, billing, community, developer, education, family, identity, message_filter, monitoring, notifications, phone_reputation, recovery, scans, url_reputation, verticals
from app.core.config import settings, validate_runtime_settings

_RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}


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
)

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
    ip = (forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown"))
    key = f"{ip}:{request.url.path.split('/')[1:4]}"
    now = monotonic()
    window_start = now - 60
    bucket = [ts for ts in _RATE_LIMIT_BUCKETS.get(key, []) if ts >= window_start]
    if len(bucket) >= settings.RATE_LIMIT_PER_MINUTE:
        return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
    bucket.append(now)
    _RATE_LIMIT_BUCKETS[key] = bucket
    return await call_next(request)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(scans.router, prefix=settings.API_V1_PREFIX)
app.include_router(verticals.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(recovery.router, prefix=settings.API_V1_PREFIX)
app.include_router(family.router, prefix=settings.API_V1_PREFIX)
app.include_router(education.router, prefix=settings.API_V1_PREFIX)
app.include_router(identity.router, prefix=settings.API_V1_PREFIX)
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
        "messagefilter": {"apps": ["PH4AKDQ4Q7.com.shieldai.app.messagefilter"]},
    }


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": "0.6.0"}


@app.get("/", tags=["system"])
def root():
    return {"message": "Shield AI API. Before you click. Before you pay. Before you trust.", "docs": "/docs"}
