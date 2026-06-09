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
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    GOOGLE_SAFE_BROWSING_KEY: str = ""
    VIRUSTOTAL_API_KEY: str = ""

    # --- Phase 2 optional APIs ---
    NUMVERIFY_API_KEY: str = ""    # apilayer.net phone lookup
    EXPO_ACCESS_TOKEN: str = ""    # Expo push notification service

    # --- Limits ---
    FREE_TIER_DAILY_SCANS: int = 15
    MAX_UPLOAD_MB: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
