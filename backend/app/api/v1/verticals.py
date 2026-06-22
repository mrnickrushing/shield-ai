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


def _consume_vertical_quota(db: Session, user: User) -> None:
    """Atomically enforce + record one free-tier vertical analysis per day.

    Metered on its own ApiUsage bucket (provider="vertical") so it needs no new
    table; Premium bypasses. The user row is locked for the check+insert so a
    concurrent burst can't both pass the check and exceed FREE_TIER_DAILY_SCANS
    (SELECT ... FOR UPDATE is a harmless no-op on SQLite for the test suite).
    This can unify with the /scans allowance once vertical scans persist.
    """
    if user.is_premium:
        return
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # Serialize concurrent vertical scans for this user before counting usage.
    db.query(User).filter(User.id == user.id).with_for_update().one()
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
        db.rollback()
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily free scan limit reached. Upgrade to Premium for unlimited scans.",
        )
    db.add(ApiUsage(user_id=user.id, provider="vertical"))
    db.commit()


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
    _consume_vertical_quota(db, user)
    return run_vertical(spec, payload.input, payload.context)
