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
