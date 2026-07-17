"""Notification delivery policy and push transport.

This is the single enforcement point for user alert preferences. In-app
notifications are still persisted by the caller, but push delivery, quiet
hours, topic filters, and severity thresholds all flow through this module.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import datetime, time, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Device, NotificationPreference, PushReceipt, User

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
    """Best-effort Expo push delivery. Returns the accepted ticket count.

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

    devices = [
        device
        for device in db.query(Device).filter(Device.user_id == user_id, Device.revoked_at.is_(None)).all()
        if device.push_token
    ]
    if not devices:
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
            for token in (device.push_token for device in devices)
        ]
        headers = {"Content-Type": "application/json"}
        if settings.EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"

        response = httpx.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers=headers,
            timeout=settings.ALERT_DELIVERY_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        tickets = payload.get("data", []) if isinstance(payload, dict) else []
        if isinstance(tickets, dict):
            tickets = [tickets]
        delivered = 0
        changed = False
        for device, ticket in zip(devices, tickets):
            if isinstance(ticket, dict) and ticket.get("status") == "ok":
                delivered += 1
                ticket_id = ticket.get("id")
                if ticket_id:
                    db.add(PushReceipt(user_id=user_id, device_id=device.id, ticket_id=str(ticket_id)))
                    changed = True
                continue
            error_code = ((ticket or {}).get("details") or {}).get("error") if isinstance(ticket, dict) else None
            if error_code == "DeviceNotRegistered":
                device.revoked_at = datetime.now(timezone.utc)
                changed = True
            log.warning(
                "Expo rejected push for user %s (%s): %s",
                user_id,
                error_code or "unknown",
                (ticket or {}).get("message", "missing ticket") if isinstance(ticket, dict) else "missing ticket",
            )
        if changed:
            db.commit()
        return delivered
    except Exception as exc:
        log.warning("push delivery failed for user %s: %s", user_id, exc)
    return 0


def check_pending_push_receipts(db: Session, *, limit: int = 1000) -> dict[str, int]:
    """Resolve accepted Expo tickets and retire invalid device tokens."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=1)
    pending = (
        db.query(PushReceipt)
        .filter(PushReceipt.status == "pending", PushReceipt.created_at <= cutoff)
        .order_by(PushReceipt.created_at.asc())
        .limit(limit)
        .all()
    )
    if not pending:
        return {"checked": 0, "delivered": 0, "failed": 0, "pending": 0}

    try:
        import httpx

        headers = {"Content-Type": "application/json"}
        if settings.EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
        response = httpx.post(
            "https://exp.host/--/api/v2/push/getReceipts",
            json={"ids": [row.ticket_id for row in pending]},
            headers=headers,
            timeout=settings.ALERT_DELIVERY_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        receipts = payload.get("data", {}) if isinstance(payload, dict) else {}
        if not isinstance(receipts, dict):
            raise ValueError("Expo receipt response was not an object")
    except Exception as exc:
        log.warning("push receipt lookup failed: %s", exc)
        return {"checked": 0, "delivered": 0, "failed": 0, "pending": len(pending)}

    now = datetime.now(timezone.utc)
    counts = {"checked": 0, "delivered": 0, "failed": 0, "pending": 0}
    for row in pending:
        receipt = receipts.get(row.ticket_id)
        row.attempts += 1
        row.checked_at = now
        if not isinstance(receipt, dict):
            if row.attempts >= 8:
                row.status = "expired"
                row.last_error = "Receipt was not available after eight checks"
                counts["failed"] += 1
            else:
                counts["pending"] += 1
            continue

        counts["checked"] += 1
        if receipt.get("status") == "ok":
            row.status = "delivered"
            counts["delivered"] += 1
            continue

        error_code = str((receipt.get("details") or {}).get("error") or "unknown")
        row.status = "failed"
        row.last_error = f"{error_code}: {receipt.get('message', '')}"[:1000]
        counts["failed"] += 1
        if error_code == "DeviceNotRegistered":
            device = db.get(Device, row.device_id)
            if device and device.user_id == row.user_id:
                device.revoked_at = now

    db.commit()
    return counts


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
