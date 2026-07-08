"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    APP_NAME: str = "Shield AI"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # --- Security / JWT ---
    SECRET_KEY: str = Field(default="CHANGE_ME_IN_PRODUCTION")
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
    CORS_ORIGINS: List[str] = ["*"]

    # --- Third-party detection APIs ---
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_SAFE_BROWSING_KEY: str = ""
    VIRUSTOTAL_API_KEY: str = ""
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = "https://api.shieldai.rushingtechnologies.com/api/v1/auth/google/callback"
    MOBILE_GOOGLE_AUTH_RETURN_URI: str = "shieldai://google-auth"
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

    # --- Phone reputation / CallKit Call Directory sync ---
    # Minimum number of distinct users who must have scanned a phone number as
    # high/critical risk before it's surfaced in the shared call-blocking feed.
    # Guards against one user's report getting a legitimate number blocked app-wide.
    PHONE_BLOCKLIST_MIN_REPORTERS: int = 3

    # --- Limits ---
    MAX_UPLOAD_MB: int = 10

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
    if settings.SECRET_KEY == "CHANGE_ME_IN_PRODUCTION" or len(settings.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must be set to a strong production value.")
    if "*" in settings.CORS_ORIGINS:
        raise RuntimeError("CORS_ORIGINS must not include '*' in production.")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
