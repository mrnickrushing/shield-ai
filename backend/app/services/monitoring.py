"""Real-time monitoring and alert routing."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    BrowserTelemetryEvent,
    CommunityReport,
    ExtensionTelemetryEvent,
    IdentityAlert,
    Incident,
    LinkScan,
    MonitoredIdentity,
    Notification,
    PhoneScan,
    RiskLevel,
    RiskReport,
    ScanHistory,
    SocialScan,
)
from app.services import breach_check, phone_lookup
from app.services.notification_delivery import SEVERITY_RANK, preferences_for, send_email_alert, send_push_to_devices, should_deliver
from app.services.url_check import check_url


def normalize_domain(url: str, fallback: str = "") -> str:
    if fallback:
        return fallback.lower().strip()
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def create_alert(
    db: Session,
    user_id: str,
    title: str,
    body: str,
    severity: str = "suspicious",
    topic: str = "account",
    scan_id: str | None = None,
    force_inbox: bool = True,
    dedupe_for: timedelta | None = timedelta(hours=24),
) -> Notification | None:
    if dedupe_for is not None:
        cutoff = datetime.now(timezone.utc) - dedupe_for
        duplicate = (
            db.query(Notification.id)
            .filter(
                Notification.user_id == user_id,
                Notification.title == title,
                Notification.body == body[:1000],
                Notification.scan_id == scan_id,
                Notification.created_at >= cutoff,
            )
            .first()
        )
        if duplicate:
            return None

    if not force_inbox and not should_deliver(db, user_id, severity, topic, "push"):
        return None
    notif = Notification(user_id=user_id, title=title, body=body[:1000], scan_id=scan_id)
    db.add(notif)
    send_push_to_devices(
        db,
        user_id,
        title,
        body,
        severity=severity,
        topic=topic,
        data={"scan_id": scan_id, "topic": topic, "type": "monitoring_alert"},
    )
    send_email_alert(db, user_id, title, body, severity=severity, topic=topic)
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
    if target.target_type == "email":
        return _monitor_email(db, target)
    if target.target_type == "phone":
        return _monitor_phone(db, target)
    if target.target_type == "domain":
        return _monitor_domain(db, target)
    if target.target_type == "username":
        return _monitor_username(db, target)
    target.last_status = "unsupported"
    return False


def check_identity_target(db: Session, target: MonitoredIdentity) -> bool:
    pref = preferences_for(db, target.user_id)
    if pref and not pref.proactive_monitoring:
        target.last_status = "paused"
        target.last_checked_at = datetime.now(timezone.utc)
        return False
    try:
        return monitor_identity_target(db, target)
    except Exception:
        target.last_status = "unavailable"
        target.last_checked_at = datetime.now(timezone.utc)
        return False


def _identity_alert_exists(db: Session, target: MonitoredIdentity, alert_type: str) -> bool:
    return bool(
        db.query(IdentityAlert)
        .filter(
            IdentityAlert.user_id == target.user_id,
            IdentityAlert.email == target.value,
            IdentityAlert.alert_type == alert_type,
        )
        .first()
    )


def _record_identity_alert(
    db: Session,
    target: MonitoredIdentity,
    alert_type: str,
    detail: dict,
    title: str,
    body: str,
    *,
    severity: str,
    topic: str,
) -> bool:
    if _identity_alert_exists(db, target, alert_type):
        return False
    db.add(
        IdentityAlert(
            user_id=target.user_id,
            alert_type=alert_type,
            email=target.value,
            detail={**detail, "monitor_id": target.id, "target_type": target.target_type},
        )
    )
    create_alert(db, target.user_id, title, body, severity=severity, topic=topic)
    return True


def _monitor_email(db: Session, target: MonitoredIdentity) -> bool:
    result = breach_check.check_breaches(target.value)
    if not result.get("data_available"):
        target.last_status = "unavailable"
        return False

    breach_count = int(result.get("breach_count") or 0)
    target.last_status = "breached" if breach_count else "clear"
    if breach_count <= 0:
        return False

    return _record_identity_alert(
        db,
        target,
        "monitored_breach",
        {
            "breach_count": breach_count,
            "severity": result.get("severity", "high"),
            "top_breaches": [b["name"] for b in result.get("breaches", [])[:5]],
        },
        "Monitored identity found in breach",
        f"{target.value} appeared in {breach_count} known breach{'es' if breach_count != 1 else ''}.",
        severity="high",
        topic="breach",
    )


def _monitor_phone(db: Session, target: MonitoredIdentity) -> bool:
    normalized = phone_lookup.normalize_phone(target.value)
    if not normalized:
        target.last_status = "invalid"
        return False
    rows = (
        db.query(func.count(func.distinct(ScanHistory.user_id)), func.max(RiskReport.created_at))
        .select_from(PhoneScan)
        .join(ScanHistory, ScanHistory.id == PhoneScan.scan_id)
        .join(RiskReport, RiskReport.scan_id == ScanHistory.id)
        .filter(
            PhoneScan.normalized_number.in_({normalized, normalized[-10:]}),
            RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
        )
        .first()
    )
    reporters = int(rows[0] or 0) if rows else 0
    target.last_status = "reported_high_risk" if reporters else "clear"
    if reporters <= 0:
        return False
    return _record_identity_alert(
        db,
        target,
        "monitored_phone_reputation",
        {"reporters": reporters, "last_seen": rows[1].isoformat() if rows and rows[1] else None},
        "Monitored phone number has scam reports",
        f"{target.value} matched high-risk phone reputation from {reporters} Shield AI reporter{'s' if reporters != 1 else ''}.",
        severity="high",
        topic="account",
    )


def _monitor_domain(db: Session, target: MonitoredIdentity) -> bool:
    domain = target.value.strip().lower().removeprefix("https://").removeprefix("http://").strip("/")
    if not domain:
        target.last_status = "invalid"
        return False
    verdict = check_url(f"https://{domain}")
    target.last_status = str(verdict.get("verdict") or "unverified")
    prior_high_risk = (
        db.query(LinkScan)
        .join(ScanHistory, ScanHistory.id == LinkScan.scan_id)
        .join(RiskReport, RiskReport.scan_id == ScanHistory.id)
        .filter(
            LinkScan.domain == domain,
            RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
        )
        .count()
    )
    alerted = False
    if target.last_status in ("high", "critical") or prior_high_risk > 0:
        alerted = _record_identity_alert(
            db,
            target,
            "monitored_domain_risk",
            {"verdict": verdict, "prior_high_risk_scans": prior_high_risk},
            "Monitored domain looks risky",
            f"{domain} is currently rated {target.last_status} or matched prior high-risk scans.",
            severity="high" if target.last_status != "critical" else "critical",
            topic="impersonation",
        )

    # HIBP domain search: breached accounts @domain. Only yields data once
    # the owner verifies the domain in the HIBP dashboard; None means the
    # data isn't available (unverified/no key), which we don't treat as clean.
    domain_breaches = breach_check.check_domain_breaches(domain)
    if domain_breaches:
        target.last_status = "breached"
        breach_names = sorted({name for names in domain_breaches.values() for name in names})
        alerted = _record_identity_alert(
            db,
            target,
            "domain_breach_exposure",
            {
                "breached_accounts": len(domain_breaches),
                "aliases": sorted(domain_breaches)[:25],
                "breaches": breach_names[:25],
            },
            "Email accounts on your domain found in breaches",
            f"{len(domain_breaches)} account{'s' if len(domain_breaches) != 1 else ''} @{domain} "
            f"appeared in known data breaches ({', '.join(breach_names[:3])}"
            f"{'…' if len(breach_names) > 3 else ''}). Reset those passwords and enable 2FA.",
            severity="high",
            topic="breach",
        ) or alerted
    return alerted


def _monitor_username(db: Session, target: MonitoredIdentity) -> bool:
    value = target.value.strip().lower().lstrip("@")
    if not value:
        target.last_status = "invalid"
        return False
    social_hits = (
        db.query(SocialScan)
        .join(ScanHistory, ScanHistory.id == SocialScan.scan_id)
        .join(RiskReport, RiskReport.scan_id == ScanHistory.id)
        .filter(
            SocialScan.content_text.ilike(f"%{value}%"),
            RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
        )
        .count()
    )
    report_hits = (
        db.query(CommunityReport)
        .filter(
            CommunityReport.artifact_text.ilike(f"%{value}%"),
            CommunityReport.status.in_(["pending", "reviewed", "approved"]),
        )
        .count()
    )
    hits = social_hits + report_hits
    target.last_status = "mentioned_high_risk" if hits else "monitored"
    if hits <= 0:
        return False
    return _record_identity_alert(
        db,
        target,
        "monitored_username_risk",
        {"social_scan_hits": social_hits, "community_report_hits": report_hits},
        "Monitored username appears in scam reports",
        f"@{value} appeared in {hits} high-risk scan or community report signal{'s' if hits != 1 else ''}.",
        severity="suspicious",
        topic="impersonation",
    )


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
        if check_identity_target(db, target):
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
        notif = create_alert(
            db,
            incident.user_id,
            "Recovery case needs follow-up",
            f"{incident.title or 'Recovery case'} has not been updated in 3 days.",
            severity="suspicious",
            topic="account",
            dedupe_for=timedelta(days=7),
        )
        incident.updated_at = datetime.now(timezone.utc)
        if notif:
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
        notif = create_alert(
            db,
            scan.user_id,
            "High-risk scan follow-up",
            "A recent scan matched a high-risk pattern. Review the recommended next steps.",
            severity="high",
            topic="account",
            scan_id=scan.id,
            force_inbox=False,
            dedupe_for=timedelta(days=7),
        )
        if notif:
            created += 1
    return created


def run_broker_rechecks(db: Session) -> int:
    """Deadline and re-verification alerts for data-broker removals.

    Two cases, both alerting instead of scraping (we never fetch broker sites
    on the user's behalf):
    - 'requested' past the broker's promised removal window -> nudge the user
      to verify it actually happened.
    - 'removed' for 30+ days -> monthly prompt to re-check, since brokers
      routinely re-list people after data refreshes.
    last_recheck_at throttles each row to one alert per window.
    """
    from app.models.models import BrokerOptOut
    from app.services.broker_catalog import BROKERS

    catalog = {b["key"]: b for b in BROKERS}
    now = datetime.now(timezone.utc)
    created = 0

    rows = (
        db.query(BrokerOptOut)
        .filter(BrokerOptOut.status.in_(["requested", "removed"]))
        .limit(2000)
        .all()
    )
    for row in rows:
        entry = catalog.get(row.broker_key)
        if not entry:
            continue
        last = row.last_recheck_at or row.updated_at
        if last is not None and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)

        if row.status == "requested" and row.requested_at is not None:
            requested_at = row.requested_at
            if requested_at.tzinfo is None:
                requested_at = requested_at.replace(tzinfo=timezone.utc)
            deadline = requested_at + timedelta(days=entry["expected_days"])
            if now < deadline or (last and now - last < timedelta(days=7)):
                continue
            title = f"Check your {entry['name']} removal"
            body = (
                f"{entry['name']} promised removal within ~{entry['expected_days']} "
                f"day{'s' if entry['expected_days'] != 1 else ''} and that window has passed. "
                "Search yourself again and mark it removed — or resend the request."
            )
        elif row.status == "removed":
            if last is None or now - last < timedelta(days=30):
                continue
            title = f"Re-check {entry['name']} — listings come back"
            body = (
                f"It's been a month since your {entry['name']} listing was removed. "
                "Brokers often re-list people after data refreshes; take 30 seconds to verify you're still gone."
            )
        else:
            continue

        notif = create_alert(
            db, row.user_id, title, body,
            severity="suspicious", topic="breach",
            force_inbox=True, dedupe_for=timedelta(days=7),
        )
        row.last_recheck_at = now
        if notif:
            created += 1
    return created


def run_blocklist_growth_push(db: Session) -> int:
    """Weekly 'your blocklist grew by N' push to premium users.

    Makes invisible protection visible: counts scam numbers the daily feed
    refresh added in the trailing week and tells subscribers their call
    shield got bigger. Skips quiet weeks entirely.
    """
    from app.models.models import SeededScamNumber, User

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    added = (
        db.query(func.count(SeededScamNumber.id))
        .filter(SeededScamNumber.is_active.is_(True), SeededScamNumber.created_at >= week_ago)
        .scalar()
        or 0
    )
    if added < 10:
        return 0  # not worth a push

    title = "Your call shield grew this week"
    body = f"{added:,} new scam numbers were added to your blocklist this week. Open Call Protection to sync them to your phone."
    sent = 0
    for (user_id,) in (
        db.query(User.id).filter(User.is_active.is_(True), User.is_premium.is_(True)).all()
    ):
        notif = create_alert(
            db, user_id, title, body,
            severity="low", topic="account",
            force_inbox=False, dedupe_for=timedelta(days=6),
        )
        if notif:
            sent += 1
    return sent
