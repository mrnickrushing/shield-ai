"""Vertical apps — Shield Labs portfolio on the shared Verdict Engine.

Each vertical reuses the core pipeline (deterministic rule pack + LLM
interpretation + blended verdict) for a new high-stakes domain. Verdicts are
persisted to scan_history / risk_reports just like normal scans, so they appear
in History and count toward the same daily quota. File-accepting verticals
(e.g. MedBill) can take a photo or PDF instead of pasted text.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_user_from_api_key_or_jwt_write as get_user_write,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.models import ScanHistory, ScanStatus, ScanType, User
from app.schemas.schemas import VerdictOut, VerticalInfo, VerticalScanRequest
from app.services import document, ocr, scan_service
from app.services.quota import check_daily_scan_quota
from app.verticals import get_vertical, list_verticals, run_vertical

router = APIRouter(prefix="/verticals", tags=["verticals"])


@router.get("", response_model=list[VerticalInfo])
def catalog():
    """List every vertical app in the portfolio for the Shield Labs hub."""
    return [
        VerticalInfo(
            key=s.key,
            name=s.name,
            tagline=s.tagline,
            accent=s.accent,
            icon=s.icon,
            input_label=s.input_label,
            input_placeholder=s.input_placeholder,
            input_multiline=s.input_multiline,
            accepts_files=s.accepts_files,
        )
        for s in list_verticals()
    ]


def _resolve_input(spec, payload: VerticalScanRequest) -> str:
    """Text to analyze: typed input, plus text extracted from an uploaded file."""
    text = payload.input
    if not payload.file_base64:
        return text
    if not spec.accepts_files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{spec.name} doesn't accept file uploads.")
    try:
        raw = ocr.decode_base64_image(payload.file_base64)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file data.")
    if len(raw) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large.")
    extracted = document.extract_text(raw)
    if not extracted["ok"]:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Couldn't read text from that file. Try a clearer photo or paste the text.",
        )
    return f"{text}\n{extracted['text']}".strip() if text.strip() else extracted["text"]


@router.post("/{key}/scan", response_model=VerdictOut)
def scan(
    key: str,
    payload: VerticalScanRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_write),
):
    """Run a vertical's analyzer + verdict pipeline, persisting it to history."""
    spec = get_vertical(key)
    if not spec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown vertical: {key}")

    check_daily_scan_quota(db, user)
    text = _resolve_input(spec, payload)

    scan_row = ScanHistory(
        user_id=user.id,
        scan_type=ScanType.vertical,
        vertical_key=key,
        raw_input=text[:500],
        status=ScanStatus.pending,
    )
    db.add(scan_row)
    db.commit()
    db.refresh(scan_row)

    verdict = run_vertical(spec, text, payload.context)

    # Keep the vertical-specific extras with the persisted evidence so the verdict
    # can be reconstructed from history; the response still returns them top-level.
    evidence = dict(verdict.get("evidence") or {})
    evidence["_vertical"] = {
        "vertical": verdict.get("vertical"),
        "vertical_name": verdict.get("vertical_name"),
        "output_title": verdict.get("output_title"),
        "output_artifact": verdict.get("output_artifact"),
    }
    scan_service._finalize(db, scan_row, verdict, evidence)
    return verdict
