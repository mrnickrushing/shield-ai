"""Pydantic request/response schemas for Phase 1 + Phase 2 + Phase 4."""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


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


class SocialAuthRequest(BaseModel):
    provider: str = Field(pattern="^(apple|google)$")
    token: str
    email: str | None = None
    display_name: str | None = None


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
    vertical_key: str | None = None
    status: str
    raw_input: str
    created_at: datetime
    completed_at: datetime | None = None
    report: RiskReportOut | None = None

    class Config:
        from_attributes = True


class ScanFeedback(BaseModel):
    feedback: str = Field(pattern="^(helpful|false_positive)$")


class ScanFeedbackDetailCreate(BaseModel):
    feedback: str = Field(pattern="^(helpful|false_positive|missed_scam)$")
    reason: str = Field(default="", max_length=4000)
    corrected_context: str = Field(default="", max_length=12000)
    evidence: str = Field(default="", max_length=12000)


class ScanFeedbackDetailOut(BaseModel):
    id: str
    scan_id: str
    feedback: str
    reason: str
    corrected_context: str
    evidence: str
    review_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class QRScanCreate(BaseModel):
    qr_content: str


class MessageScanCreate(BaseModel):
    message_text: str
    platform_hint: str = ""


class VoiceScanCreate(BaseModel):
    transcript: str
    caller_number: str = ""


class EmailScanCreate(BaseModel):
    raw_email: str | None = None
    sender_email: str | None = None
    sender_display_name: str | None = None
    reply_to_email: str | None = None
    subject: str | None = None
    body_text: str | None = None


class PhoneScanCreate(BaseModel):
    phone_number: str


class MarketplaceScanCreate(BaseModel):
    content_text: str
    platform_hint: str = ""


class SocialScanCreate(BaseModel):
    content_text: str
    platform: str = ""


class DeviceRegister(BaseModel):
    push_token: str
    platform: str = Field(pattern="^(ios|android)$")
    label: str = ""


class DeviceOut(BaseModel):
    id: str
    platform: str
    label: str = ""
    push_token: str
    created_at: datetime
    last_seen_at: datetime | None = None
    revoked_at: datetime | None = None

    class Config:
        from_attributes = True


class AuthSessionOut(BaseModel):
    id: str
    user_agent: str
    ip_address: str
    is_active: bool
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None

    class Config:
        from_attributes = True


class NotificationPreferenceIn(BaseModel):
    push_enabled: bool = True
    email_enabled: bool = False
    proactive_monitoring: bool = True
    quiet_hours_enabled: bool = True
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "07:00"
    minimum_severity: str = Field(default="suspicious", pattern="^(all|low|suspicious|high|critical)$")
    topics: dict = {}


class NotificationPreferenceOut(NotificationPreferenceIn):
    updated_at: datetime

    class Config:
        from_attributes = True


class PrivacyPreferenceIn(BaseModel):
    retention_days: int | None = Field(default=90, ge=1, le=3650)
    require_device_unlock: bool = False


class PrivacyPreferenceOut(PrivacyPreferenceIn):
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Verticals — portfolio apps on the shared Verdict Engine
# ---------------------------------------------------------------------------

class VerticalScanRequest(BaseModel):
    input: str = Field(default="", max_length=20000)
    file_base64: str | None = None  # photo or PDF of a document (verticals that accept files)
    context: dict = {}

    @model_validator(mode="after")
    def _require_input_or_file(self):
        if not (self.input.strip() or self.file_base64):
            raise ValueError("Provide either input text or a file.")
        return self


class VerticalInfo(BaseModel):
    key: str
    name: str
    tagline: str
    accent: str
    icon: str
    input_label: str
    input_placeholder: str
    input_multiline: bool
    accepts_files: bool = False


class VerdictOut(BaseModel):
    vertical: str
    vertical_name: str
    risk_score: int
    risk_level: str
    threat_category: str
    confidence: float
    explanation: str
    red_flags: list[str]
    recommended_actions: list[str]
    evidence: dict
    output_title: str = ""
    output_artifact: str = ""


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    scan_id: str | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Phase 4
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


# ---------------------------------------------------------------------------
# Phase 3 — identity protection
# ---------------------------------------------------------------------------

class BreachCheckRequest(BaseModel):
    email: str


class BreachInfo(BaseModel):
    name: str
    title: str
    domain: str
    breach_date: str
    pwn_count: int
    data_classes: list[str]
    is_verified: bool


class BreachCheckResult(BaseModel):
    email: str
    breach_count: int
    severity: str
    breaches: list[dict]
    actions: list[str]
    disclaimer: str
    data_available: bool
    checked_at: datetime


class IdentityAlertOut(BaseModel):
    id: str
    alert_type: str
    email: str
    detail: dict
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MonitoredIdentityCreate(BaseModel):
    target_type: str = Field(pattern="^(email|phone|username|domain)$")
    value: str = Field(min_length=3, max_length=255)
    label: str = ""


class MonitoredIdentityOut(BaseModel):
    id: str
    target_type: str
    value: str
    label: str
    is_active: bool
    last_checked_at: datetime | None = None
    last_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class BrowserTelemetryCreate(BaseModel):
    url: str = Field(max_length=4000)
    domain: str = Field(default="", max_length=255)
    verdict: str = Field(default="unverified", max_length=32)
    action: str = Field(default="viewed", pattern="^(viewed|blocked|allowed|trusted|override)$")
    reason: str = Field(default="", max_length=2000)


class ExtensionTelemetryCreate(BaseModel):
    extension_type: str = Field(pattern="^(message_filter|call_directory|widget|share)$")
    event_type: str = Field(max_length=64)
    counts: dict = {}
    detail: dict = {}


# ---------------------------------------------------------------------------
# Phase 5 — moat + B2B
# ---------------------------------------------------------------------------

class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    scopes: list[str] = ["scan:read", "scan:write"]


class ApiKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None

    class Config:
        from_attributes = True


class ApiKeyCreated(ApiKeyOut):
    raw_key: str


class CommunityReportCreate(BaseModel):
    scan_id: str | None = None
    report_type: str = Field(pattern="^(false_positive|missed_scam|new_pattern)$")
    artifact_text: str = ""
    category: str = ""
    platform_hint: str = ""


class CommunityReportOut(BaseModel):
    id: str
    report_type: str
    artifact_text: str
    category: str
    platform_hint: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CommunityReportAdminOut(CommunityReportOut):
    user_id: str | None = None
    scan_id: str | None = None
    analyst_notes: str


class ScamPatternCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = ""
    pattern_type: str = Field(pattern="^(regex|keyword|semantic)$", default="regex")
    artifact_types: list[str] = []
    pattern_data: dict = {}
    risk_score_boost: int = Field(ge=0, le=100, default=0)
    category: str = "unknown"
    source: str = "analyst"


class ScamPatternOut(BaseModel):
    id: str
    name: str
    description: str
    pattern_type: str
    artifact_types: list[str]
    pattern_data: dict
    risk_score_boost: int
    category: str
    is_active: bool
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminStatsOut(BaseModel):
    total_users: int
    total_scans: int
    scans_today: int
    open_community_reports: int
    pending_feedback_reviews: int
    active_scam_patterns: int
    active_api_keys: int


class AdminUserOut(BaseModel):
    id: str
    email: str
    is_premium: bool
    is_admin: bool
    is_developer: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PhoneReputationEntry(BaseModel):
    number: str
    label: str


class PhoneReputationSyncOut(BaseModel):
    version: str
    entries: list[PhoneReputationEntry]
