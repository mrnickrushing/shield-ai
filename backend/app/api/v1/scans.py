"""Scan routes — Phase 1-3: link, image, QR, message, email, phone, marketplace, social."""
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_user_from_api_key_or_jwt as get_user,
    get_user_from_api_key_or_jwt_write as get_user_write,
)
from app.db.session import get_db
from app.core.config import settings
from app.models.models import (
    ApiUsage,
    RiskReport,
    ScanFeedbackDetail,
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
    ScanFeedbackDetailCreate,
    ScanFeedbackDetailOut,
    ScanOut,
    SocialScanCreate,
    VoiceScanCreate,
)
from app.services import ocr, scan_service
from app.services.subscription import is_premium_active

router = APIRouter(prefix="/scans", tags=["scans"])


def _require_subscription(db: Session, user: User) -> None:
    # Shared subscription gate (also enforced on Shield Labs vertical scans).
    from app.services.quota import require_active_subscription

    require_active_subscription(db, user)


def _run_or_enqueue(
    db: Session,
    scan: ScanHistory,
    scan_kind: str,
    task_payload: dict,
    inline_processor,
    *,
    usage_provider: str | None = None,
) -> None:
    """Keep network/OCR/LLM work off production request workers."""
    if settings.ENVIRONMENT.lower() in {"production", "prod"}:
        try:
            from app.workers.celery_app import celery_app

            celery_app.send_task("scans.process", args=[scan.id, scan_kind, task_payload])
        except Exception as exc:
            scan.status = ScanStatus.failed
            db.commit()
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Analysis queue is temporarily unavailable. Please try again.",
            ) from exc
        return

    inline_processor()
    if usage_provider:
        db.add(ApiUsage(user_id=scan.user_id, provider=usage_provider))
    db.commit()
    db.refresh(scan)


@router.get("/url-check")
def url_check(url: str, user: User = Depends(get_user)):
    """Fast reputation verdict for the live Safe Browser.

    Runs on every WebView navigation, so it writes no scan history, but it
    still requires Premium — Live Safe Browser is a subscription feature.
    Registered before /{scan_id} so this path wins.
    """
    if not is_premium_active(user):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Live Safe Browser requires Shield AI Premium.",
        )
    from app.services.url_check import check_url

    return check_url(url)


@router.post("/link", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_link_scan(
    payload: LinkScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.link, raw_input=payload.url,
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "link", {"url": payload.url},
        lambda: scan_service.process_link_scan(db, scan, payload.url),
        usage_provider="safe_browsing",
    )
    return scan


@router.post("/image", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_image_scan(
    payload: ImageScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _require_subscription(db, user)
    try:
        image_bytes = ocr.decode_base64_image(payload.image_base64)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid image data")
    if len(image_bytes) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Image must be under {settings.MAX_UPLOAD_MB} MB.",
        )
    try:
        from PIL import Image, UnidentifiedImageError

        with Image.open(io.BytesIO(image_bytes)) as image:
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > 25_000_000:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    "Image dimensions are too large.",
                )
            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid image data")

    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.image, status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "image", {"image_base64": payload.image_base64, "storage_key": payload.filename},
        lambda: scan_service.process_image_scan(db, scan, image_bytes, storage_key=payload.filename),
        usage_provider="anthropic",
    )
    return scan


@router.get("", response_model=list[ScanOut])
def list_scans(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_user),
):
    return (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == user.id)
        .order_by(ScanHistory.created_at.desc())
        .limit(limit)
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


@router.post("/{scan_id}/feedback-detail", response_model=ScanFeedbackDetailOut, status_code=status.HTTP_201_CREATED)
def submit_feedback_detail(
    scan_id: str,
    payload: ScanFeedbackDetailCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    scan = db.get(ScanHistory, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    report = db.query(RiskReport).filter(RiskReport.scan_id == scan_id).first()
    if report:
        report.user_feedback = "false_positive" if payload.feedback in ("false_positive", "missed_scam") else "helpful"
    detail = ScanFeedbackDetail(
        user_id=user.id,
        scan_id=scan_id,
        feedback=payload.feedback,
        reason=payload.reason,
        corrected_context=payload.corrected_context,
        evidence=payload.evidence,
    )
    db.add(detail)
    db.commit()
    db.refresh(detail)
    return detail


# ---------------------------------------------------------------------------
# Phase 2 — new input types
# ---------------------------------------------------------------------------

@router.post("/qr", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_qr_scan(
    payload: QRScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.qr, raw_input=payload.qr_content[:500],
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "qr", {"qr_content": payload.qr_content},
        lambda: scan_service.process_qr_scan(db, scan, payload.qr_content),
        usage_provider="safe_browsing",
    )
    return scan


@router.post("/message", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_message_scan(
    payload: MessageScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.message, raw_input=payload.message_text[:500],
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "message", {"message_text": payload.message_text, "platform_hint": payload.platform_hint},
        lambda: scan_service.process_message_scan(db, scan, payload.message_text, payload.platform_hint),
        usage_provider="anthropic",
    )
    return scan


@router.post("/voice", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_voice_scan(
    payload: VoiceScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    """Analyze a voicemail / call transcript (transcribed on-device for privacy)."""
    transcript = payload.transcript.strip()
    if len(transcript) < 10:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Transcript is too short to analyze — record a longer portion of the voicemail.",
        )
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.voice, raw_input=transcript[:500],
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "voice", {"transcript": transcript, "caller_number": payload.caller_number},
        lambda: scan_service.process_voice_scan(db, scan, transcript, payload.caller_number),
        usage_provider="anthropic",
    )
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
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.email,
        raw_input=f"From: {payload.sender_email or ''} | Subject: {payload.subject or ''}"[:500],
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    email_payload = {
        "raw_email": payload.raw_email,
        "sender_email": payload.sender_email,
        "sender_display_name": payload.sender_display_name,
        "reply_to_email": payload.reply_to_email,
        "subject": payload.subject,
        "body_text": payload.body_text,
    }
    _run_or_enqueue(
        db, scan, "email", email_payload,
        lambda: scan_service.process_email_scan(db, scan, **email_payload),
        usage_provider="anthropic",
    )
    return scan


@router.post("/phone", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_phone_scan(
    payload: PhoneScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.phone, raw_input=payload.phone_number,
        status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "phone", {"phone_number": payload.phone_number},
        lambda: scan_service.process_phone_scan(db, scan, payload.phone_number),
    )
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
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.marketplace,
        raw_input=payload.content_text[:500], status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "marketplace", {"content_text": payload.content_text, "platform_hint": payload.platform_hint},
        lambda: scan_service.process_marketplace_scan(db, scan, payload.content_text, payload.platform_hint),
        usage_provider="anthropic",
    )
    return scan


@router.post("/social", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_social_scan(
    payload: SocialScanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    _require_subscription(db, user)
    scan = ScanHistory(
        user_id=user.id, scan_type=ScanType.social,
        raw_input=payload.content_text[:500], status=ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _run_or_enqueue(
        db, scan, "social", {"content_text": payload.content_text, "platform": payload.platform},
        lambda: scan_service.process_social_scan(db, scan, payload.content_text, payload.platform),
        usage_provider="anthropic",
    )
    return scan
