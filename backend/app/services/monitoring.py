"""Real-time monitoring and alert routing."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.models import (
    BrowserTelemetryEvent,
    ExtensionTelemetryEvent,
    IdentityAlert,
    Incident,
    MonitoredIdentity,
    Notification,
    NotificationPreference,
    RiskLevel,
    RiskReport,
    ScanHistory,
)
from app.services import breach_check

SEVERITY_RANK = {"safe": 0, "low": 1, "suspicious": 2, "high": 3, "critical": 4}
DEFAULT_TOPICS = {
    "breach": True,
    "impersonation": True,
    "account": True,
    "family": True,
    "community": False,
}


def normalize_domain(url: str, fallback: str = "") -> str:
    if fallback:
        return fallback.lower().strip()
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def _preferences(db: Session, user_id: str) -> NotificationPreference | None:
    return db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()


def should_notify(db: Session, user_id: str, severity: str, topic: str, channel: str = "push") -> bool:
    pref = _preferences(db, user_id)
    if not pref:
        return True
    if channel == "push" and not pref.push_enabled:
        return False
    if channel == "email" and not pref.email_enabled:
        return False
    topics = {**DEFAULT_TOPICS, **(pref.topics or {})}
    if not topics.get(topic, True):
        return False
    minimum = pref.minimum_severity or "all"
    if minimum != "all" and SEVERITY_RANK.get(severity, 0) < SEVERITY_RANK.get(minimum, 0):
        return False
    return True


def create_alert(
    db: Session,
    user_id: str,
    title: str,
    body: str,
    severity: str = "suspicious",
    topic: str = "account",
    scan_id: str | None = None,
    force_inbox: bool = True,
) -> Notification | None:
    if not force_inbox and not should_notify(db, user_id, severity, topic, "push"):
        return None
    notif = Notification(user_id=user_id, title=title, body=body[:1000], scan_id=scan_id)
    db.add(notif)
    return notif


def record_browser_event(
    db: Session,
    user_id: str,
    url: str,
    verdict: str,
    action: str,
    reason: str = "",
    domain: str = "",
) -> BrowserTelemetryEvent:
    event = BrowserTelemetryEvent(
        user_id=user_id,
        url=url,
        domain=normalize_domain(url, domain),
        verdict=verdict,
        action=action,
        reason=reason,
    )
    db.add(event)
    if verdict in ("high", "critical") or action in ("blocked", "override"):
        create_alert(
            db,
            user_id,
            "Safe Browser risk detected",
            f"{event.domain or url} was {action} with {verdict} risk. {reason}".strip(),
            severity=verdict if verdict in SEVERITY_RANK else "suspicious",
            topic="account",
        )
    return event


def record_extension_event(
    db: Session,
    user_id: str | None,
    extension_type: str,
    event_type: str,
    counts: dict | None = None,
    detail: dict | None = None,
) -> ExtensionTelemetryEvent:
    event = ExtensionTelemetryEvent(
        user_id=user_id,
        extension_type=extension_type,
        event_type=event_type,
        counts=counts or {},
        detail=detail or {},
    )
    db.add(event)
    if user_id and event_type in ("blocked", "high_risk_seen", "sync_failed"):
        create_alert(
            db,
            user_id,
            "Protection extension activity",
            f"{extension_type.replace('_', ' ').title()}: {event_type.replace('_', ' ')}.",
            severity="suspicious",
            topic="account",
        )
    return event


def monitor_identity_target(db: Session, target: MonitoredIdentity) -> bool:
    now = datetime.now(timezone.utc)
    target.last_checked_at = now
    if target.target_type != "email":
        target.last_status = "monitored"
        return False

    result = breach_check.check_breaches(target.value)
    if not result.get("data_available"):
        target.last_status = "unavailable"
        return False

    breach_count = int(result.get("breach_count") or 0)
    target.last_status = "breached" if breach_count else "clear"
    if breach_count <= 0:
        return False

    existing = (
        db.query(IdentityAlert)
        .filter(
            IdentityAlert.user_id == target.user_id,
            IdentityAlert.email == target.value,
            IdentityAlert.alert_type == "monitored_breach",
        )
        .first()
    )
    if not existing:
        db.add(
            IdentityAlert(
                user_id=target.user_id,
                alert_type="monitored_breach",
                email=target.value,
                detail={
                    "breach_count": breach_count,
                    "severity": result.get("severity", "high"),
                    "top_breaches": [b["name"] for b in result.get("breaches", [])[:5]],
                    "monitor_id": target.id,
                },
            )
        )
        create_alert(
            db,
            target.user_id,
            "Monitored identity found in breach",
            f"{target.value} appeared in {breach_count} known breach{'es' if breach_count != 1 else ''}.",
            severity="high",
            topic="breach",
        )
        return True
    return False


def run_identity_monitors(db: Session, max_age_hours: int = 24) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    targets = (
        db.query(MonitoredIdentity)
        .filter(
            MonitoredIdentity.is_active.is_(True),
            (MonitoredIdentity.last_checked_at.is_(None)) | (MonitoredIdentity.last_checked_at < cutoff),
        )
        .limit(500)
        .all()
    )
    alerts = 0
    for target in targets:
        if monitor_identity_target(db, target):
            alerts += 1
    return alerts


def run_recovery_reminders(db: Session) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=3)
    incidents = (
        db.query(Incident)
        .filter(Incident.status != "resolved", Incident.updated_at < cutoff)
        .limit(500)
        .all()
    )
    created = 0
    for incident in incidents:
        create_alert(
            db,
            incident.user_id,
            "Recovery case needs follow-up",
            f"{incident.title or 'Recovery case'} has not been updated in 3 days.",
            severity="suspicious",
            topic="account",
        )
        incident.updated_at = datetime.now(timezone.utc)
        created += 1
    return created


def run_scan_pattern_monitor(db: Session) -> int:
    recent = (
        db.query(ScanHistory)
        .join(RiskReport, RiskReport.scan_id == ScanHistory.id)
        .filter(RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]))
        .order_by(ScanHistory.created_at.desc())
        .limit(200)
        .all()
    )
    created = 0
    for scan in recent:
        create_alert(
            db,
            scan.user_id,
            "High-risk scan follow-up",
            "A recent scan matched a high-risk pattern. Review the recommended next steps.",
            severity="high",
            topic="account",
            scan_id=scan.id,
            force_inbox=False,
        )
        created += 1
    return created
