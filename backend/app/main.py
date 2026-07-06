"""Shield AI — FastAPI application entrypoint."""
from contextlib import asynccontextmanager
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import admin, auth, billing, community, developer, education, family, identity, message_filter, monitoring, notifications, phone_reputation, recovery, scans, url_reputation, verticals
from app.core.config import settings, validate_runtime_settings

_RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_settings()
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
