"""Vertical apps — Shield Labs portfolio on the shared Verdict Engine.

Each vertical reuses the core pipeline (deterministic rule pack + LLM
interpretation + blended verdict) for a new high-stakes domain. Verdicts are
persisted to scan_history / risk_reports just like normal scans, so they appear
in History and count toward the same daily quota.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_user_from_api_key_or_jwt as get_user,
    get_user_from_api_key_or_jwt_write as get_user_write,
)
from app.db.session import get_db
from app.models.models import ScanHistory, ScanStatus, ScanType, User
from app.schemas.schemas import VerdictOut, VerticalInfo, VerticalScanRequest
from app.services import scan_service
from app.services.quota import check_daily_scan_quota
from app.verticals import get_vertical, list_verticals, run_vertical

router = APIRouter(prefix="/verticals", tags=["verticals"])


@router.get("", response_model=list[VerticalInfo])
def catalog(user: User = Depends(get_user)):
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
        )
        for s in list_verticals()
    ]


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

    scan_row = ScanHistory(
        user_id=user.id,
        scan_type=ScanType.vertical,
        vertical_key=key,
        raw_input=payload.input[:500],
        status=ScanStatus.pending,
    )
    db.add(scan_row)
    db.commit()
    db.refresh(scan_row)

    verdict = run_vertical(spec, payload.input, payload.context)

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
