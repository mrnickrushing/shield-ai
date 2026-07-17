"""Celery application for async scan processing (used for heavier jobs)."""
from celery import Celery
from celery.signals import worker_process_init

from app.core.config import settings

celery_app = Celery(
    "shield_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=840,
    task_time_limit=900,
    broker_connection_retry_on_startup=True,
)


@worker_process_init.connect
def _init_worker_sentry(**_kwargs) -> None:
    if not settings.SENTRY_DSN:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.05,
            send_default_pii=False,
        )
    except Exception:
        pass
celery_app.conf.beat_schedule = {
    **getattr(celery_app.conf, "beat_schedule", {}),
    "privacy-retention-daily": {
        "task": "privacy.apply_retention",
        "schedule": 24 * 60 * 60,
    },
    "identity-monitoring-hourly": {
        "task": "monitoring.identity_targets",
        "schedule": 60 * 60,
    },
    "recovery-reminders-daily": {
        "task": "monitoring.recovery_reminders",
        "schedule": 24 * 60 * 60,
    },
    "scan-pattern-followups-hourly": {
        "task": "monitoring.scan_pattern_followups",
        "schedule": 60 * 60,
    },
    "weekly-protection-report": {
        "task": "monitoring.weekly_protection_report",
        "schedule": 7 * 24 * 60 * 60,
    },
    "seed-feed-refresh-daily": {
        "task": "feeds.refresh_seeds",
        "schedule": 24 * 60 * 60,
    },
    "broker-rechecks-daily": {
        "task": "identity.broker_rechecks",
        "schedule": 24 * 60 * 60,
    },
    "blocklist-growth-weekly": {
        "task": "feeds.blocklist_growth_push",
        "schedule": 7 * 24 * 60 * 60,
    },
    "push-receipts-every-15-minutes": {
        "task": "notifications.check_push_receipts",
        "schedule": 15 * 60,
    },
}


@celery_app.task(
    bind=True,
    name="scans.process",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_kwargs={"max_retries": 2},
)
def process_scan_task(self, scan_id: str, scan_kind: str, payload: dict) -> str:
    """Idempotent production entry point for all provider-backed scans."""
    from app.db.session import SessionLocal
    from app.models.models import ApiUsage, ScanHistory, ScanStatus
    from app.services import ocr, scan_service

    db = SessionLocal()
    try:
        scan = db.get(ScanHistory, scan_id)
        if not scan or scan.status == ScanStatus.completed or scan.report is not None:
            return scan_id

        provider: str | None = None
        if scan_kind == "link":
            scan_service.process_link_scan(db, scan, payload["url"])
            provider = "safe_browsing"
        elif scan_kind == "image":
            image_bytes = ocr.decode_base64_image(payload["image_base64"])
            scan_service.process_image_scan(db, scan, image_bytes, payload.get("storage_key", ""))
            provider = "anthropic"
        elif scan_kind == "qr":
            scan_service.process_qr_scan(db, scan, payload["qr_content"])
            provider = "safe_browsing"
        elif scan_kind == "message":
            scan_service.process_message_scan(db, scan, payload["message_text"], payload.get("platform_hint", ""))
            provider = "anthropic"
        elif scan_kind == "voice":
            scan_service.process_voice_scan(db, scan, payload["transcript"], payload.get("caller_number", ""))
            provider = "anthropic"
        elif scan_kind == "email":
            scan_service.process_email_scan(db, scan, **payload)
            provider = "anthropic"
        elif scan_kind == "phone":
            scan_service.process_phone_scan(db, scan, payload["phone_number"])
        elif scan_kind == "marketplace":
            scan_service.process_marketplace_scan(db, scan, payload["content_text"], payload.get("platform_hint", ""))
            provider = "anthropic"
        elif scan_kind == "social":
            scan_service.process_social_scan(db, scan, payload["content_text"], payload.get("platform", ""))
            provider = "anthropic"
        else:
            raise ValueError(f"Unsupported scan kind: {scan_kind}")

        if provider:
            db.add(ApiUsage(user_id=scan.user_id, provider=provider))
            db.commit()
        return scan_id
    except Exception:
        db.rollback()
        failed_scan = db.get(ScanHistory, scan_id)
        if failed_scan and failed_scan.status != ScanStatus.completed:
            failed_scan.status = ScanStatus.failed
            db.commit()
        raise
    finally:
        db.close()


@celery_app.task(name="scans.process_link")
def process_link_task(scan_id: str, url: str) -> str:
    from app.db.session import SessionLocal
    from app.models.models import ScanHistory
    from app.services import scan_service

    db = SessionLocal()
    try:
        scan = db.get(ScanHistory, scan_id)
        if scan:
            scan_service.process_link_scan(db, scan, url)
        return scan_id
    finally:
        db.close()


