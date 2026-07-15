"""Phase 1–5 SQLAlchemy models."""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ScanType(str, enum.Enum):
    link = "link"
    image = "image"
    qr = "qr"
    message = "message"
    email = "email"
    phone = "phone"
    marketplace = "marketplace"
    social = "social"
    vertical = "vertical"
    voice = "voice"


class ScanStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class RiskLevel(str, enum.Enum):
    safe = "safe"
    low = "low"
    suspicious = "suspicious"
    high = "high"
    critical = "critical"


class IncidentType(str, enum.Enum):
    bank_transfer = "bank_transfer"
    gift_card = "gift_card"
    crypto = "crypto"
    marketplace = "marketplace"
    account_takeover = "account_takeover"
    romance = "romance"
    investment = "investment"
    other = "other"


class IncidentStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    premium_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rc_product_id: Mapped[str | None] = mapped_column(String, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_developer: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False)
    scans: Mapped[list["ScanHistory"]] = relationship(back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str] = mapped_column(String, default="")
    avatar_url: Mapped[str] = mapped_column(String, default="")
    locale: Mapped[str] = mapped_column(String, default="en")
    simple_language_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    large_text_mode: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="profile")


class AvatarImage(Base):
    """User avatar bytes, kept in their own table so the (frequently loaded)
    user/profile rows stay lean — the image is only read by the serve endpoint."""

    __tablename__ = "avatar_images"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False, default="image/jpeg")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class SocialIdentity(Base):
    __tablename__ = "social_identities"
    __table_args__ = (
        UniqueConstraint("provider", "subject", name="uq_social_identities_provider_subject"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String, default="")
    push_token: Mapped[str] = mapped_column(String, default="")
    label: Mapped[str] = mapped_column(String, default="")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    user_agent: Mapped[str] = mapped_column(String, default="")
    ip_address: Mapped[str] = mapped_column(String, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    proactive_monitoring: Mapped[bool] = mapped_column(Boolean, default=True)
    quiet_hours_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    quiet_hours_start: Mapped[str] = mapped_column(String, default="22:00")
    quiet_hours_end: Mapped[str] = mapped_column(String, default="07:00")
    minimum_severity: Mapped[str] = mapped_column(String, default="suspicious")
    topics: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PrivacyPreference(Base):
    __tablename__ = "privacy_preferences"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    require_device_unlock: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    scan_type: Mapped[ScanType] = mapped_column(Enum(ScanType))
    status: Mapped[ScanStatus] = mapped_column(Enum(ScanStatus), default=ScanStatus.pending)
    raw_input: Mapped[str] = mapped_column(Text, default="")
    vertical_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="scans")
    report: Mapped["RiskReport"] = relationship(back_populates="scan", uselist=False)


class RiskReport(Base):
    __tablename__ = "risk_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), unique=True, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.safe)
    threat_category: Mapped[str] = mapped_column(String, default="unknown")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    explanation: Mapped[str] = mapped_column(Text, default="")
    red_flags: Mapped[list] = mapped_column(JSON, default=list)
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    user_feedback: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    scan: Mapped[ScanHistory] = relationship(back_populates="report")


class ScanFeedbackDetail(Base):
    __tablename__ = "scan_feedback_details"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    feedback: Mapped[str] = mapped_column(String)
    reason: Mapped[str] = mapped_column(Text, default="")
    corrected_context: Mapped[str] = mapped_column(Text, default="")
    evidence: Mapped[str] = mapped_column(Text, default="")
    review_status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class LinkScan(Base):
    __tablename__ = "link_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    original_url: Mapped[str] = mapped_column(Text)
    final_url: Mapped[str] = mapped_column(Text, default="")
    domain: Mapped[str] = mapped_column(String, default="")
    domain_age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    redirect_count: Mapped[int] = mapped_column(Integer, default=0)
    safe_browsing_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    enrichment: Mapped[dict] = mapped_column(JSON, default=dict)


class ImageScan(Base):
    __tablename__ = "image_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    storage_key: Mapped[str] = mapped_column(String, default="")
    ocr_text: Mapped[str] = mapped_column(Text, default="")
    detected_brands: Mapped[list] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class ApiUsage(Base):
    __tablename__ = "api_usage"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String)
    units: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# ---------------------------------------------------------------------------
# Phase 2
# ---------------------------------------------------------------------------

