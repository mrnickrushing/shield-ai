"""Phase 1 + Phase 2 SQLAlchemy models.

Phase 1 tables: users, profiles, devices, scan_history, risk_reports,
image_scans, link_scans, api_usage, audit_logs.

Phase 2 tables: qr_scans, message_scans, email_scans, phone_scans,
notifications.
"""
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


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
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

    user: Mapped[User] = relationship(back_populates="profile")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String, default="")  # ios | android
    push_token: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    scan_type: Mapped[ScanType] = mapped_column(Enum(ScanType))
    status: Mapped[ScanStatus] = mapped_column(Enum(ScanStatus), default=ScanStatus.pending)
    raw_input: Mapped[str] = mapped_column(Text, default="")  # url or extracted text
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="scans")
    report: Mapped["RiskReport"] = relationship(back_populates="scan", uselist=False)


class RiskReport(Base):
    __tablename__ = "risk_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), unique=True, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.safe)
    threat_category: Mapped[str] = mapped_column(String, default="unknown")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)  # 0-1
    explanation: Mapped[str] = mapped_column(Text, default="")
    red_flags: Mapped[list] = mapped_column(JSON, default=list)
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)  # deterministic signals
    user_feedback: Mapped[str | None] = mapped_column(String, nullable=True)  # helpful | false_positive
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
    provider: Mapped[str] = mapped_column(String)  # openai | safe_browsing | virustotal
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
# Phase 2 — artifact detail tables
# ---------------------------------------------------------------------------

class QRScan(Base):
    __tablename__ = "qr_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    qr_content: Mapped[str] = mapped_column(Text)
    qr_type: Mapped[str] = mapped_column(String, default="url")  # url | text | phone | wifi | other
    decoded_url: Mapped[str] = mapped_column(Text, default="")


class MessageScan(Base):
    __tablename__ = "message_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_history.id"), index=True)
    message_text: Mapped[str] = mapped_column(Text)
    platform_hint: Mapped[str] = mapped_column(String, default="")  # sms | whatsapp | imessage | ""
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
    normalized_number: Mapped[str] = mapped_column(String, default="")
    country_code: Mapped[str] = mapped_column(String, default="")
    carrier: Mapped[str] = mapped_column(String, default="")
    line_type: Mapped[str] = mapped_column(String, default="")  # mobile | landline | voip


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text, default="")
    scan_id: Mapped[str | None] = mapped_column(ForeignKey("scan_history.id"), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
