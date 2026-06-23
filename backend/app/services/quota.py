"""Shared daily scan quota — counts scan_history rows for the day.

One allowance covers every scan a user runs (links, screenshots, …, and Shield
Labs vertical scans), so the free tier can't be bypassed by mixing scan types.
Premium is unlimited.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import ScanHistory, User


def check_daily_scan_quota(db: Session, user: User) -> None:
    """Raise 429 if a free-tier user has hit the daily scan limit."""
    if user.is_premium:
        return
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
