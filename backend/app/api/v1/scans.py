"""Scan routes — Phase 1-3: link, image, QR, message, email, phone, marketplace, social."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_user_from_api_key_or_jwt as get_user,
    get_user_from_api_key_or_jwt_write as get_user_write,
)
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
    EmailScanCreate,
    ImageScanCreate,
    LinkScanCreate,
    MarketplaceScanCreate,
    MessageScanCreate,
    PhoneScanCreate,
    QRScanCreate,
    ScanFeedback,
    ScanOut,
    SocialScanCreate,
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
    user: User = Depends(get_user_write),
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
    user: User = Depends(get_user_write),
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
    user: User = Depends(get_user),
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
    user: User = Depends(get_user),
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
    user: User = Depends(get_user_write),
):
    scan = db.get(ScanHistory, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    report = db.query(RiskReport).filter(RiskReport.scan_id == scan_id).first()
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    report.user_feedback = payload.feedback
    db.commit()


# ---------------------------------------------------------------------------
# Phase 2 — new input types
# ---------------------------------------------------------------------------

@router.post("/qr", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_qr_scan(
    payload: QRScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _check_quota(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.qr, raw_input=payload.qr_content[:500],
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_qr_scan(db, scan, payload.qr_content)
    db.add(ApiUsage(user_id=user.id, provider="safe_browsing"))
    db.commit()
    db.refresh(scan)
    return scan


@router.post("/message", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_message_scan(
    payload: MessageScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _check_quota(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.message, raw_input=payload.message_text[:500],
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_message_scan(db, scan, payload.message_text, payload.platform_hint)
    db.add(ApiUsage(user_id=user.id, provider="openai"))
    db.commit()
    db.refresh(scan)
    return scan


@router.post("/email", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_email_scan(
    payload: EmailScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    if not any([
        payload.raw_email, payload.sender_email, payload.subject, payload.body_text
    ]):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Provide at least one of: raw_email, sender_email, subject, or body_text.",
        )
    _check_quota(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.email,
        raw_input=f"From: {payload.sender_email or ''} | Subject: {payload.subject or ''}"[:500],
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_email_scan(
        db, scan,
        raw_email=payload.raw_email,
        sender_email=payload.sender_email,
        sender_display_name=payload.sender_display_name,
        reply_to_email=payload.reply_to_email,
        subject=payload.subject,
        body_text=payload.body_text,
    )
    db.add(ApiUsage(user_id=user.id, provider="openai"))
    db.commit()
    db.refresh(scan)
    return scan


@router.post("/phone", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_phone_scan(
    payload: PhoneScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _check_quota(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.phone, raw_input=payload.phone_number,
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_phone_scan(db, scan, payload.phone_number)
    db.commit()
    db.refresh(scan)
    return scan


# ---------------------------------------------------------------------------
# Phase 3 — protection workflow scan types
# ---------------------------------------------------------------------------

@router.post("/marketplace", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_marketplace_scan(
    payload: MarketplaceScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _check_quota(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.marketplace,
        raw_input=payload.content_text[:500], status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_marketplace_scan(db, scan, payload.content_text, payload.platform_hint)
    db.add(ApiUsage(user_id=user.id, provider="openai"))
    db.commit()
    db.refresh(scan)
    return scan


@router.post("/social", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_social_scan(
    payload: SocialScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _check_quota(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.social,
        raw_input=payload.content_text[:500], status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    scan_service.process_social_scan(db, scan, payload.content_text, payload.platform)
    db.add(ApiUsage(user_id=user.id, provider="openai"))
    db.commit()
    db.refresh(scan)
    return scan