class QRScan(Base):
    __tablename__ = "qr_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    qr_content: Mapped[str] = mapped_column(Text)
    qr_type: Mapped[str] = mapped_column(String, default="url")
    decoded_url: Mapped[str] = mapped_column(Text, default="")


class MessageScan(Base):
    __tablename__ = "message_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    message_text: Mapped[str] = mapped_column(Text)
    platform_hint: Mapped[str] = mapped_column(String, default="")
    detected_entities: Mapped[dict] = mapped_column(JSON, default=dict)
    extracted_urls: Mapped[list] = mapped_column(JSON, default=list)


class EmailScan(Base):
    __tablename__ = "email_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    sender_email: Mapped[str] = mapped_column(String, default="")
    sender_display_name: Mapped[str] = mapped_column(String, default="")
    reply_to_email: Mapped[str] = mapped_column(String, default="")
    subject: Mapped[str] = mapped_column(String, default="")
    body_text: Mapped[str] = mapped_column(Text, default="")
    extracted_urls: Mapped[list] = mapped_column(JSON, default=list)
    header_flags: Mapped[dict] = mapped_column(JSON, default=dict)


class PhoneScan(Base):
    __tablename__ = "phone_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    phone_number: Mapped[str] = mapped_column(String)
    normalized_number: Mapped[str] = mapped_column(String, default="", index=True)
    country_code: Mapped[str] = mapped_column(String, default="")
    carrier: Mapped[str] = mapped_column(String, default="")
    line_type: Mapped[str] = mapped_column(String, default="")


class MarketplaceScan(Base):
    __tablename__ = "marketplace_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    content_text: Mapped[str] = mapped_column(Text, default="")
    platform: Mapped[str] = mapped_column(String, default="")
    detected_signals: Mapped[dict] = mapped_column(JSON, default=dict)
    extracted_urls: Mapped[list] = mapped_column(JSON, default=list)


class SocialScan(Base):
    __tablename__ = "social_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    content_text: Mapped[str] = mapped_column(Text, default="")
    platform: Mapped[str] = mapped_column(String, default="")
    detected_signals: Mapped[dict] = mapped_column(JSON, default=dict)
    extracted_urls: Mapped[list] = mapped_column(JSON, default=list)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text, default="")
    scan_id: Mapped[str | None] = mapped_column(ForeignKey("scan_history.id"), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# ---------------------------------------------------------------------------
# Phase 3 — identity protection
# ---------------------------------------------------------------------------

class BreachRecord(Base):
    """Cached HaveIBeenPwned result per email (24-hour TTL)."""
    __tablename__ = "breach_records"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    email: Mapped[str] = mapped_column(String, index=True)
    breach_count: Mapped[int] = mapped_column(Integer, default=0)
    severity: Mapped[str] = mapped_column(String, default="none")
    breaches: Mapped[list] = mapped_column(JSON, default=list)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class IdentityAlert(Base):
    """Ongoing identity-monitoring alert for a user."""
    __tablename__ = "identity_alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    alert_type: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class BrokerOptOut(Base):
    """Per-user progress on removing themselves from a data-broker site."""
    __tablename__ = "broker_opt_outs"
    __table_args__ = (
        UniqueConstraint("user_id", "broker_key", name="uq_broker_opt_out_user_broker"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    broker_key: Mapped[str] = mapped_column(String)
    # not_started -> found (user confirmed a listing) -> requested -> removed
    # or straight to not_listed when they searched and found nothing.
    status: Mapped[str] = mapped_column(String, default="not_started")
    notes: Mapped[str] = mapped_column(Text, default="")
    # The user's own profile URL on the broker site — pasted into the
    # generated opt-out letter and shown when re-verifying a removal.
    listing_url: Mapped[str] = mapped_column(String, default="")
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # When the broker re-check task last alerted about this row, so overdue
    # and re-verify alerts fire once per window instead of daily.
    last_recheck_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class MonitoredIdentity(Base):
    __tablename__ = "monitored_identities"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "value", name="uq_monitored_identity_user_target"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    target_type: Mapped[str] = mapped_column(String)
    value: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class BrowserTelemetryEvent(Base):
    __tablename__ = "browser_telemetry_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    url: Mapped[str] = mapped_column(Text, default="")
    domain: Mapped[str] = mapped_column(String, default="", index=True)
    verdict: Mapped[str] = mapped_column(String, default="")
    action: Mapped[str] = mapped_column(String, default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ExtensionTelemetryEvent(Base):
    __tablename__ = "extension_telemetry_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    extension_type: Mapped[str] = mapped_column(String)
    event_type: Mapped[str] = mapped_column(String)
    counts: Mapped[dict] = mapped_column(JSON, default=dict)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# ---------------------------------------------------------------------------
# Phase 4 — recovery, family, education
# ---------------------------------------------------------------------------

class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    incident_type: Mapped[IncidentType] = mapped_column(Enum(IncidentType))
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), default=IncidentStatus.open)
    title: Mapped[str] = mapped_column(String, default="")
    amount_lost: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String, default="USD")
    notes: Mapped[str] = mapped_column(Text, default="")
    linked_scan_id: Mapped[str | None] = mapped_column(ForeignKey("scan_history.id"), nullable=True)
    steps_completed: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    evidence: Mapped[list["IncidentEvidence"]] = relationship(back_populates="incident")


class IncidentEvidence(Base):
    __tablename__ = "incident_evidence"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    evidence_type: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text, default="")
    label: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    incident: Mapped[Incident] = relationship(back_populates="evidence")


