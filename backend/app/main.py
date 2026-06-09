"""Shield AI — FastAPI application entrypoint (Phase 1)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, scans
from app.core.config import settings
from app.db.session import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 1: create any missing tables on startup. Future phases move this
    # to Alembic migrations. create_all is a no-op for tables that exist.
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # don't block startup/health if DB is briefly unready
        print(f"[startup] table creation skipped: {exc}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
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


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": "0.1.0"}


@app.get("/", tags=["system"])
def root():
    return {
        "message": "Shield AI API. Before you click. Before you pay. Before you trust.",
        "docs": "/docs",
    }