@celery_app.task(name="scans.process_image")
def process_image_task(scan_id: str, image_bytes: bytes, storage_key: str = "") -> str:
    from app.db.session import SessionLocal
    from app.models.models import ScanHistory
    from app.services import scan_service

    db = SessionLocal()
    try:
        scan = db.get(ScanHistory, scan_id)
        if scan:
            scan_service.process_image_scan(db, scan, image_bytes, storage_key)
        return scan_id
    finally:
        db.close()


@celery_app.task(name="notifications.check_push_receipts")
def check_push_receipts_task() -> dict[str, int]:
    from app.db.session import SessionLocal
    from app.services.notification_delivery import check_pending_push_receipts

    db = SessionLocal()
    try:
        return check_pending_push_receipts(db)
    finally:
        db.close()


@celery_app.task(name="notifications.deliver_alert")
def deliver_alert_task(
    user_id: str,
    title: str,
    body: str,
    *,
    severity: str = "suspicious",
    topic: str = "account",
    data: dict | None = None,
) -> dict[str, int | bool]:
    from app.db.session import SessionLocal
    from app.services.notification_delivery import send_email_alert, send_push_to_devices

    db = SessionLocal()
    try:
        return {
            "push": send_push_to_devices(db, user_id, title, body, severity=severity, topic=topic, data=data),
            "email": send_email_alert(db, user_id, title, body, severity=severity, topic=topic),
        }
    finally:
        db.close()


@celery_app.task(name="privacy.apply_retention")
def apply_retention_task() -> int:
    from app.db.session import SessionLocal
    from app.services.privacy import apply_retention_policy

    db = SessionLocal()
    try:
        deleted = apply_retention_policy(db)
        db.commit()
        return deleted
    finally:
        db.close()


@celery_app.task(name="monitoring.identity_targets")
def monitor_identity_targets_task() -> int:
    from app.db.session import SessionLocal
    from app.services.monitoring import due_identity_monitor_count, run_identity_monitors

    db = SessionLocal()
    try:
        alerts = run_identity_monitors(db)
        db.commit()
        if due_identity_monitor_count(db) > 0:
            monitor_identity_targets_task.apply_async(countdown=5)
        return alerts
    finally:
        db.close()


@celery_app.task(name="monitoring.recovery_reminders")
def recovery_reminders_task() -> int:
    from app.db.session import SessionLocal
    from app.services.monitoring import run_recovery_reminders

    db = SessionLocal()
    try:
        alerts = run_recovery_reminders(db)
        db.commit()
        return alerts
    finally:
        db.close()


@celery_app.task(name="monitoring.scan_pattern_followups")
def scan_pattern_followups_task() -> int:
    from app.db.session import SessionLocal
    from app.services.monitoring import run_scan_pattern_monitor

    db = SessionLocal()
    try:
        alerts = run_scan_pattern_monitor(db)
        db.commit()
        return alerts
    finally:
        db.close()


@celery_app.task(name="feeds.refresh_seeds")
def refresh_seed_feeds_task() -> dict:
    """Re-fetch the FCC complaint feed and phishing-domain feeds so the
    seeded blocklists stay fresh between deploys. Best-effort per feed."""
    from app.db.session import SessionLocal
    from app.services import feed_sources
    from app.services.domain_seed import reconcile_domains
    from app.services.phone_seed import reconcile_numbers

    results: dict[str, int] = {}
    for name, fetch, reconcile in (
        ("numbers", feed_sources.fetch_fcc_complaint_numbers, reconcile_numbers),
        ("domains", feed_sources.fetch_phishing_domains, reconcile_domains),
    ):
        try:
            data = fetch()
            db = SessionLocal()
            try:
                results[name] = reconcile(db, data)
            finally:
                db.close()
        except Exception:
            results[name] = -1  # fetch failed; next daily run retries
    return results


@celery_app.task(name="monitoring.weekly_protection_report")
def weekly_protection_report_task() -> int:
    from app.db.session import SessionLocal
    from app.services.protection_report import run_weekly_reports

    db = SessionLocal()
    try:
        sent = run_weekly_reports(db)
        db.commit()
        return sent
    finally:
        db.close()


@celery_app.task(name="identity.broker_rechecks")
def broker_rechecks_task() -> int:
    from app.db.session import SessionLocal
    from app.services.monitoring import run_broker_rechecks

    db = SessionLocal()
    try:
        created = run_broker_rechecks(db)
        db.commit()
        return created
    finally:
        db.close()


@celery_app.task(name="feeds.blocklist_growth_push")
def blocklist_growth_push_task() -> int:
    from app.db.session import SessionLocal
    from app.services.monitoring import run_blocklist_growth_push

    db = SessionLocal()
    try:
        sent = run_blocklist_growth_push(db)
        db.commit()
        return sent
    finally:
        db.close()
