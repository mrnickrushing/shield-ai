"""Notification delivery policy and push transport.

This is the single enforcement point for user alert preferences. In-app
notifications are still persisted by the caller, but push delivery, quiet
hours, topic filters, and severity thresholds all flow through this module.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import datetime, time, timezone
from email.message import EmailMessage
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Device, NotificationPreference, User

log = logging.getLogger(__name__)

SEVERITY_RANK = {"safe": 0, "low": 1, "suspicious": 2, "high": 3, "critical": 4}
DEFAULT_TOPICS = {
    "breach": True,
    "impersonation": True,
    "account": True,
    "family": True,
    "community": False,
}


def preferences_for(db: Session, user_id: str) -> NotificationPreference | None:
    return db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()


def topic_enabled(pref: NotificationPreference | None, topic: str) -> bool:
    topics = {**DEFAULT_TOPICS, **((pref.topics or {}) if pref else {})}
    return bool(topics.get(topic, True))


def severity_allowed(pref: NotificationPreference | None, severity: str) -> bool:
    minimum = (pref.minimum_severity if pref else "all") or "all"
    if minimum == "all":
        return True
    return SEVERITY_RANK.get(severity, 0) >= SEVERITY_RANK.get(minimum, 0)


def _parse_hhmm(value: str) -> time | None:
    try:
        hour, minute = value.split(":", 1)
        return time(hour=int(hour), minute=int(minute))
    except Exception:
        return None


def quiet_hours_active(pref: NotificationPreference | None, now: datetime | None = None) -> bool:
    if not pref or not pref.quiet_hours_enabled:
        return False
    start = _parse_hhmm(pref.quiet_hours_start or "")
    end = _parse_hhmm(pref.quiet_hours_end or "")
    if not start or not end:
        return False
    current = (now or datetime.now(timezone.utc)).time()
    if start == end:
        return False
    if start < end:
        return start <= current < end
    return current >= start or current < end


def should_deliver(
    db: Session,
    user_id: str,
    severity: str,
    topic: str,
    channel: str,
    *,
    respect_quiet_hours: bool = True,
    now: datetime | None = None,
) -> bool:
    pref = preferences_for(db, user_id)
    if channel == "push" and pref and not pref.push_enabled:
        return False
    if channel == "email" and pref and not pref.email_enabled:
        return False
    if not topic_enabled(pref, topic):
        return False
    if not severity_allowed(pref, severity):
        return False
    if (
        channel in {"push", "email"}
        and respect_quiet_hours
        and severity != "critical"
        and quiet_hours_active(pref, now)
    ):
        return False
    return True


def send_push_to_devices(
    db: Session,
    user_id: str,
    title: str,
    body: str,
    *,
    severity: str = "suspicious",
    topic: str = "account",
    data: dict[str, Any] | None = None,
    respect_quiet_hours: bool = True,
) -> int:
    """Best-effort Expo push delivery. Returns the number of target tokens.

    Exceptions are swallowed and logged so alert creation never fails because
    Apple/Expo/network delivery is temporarily unavailable.
    """
    if not should_deliver(
        db,
        user_id,
        severity,
        topic,
        "push",
        respect_quiet_hours=respect_quiet_hours,
    ):
        return 0

    tokens = [
        d.push_token
        for d in db.query(Device).filter(Device.user_id == user_id, Device.revoked_at.is_(None)).all()
        if d.push_token
    ]
    if not tokens:
        return 0

    try:
        import httpx

        messages = [
            {
                "to": token,
                "title": title,
                "body": body[:180],
                "data": data or {},
                "sound": "default" if severity in ("high", "critical") else None,
            }
            for token in tokens
        ]
        headers = {"Content-Type": "application/json"}
        if settings.EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"

        httpx.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers=headers,
            timeout=settings.ALERT_DELIVERY_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        log.warning("push delivery failed for user %s: %s", user_id, exc)
    return len(tokens)


def send_email_alert(
    db: Session,
    user_id: str,
    subject: str,
    body: str,
    *,
    severity: str = "suspicious",
    topic: str = "account",
) -> bool:
    """Best-effort transactional email alert when SMTP is configured."""
    if not settings.SMTP_HOST:
        return False
    if not should_deliver(db, user_id, severity, topic, "email"):
        return False
    user = db.get(User, user_id)
    if not user or not user.email:
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = user.email
        msg.set_content(
            "\n".join(
                [
                    body,
                    "",
                    "Open Shield AI to review the full alert and recommended next steps.",
                    "You can change alert topics, severity, and quiet hours in Notification settings.",
                ]
            )
        )
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.ALERT_DELIVERY_TIMEOUT_SECONDS) as smtp:
            smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        log.warning("email delivery failed for user %s: %s", user_id, exc)
        return False
