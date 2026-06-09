"""Scan routes: create link/image scans, list history, view + give feedback."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import (
    ApiUsage,
    RiskReport,
    ScanHistory,
    ScanStatus,
    ScanType,
    User,
)
from app.schemas.schemas import (
    ImageScanCreate,
    LinkScanCreate,
    ScanFeedback,
    ScanOut,
)
from app.services import ocr, scan_service

router = APIRouter(prefix="/scans", tags=["scans"])


def _check_quota(db: Session, user: User) -> None:
    if user.is_premium:
        return
    from app.core.config import settings

    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    used = (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == user.id, ScanHistory.created_at >= start)
        .count()
    )
    if used >= settings.FREE_TIER_DAILY_SCANS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily free scan limit reached. Upgrade to Premium for unlimited scans.",
        )


@router.post("/link", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_link_scan(
    payload: LinkScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_quota(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.link, raw_input=payload.url,
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_link_scan(db, scan, payload.url)
    db.add(ApiUsage(user_id=user.id, provider="safe_browsing"))
    db.commit()
    db.refresh(scan)
    return scan


@router.post("/image", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_image_scan(
    payload: ImageScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_quota(db, user)
    try:
        image_bytes = ocr.decode_base64_image(payload.image_base64)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid image data")

    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.image, status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_image_scan(db, scan, image_bytes, storage_key=payload.filename)
    db.add(ApiUsage(user_id=user.id, provider="openai"))
    db.commit()
    db.refresh(scan)
    return scan


@router.get("", response_model=list[ScanOut])
def list_scans(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == user.id)
        .order_by(ScanHistory.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    scan = db.get(ScanHistory, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    return scan


@router.post("/{scan_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
def submit_feedback(
    scan_id: str,
    payload: ScanFeedback,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    scan = db.get(ScanHistory, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    report = db.query(RiskReport).filter(RiskReport.scan_id == scan_id).first()
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    report.user_feedback = payload.feedback
    db.commit()
