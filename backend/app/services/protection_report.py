"""Weekly Protection Report: aggregates what Shield AI did for a user.

Subscriptions get cancelled when protection is invisible. This module turns
the telemetry the app already collects into a once-a-week digest — delivered
through the same preference-aware channels as every other alert — plus an
on-demand endpoint so the dashboard can render the same numbers any time.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    BrowserTelemetryEvent,
    ExtensionTelemetryEvent,
    IdentityAlert,
    Notification,
    RiskLevel,
    RiskReport,
    ScanHistory,
    User,
)
from app.services.notification_delivery import send_email_alert, send_push_to_devices

REPORT_PERIOD_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def build_report(db: Session, user_id: str, since: datetime | None = None) -> dict:
    """Aggregate the trailing week of protection activity for one user."""
    since = since or (_now() - timedelta(days=REPORT_PERIOD_DAYS))

    scans_total = (
        db.query(func.count(ScanHistory.id))
        .filter(ScanHistory.user_id == user_id, ScanHistory.created_at >= since)
        .scalar()
        or 0
    )
    threats_caught = (
        db.query(func.count(RiskReport.id))
        .join(ScanHistory, ScanHistory.id == RiskReport.scan_id)
        .filter(
            ScanHistory.user_id == user_id,
            RiskReport.created_at >= since,
            RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
        )
        .scalar()
        or 0
    )

    browser_rows = (
        db.query(BrowserTelemetryEvent.action, func.count(BrowserTelemetryEvent.id))
        .filter(BrowserTelemetryEvent.user_id == user_id, BrowserTelemetryEvent.created_at >= since)
        .group_by(BrowserTelemetryEvent.action)
        .all()
    )
    browser_actions = {action or "unknown": count for action, count in browser_rows}
    sites_blocked = browser_actions.get("blocked", 0)
    sites_warned = browser_actions.get("warned", 0) + browser_actions.get("override", 0)

    # Extension events carry a counts dict, e.g. {"numbers_labeled": 120} from
    # the call-directory sync or {"texts_junked": 3} from the message filter.
    calls_labeled = 0
    texts_junked = 0
    for (counts,) in (
        db.query(ExtensionTelemetryEvent.counts)
        .filter(ExtensionTelemetryEvent.user_id == user_id, ExtensionTelemetryEvent.created_at >= since)
        .all()
    ):
        counts = counts or {}
        calls_labeled += int(counts.get("numbers_labeled") or counts.get("calls_labeled") or 0)
        texts_junked += int(counts.get("texts_junked") or counts.get("messages_filtered") or 0)

    new_breach_alerts = (
        db.query(func.count(IdentityAlert.id))
        .filter(IdentityAlert.user_id == user_id, IdentityAlert.created_at >= since)
        .scalar()
        or 0
    )

    return {
        "period_days": REPORT_PERIOD_DAYS,
        "since": since.isoformat(),
        "generated_at": _now().isoformat(),
        "scans_total": scans_total,
        "threats_caught": threats_caught,
        "sites_blocked": sites_blocked,
        "sites_warned": sites_warned,
        "calls_labeled": calls_labeled,
        "texts_junked": texts_junked,
        "new_breach_alerts": new_breach_alerts,
    }


def _has_activity(report: dict) -> bool:
    keys = (
        "scans_total", "threats_caught", "sites_blocked",
        "sites_warned", "calls_labeled", "texts_junked", "new_breach_alerts",
    )
    return any(report[k] for k in keys)


def summarize(report: dict) -> str:
    """One-line human summary used for the push body and email."""
    parts: list[str] = []
    if report["threats_caught"]:
        parts.append(f"{report['threats_caught']} threat{'s' if report['threats_caught'] != 1 else ''} caught")
    if report["sites_blocked"]:
        parts.append(f"{report['sites_blocked']} dangerous site{'s' if report['sites_blocked'] != 1 else ''} blocked")
    if report["texts_junked"]:
        parts.append(f"{report['texts_junked']} scam text{'s' if report['texts_junked'] != 1 else ''} filtered")
    if report["calls_labeled"]:
        parts.append(f"{report['calls_labeled']} scam number{'s' if report['calls_labeled'] != 1 else ''} labeled")
    if report["new_breach_alerts"]:
        parts.append(f"{report['new_breach_alerts']} new breach alert{'s' if report['new_breach_alerts'] != 1 else ''}")
    if not parts:
        if report["scans_total"]:
            return f"You ran {report['scans_total']} scan{'s' if report['scans_total'] != 1 else ''} — all clear this week."
        return "All quiet this week — your protection is active and nothing got through."
    lead = ", ".join(parts[:3])
    return f"This week: {lead}. You're protected."


def run_weekly_reports(db: Session) -> int:
    """Generate and deliver the digest for every active, premium user. Returns count sent."""
    sent = 0
    for (user_id,) in (
        db.query(User.id).filter(User.is_active.is_(True), User.is_premium.is_(True)).all()
    ):
        report = build_report(db, user_id)
        if not _has_activity(report):
            # No digest spam for dormant accounts; the dashboard endpoint
            # still shows the live numbers whenever they return.
            continue
        body = summarize(report)
        db.add(Notification(user_id=user_id, title="Your Weekly Protection Report", body=body))
        db.commit()
        send_push_to_devices(
            db, user_id,
            "Your Weekly Protection Report", body,
            severity="low", topic="account",
            data={"screen": "report"},
        )
        send_email_alert(db, user_id, "Your Weekly Protection Report", body)
        sent += 1
    return sent
