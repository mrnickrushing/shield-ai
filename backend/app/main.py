"""Shield AI — FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, auth, community, developer, education, family, identity, notifications, recovery, scans
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.5.0",
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

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(scans.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(recovery.router, prefix=settings.API_V1_PREFIX)
app.include_router(family.router, prefix=settings.API_V1_PREFIX)
app.include_router(education.router, prefix=settings.API_V1_PREFIX)
app.include_router(identity.router, prefix=settings.API_V1_PREFIX)
app.include_router(community.router, prefix=settings.API_V1_PREFIX)
app.include_router(developer.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": "0.5.0"}


@app.get("/", tags=["system"])
def root():
    return {"message": "Shield AI API. Before you click. Before you pay. Before you trust.", "docs": "/docs"}
