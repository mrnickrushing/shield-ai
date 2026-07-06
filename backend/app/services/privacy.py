"""Privacy and retention helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.models import (
    CommunityReport,
    EmailScan,
    ImageScan,
    Incident,
    LinkScan,
    MarketplaceScan,
    MessageScan,
    Notification,
    PhoneScan,
    PrivacyPreference,
    QRScan,
    RiskReport,
    ScanFeedbackDetail,
    ScanHistory,
    SocialScan,
)

SCAN_ARTIFACT_MODELS = (
    LinkScan,
    ImageScan,
    QRScan,
    MessageScan,
    EmailScan,
    PhoneScan,
    MarketplaceScan,
    SocialScan,
)


def purge_scan_ids(db: Session, scan_ids: list[str]) -> int:
    if not scan_ids:
        return 0
    db.query(Incident).filter(Incident.linked_scan_id.in_(scan_ids)).update(
        {Incident.linked_scan_id: None},
        synchronize_session=False,
    )
    db.query(Notification).filter(Notification.scan_id.in_(scan_ids)).update(
        {Notification.scan_id: None},
        synchronize_session=False,
    )
    db.query(CommunityReport).filter(CommunityReport.scan_id.in_(scan_ids)).update(
        {CommunityReport.scan_id: None},
        synchronize_session=False,
    )
    for model in SCAN_ARTIFACT_MODELS:
        db.query(model).filter(model.scan_id.in_(scan_ids)).delete(synchronize_session=False)
    db.query(ScanFeedbackDetail).filter(ScanFeedbackDetail.scan_id.in_(scan_ids)).delete(synchronize_session=False)
    db.query(RiskReport).filter(RiskReport.scan_id.in_(scan_ids)).delete(synchronize_session=False)
    deleted = db.query(ScanHistory).filter(ScanHistory.id.in_(scan_ids)).delete(synchronize_session=False)
    return int(deleted or 0)


def purge_user_scans(db: Session, user_id: str) -> int:
    scan_ids = [row[0] for row in db.query(ScanHistory.id).filter(ScanHistory.user_id == user_id).all()]
    return purge_scan_ids(db, scan_ids)


def apply_retention_policy(db: Session, user_id: str | None = None) -> int:
    query = db.query(PrivacyPreference).filter(PrivacyPreference.retention_days.is_not(None))
    if user_id:
        query = query.filter(PrivacyPreference.user_id == user_id)
    deleted = 0
    now = datetime.now(timezone.utc)
    for pref in query.all():
        cutoff = now - timedelta(days=int(pref.retention_days or 0))
        scan_ids = [
            row[0]
            for row in db.query(ScanHistory.id)
            .filter(ScanHistory.user_id == pref.user_id, ScanHistory.created_at < cutoff)
            .all()
        ]
        deleted += purge_scan_ids(db, scan_ids)
    return deleted
