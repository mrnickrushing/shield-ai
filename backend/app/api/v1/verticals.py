"""Vertical apps — portfolio scaffold built on the shared Verdict Engine.

Each vertical reuses the core pipeline (deterministic rule pack + LLM
interpretation + blended verdict) for a new high-stakes domain. Verdicts are
returned in-memory; persistence/quota integration lands when a vertical is
deepened past the skeleton.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_user_from_api_key_or_jwt as get_user,
    get_user_from_api_key_or_jwt_write as get_user_write,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.models import ApiUsage, User
from app.schemas.schemas import VerdictOut, VerticalInfo, VerticalScanRequest
from app.verticals import get_vertical, list_verticals, run_vertical

router = APIRouter(prefix="/verticals", tags=["verticals"])


def _check_vertical_quota(db: Session, user: User) -> None:
    """Free accounts get a bounded number of vertical analyses per day.

    Metered on its own ApiUsage bucket (provider="vertical") so it needs no new
    table; Premium bypasses. This can be unified with the /scans daily allowance
    once vertical scans persist to scan_history.
    """
    if user.is_premium:
        return
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    used = (
        db.query(ApiUsage)
        .filter(
            ApiUsage.user_id == user.id,
            ApiUsage.provider == "vertical",
            ApiUsage.created_at >= start,
        )
        .count()
    )
    if used >= settings.FREE_TIER_DAILY_SCANS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily free scan limit reached. Upgrade to Premium for unlimited scans.",
        )


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
    """Run a single vertical's analyzer + verdict pipeline on user-provided input."""
    spec = get_vertical(key)
    if not spec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown vertical: {key}")
    _check_vertical_quota(db, user)
    verdict = run_vertical(spec, payload.input, payload.context)
    db.add(ApiUsage(user_id=user.id, provider="vertical"))
    db.commit()
    return verdict