class CasePackShare(Base):
    __tablename__ = "case_pack_shares"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="")
    relationship_label: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class EducationLesson(Base):
    __tablename__ = "education_lessons"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(String, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    threat_category: Mapped[str] = mapped_column(String, default="")
    difficulty: Mapped[str] = mapped_column(String, default="beginner")
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=3)
    quiz_questions: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    progress: Mapped[list["EducationProgress"]] = relationship(back_populates="lesson")


class EducationProgress(Base):
    __tablename__ = "education_progress"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("education_lessons.id"), index=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    quiz_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lesson: Mapped[EducationLesson] = relationship(back_populates="progress")


# ---------------------------------------------------------------------------
# Phase 5 — moat + B2B tables
# ---------------------------------------------------------------------------

class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="")
    key_hash: Mapped[str] = mapped_column(String, unique=True)
    key_prefix: Mapped[str] = mapped_column(String, default="")
    scopes: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CommunityReport(Base):
    __tablename__ = "community_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    scan_id: Mapped[str | None] = mapped_column(ForeignKey("scan_history.id"), nullable=True)
    report_type: Mapped[str] = mapped_column(String)
    artifact_text: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String, default="")
    platform_hint: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="pending")
    analyst_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SeededScamNumber(Base):
    """Known-bad phone numbers from external feeds (e.g. FCC complaint data),
    giving Call Protection a non-empty blocklist before community reports
    reach the corroboration threshold. Numbers are E.164 digits without '+'."""

    __tablename__ = "seeded_scam_numbers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    number: Mapped[str] = mapped_column(String, unique=True, index=True)
    label: Mapped[str] = mapped_column(String, default="Spam Risk")
    source: Mapped[str] = mapped_column(String, default="fcc_complaints")
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PersonalBlockedNumber(Base):
    """A number an individual user chose to block. Merged into that user's
    Call Directory snapshot so it never rings — independent of the community /
    complaint feed. Numbers are E.164 digits without '+'."""

    __tablename__ = "personal_blocked_numbers"
    __table_args__ = (
        UniqueConstraint("user_id", "number", name="uq_personal_block_user_number"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    number: Mapped[str] = mapped_column(String, index=True)
    label: Mapped[str] = mapped_column(String, default="Blocked")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SeededScamDomain(Base):
    """Known phishing/malware hostnames from external feeds (OpenPhish,
    URLhaus), giving the Safari extension a non-empty blocklist before
    community link scans accumulate. Lowercase hostnames."""

    __tablename__ = "seeded_scam_domains"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    domain: Mapped[str] = mapped_column(String, unique=True, index=True)
    source: Mapped[str] = mapped_column(String, default="phishing_feeds")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ScamPattern(Base):
    __tablename__ = "scam_patterns"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    pattern_type: Mapped[str] = mapped_column(String, default="regex")
    artifact_types: Mapped[list] = mapped_column(JSON, default=list)
    pattern_data: Mapped[dict] = mapped_column(JSON, default=dict)
    risk_score_boost: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String, default="unknown")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String, default="analyst")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
