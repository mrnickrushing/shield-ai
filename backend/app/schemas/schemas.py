"""Pydantic request/response schemas for Phase 1 + Phase 2 + Phase 4."""
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
    large_text_mode: bool | None = None


class UserOut(BaseModel):
    id: str
    email: EmailStr
    is_premium: bool
    display_name: str = ""
    simple_language_mode: bool = False
    large_text_mode: bool = False

    class Config:
        from_attributes = True


# --- Scans ---
class LinkScanCreate(BaseModel):
    url: str


class ImageScanCreate(BaseModel):
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


# Phase 2
class QRScanCreate(BaseModel):
    qr_content: str


class MessageScanCreate(BaseModel):
    message_text: str
    platform_hint: str = ""


class EmailScanCreate(BaseModel):
    raw_email: str | None = None
    sender_email: str | None = None
    sender_display_name: str | None = None
    reply_to_email: str | None = None
    subject: str | None = None
    body_text: str | None = None


class PhoneScanCreate(BaseModel):
    phone_number: str


class DeviceRegister(BaseModel):
    push_token: str
    platform: str = Field(pattern="^(ios|android)$")


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    scan_id: str | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Phase 4 — recovery, family, education
# ---------------------------------------------------------------------------

class IncidentCreate(BaseModel):
    incident_type: str
    title: str = ""
    amount_lost: float | None = None
    currency: str = "USD"
    notes: str = ""
    linked_scan_id: str | None = None


class IncidentUpdate(BaseModel):
    status: str | None = None
    title: str | None = None
    amount_lost: float | None = None
    notes: str | None = None
    steps_completed: list[str] | None = None


class IncidentOut(BaseModel):
    id: str
    incident_type: str
    status: str
    title: str
    amount_lost: float | None = None
    currency: str
    notes: str
    linked_scan_id: str | None = None
    steps_completed: list = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IncidentEvidenceCreate(BaseModel):
    evidence_type: str
    content: str
    label: str = ""


class TrustedContactCreate(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    relationship_label: str = ""


class TrustedContactOut(BaseModel):
    id: str
    name: str
    phone: str
    email: str
    relationship_label: str
    created_at: datetime

    class Config:
        from_attributes = True


class LessonOut(BaseModel):
    id: str
    slug: str
    title: str
    summary: str
    content: str
    threat_category: str
    difficulty: str
    estimated_minutes: int
    quiz_questions: list
    created_at: datetime

    class Config:
        from_attributes = True


class QuizSubmit(BaseModel):
    answers: list[int] = []
