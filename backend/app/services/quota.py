"""Subscription gate + fair-use ceiling for scans — Shield AI has no free tier.

Every scan (links, screenshots, ..., and Shield Labs vertical scans) requires
an active Shield AI Premium subscription. `User.is_premium` is kept in sync
by the RevenueCat webhook and already flips true the moment a trial starts,
so this also covers users mid-trial.

Subscriptions are all-you-can-scan, but "unlimited" carries a fair-use daily
ceiling so a script can't run up the Anthropic bill — most dangerous on a free
trial, where scans cost us with no revenue behind them.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import ScanHistory, User


def require_active_subscription(db: Session, user: User) -> None:
    """Raise 402 without an active subscription (or trial), or 429 once a
    subscriber exceeds the fair-use daily scan ceiling. The cap is set well
    above any genuine usage, so real users never see it."""
    if not user.is_premium:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Shield AI requires an active subscription. Start your free trial to run scans.",
        )

    limit = settings.PREMIUM_DAILY_SCAN_LIMIT
    if limit > 0:
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        recent = (
            db.query(ScanHistory.id)
            .filter(ScanHistory.user_id == user.id, ScanHistory.created_at >= day_ago)
            .count()
        )
        if recent >= limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's scan limit ({limit}). It resets on a rolling "
                "24-hour basis — thanks for helping keep Shield AI fast for everyone.",
            )
