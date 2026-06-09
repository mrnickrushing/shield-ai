"""Pydantic request/response schemas for Phase 1."""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    simple_language_mode: bool | None = None


class UserOut(BaseModel):
    id: str
    email: EmailStr
    is_premium: bool
    display_name: str = ""

    class Config:
        from_attributes = True


# --- Scans ---
class LinkScanCreate(BaseModel):
    url: str


class ImageScanCreate(BaseModel):
    # base64-encoded image; in production this is a multipart upload / signed URL.
    image_base64: str
    filename: str = "screenshot.png"


class RiskReportOut(BaseModel):
    risk_score: int
    risk_level: str
    threat_category: str
    confidence: float
    explanation: str
    red_flags: list[str]
    recommended_actions: list[str]
    evidence: dict

    class Config:
        from_attributes = True


class ScanOut(BaseModel):
    id: str
    scan_type: str
    status: str
    raw_input: str
    created_at: datetime
    completed_at: datetime | None = None
    report: RiskReportOut | None = None

    class Config:
        from_attributes = True


class ScanFeedback(BaseModel):
    feedback: str = Field(pattern="^(helpful|false_positive)$")
