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
    locale: Mapped[str] = mapped_column(String, default="en")
    simple_language_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    large_text_mode: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="profile")


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


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
