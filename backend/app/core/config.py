"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "CHANGE_ME_IN_PRODUCTION_USE_AT_LEAST_32_BYTES"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    APP_NAME: str = "Shield AI"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # --- Security / JWT ---
    SECRET_KEY: str = Field(default=DEFAULT_SECRET_KEY)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- Database ---
    DATABASE_URL: str = "postgresql+psycopg://shield:shield@localhost:5432/shield_ai"

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # --- CORS ---
    CORS_ORIGINS: List[str] = [
        "https://shieldai.rushingtechnologies.com",
        "https://www.shieldai.rushingtechnologies.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # --- Third-party detection APIs ---
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_SAFE_BROWSING_KEY: str = ""
    VIRUSTOTAL_API_KEY: str = ""
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = "https://api.shieldai.rushingtechnologies.com/api/v1/auth/google/callback"
    MOBILE_GOOGLE_AUTH_RETURN_URI: str = "https://api.shieldai.rushingtechnologies.com/google-auth"
    APPLE_CLIENT_ID: str = "com.shieldai.app"
    ANDROID_APP_SHA256_CERT_FINGERPRINTS: List[str] = []
    REVENUECAT_WEBHOOK_SECRET: str = ""  # Authorization header value RevenueCat sends to /billing/revenuecat-webhook

    # --- Phase 2 optional APIs ---
    NUMVERIFY_API_KEY: str = ""    # apilayer.net phone lookup
    EXPO_ACCESS_TOKEN: str = ""    # Expo push notification service
    ALERT_DELIVERY_TIMEOUT_SECONDS: float = 5.0

    # --- Optional email alert delivery ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "alerts@shieldai.app"

    # --- Phase 3 optional APIs ---
    HIBP_API_KEY: str = ""         # HaveIBeenPwned v3 breach lookup

    # --- Profile avatars ---
    # Avatars are stored in the app database and served back by the API, so the
    # only config needed is the public base URL of this API (used to build the
    # absolute avatar_url the mobile app loads).
    PUBLIC_API_BASE_URL: str = "https://api.shieldai.rushingtechnologies.com"
    AVATAR_MAX_MB: int = 5

    # --- Phone reputation / CallKit Call Directory sync ---
    # Minimum number of distinct users who must have scanned a phone number as
    # high/critical risk before it's surfaced in the shared call-blocking feed.
    # Guards against one user's report getting a legitimate number blocked app-wide.
    PHONE_BLOCKLIST_MIN_REPORTERS: int = 3
    URL_BLOCKLIST_MIN_REPORTERS: int = 3

    # --- Limits ---
    MAX_UPLOAD_MB: int = 10
    # Fair-use ceiling on scans per rolling 24h for an active subscriber (or
    # trial). "Unlimited" for any real user; stops scripted abuse from running
    # up the Anthropic bill. 0 disables the cap.
    PREMIUM_DAILY_SCAN_LIMIT: int = 75
    # How long an identical-input LLM verdict is reused before re-charging for a
    # fresh call. 0 disables the dedupe cache.
    LLM_CACHE_TTL_SECONDS: int = 86400

    # --- Observability ---
    SENTRY_DSN: str = ""  # error reporting is a no-op when unset

    # --- Production safety ---
    STRICT_PRODUCTION_CONFIG: bool = True
    RATE_LIMIT_PER_MINUTE: int = 600


def validate_runtime_settings() -> None:
    """Fail fast when production is running with unsafe development defaults."""
    if settings.ENVIRONMENT.lower() not in {"production", "prod"}:
        return
    if not settings.STRICT_PRODUCTION_CONFIG:
        return
    if settings.SECRET_KEY == DEFAULT_SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must be set to a strong production value.")
    if "*" in settings.CORS_ORIGINS:
        raise RuntimeError("CORS_ORIGINS must not include '*' in production.")
    if not settings.ANDROID_APP_SHA256_CERT_FINGERPRINTS:
        raise RuntimeError("ANDROID_APP_SHA256_CERT_FINGERPRINTS must be set for verified OAuth app links.")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
