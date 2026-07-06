"""Celery application for async scan processing (used for heavier jobs)."""
from celery import Celery

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
    task_time_limit=120,
)
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
}


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
    from app.services.monitoring import run_identity_monitors

    db = SessionLocal()
    try:
        alerts = run_identity_monitors(db)
        db.commit()
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
