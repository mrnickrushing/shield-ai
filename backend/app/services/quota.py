"""Subscription gate for scans — Shield AI has no free tier.

Every scan (links, screenshots, ..., and Shield Labs vertical scans) requires
an active Shield AI Premium subscription. `User.is_premium` is kept in sync
by the RevenueCat webhook and already flips true the moment a trial starts,
so this also covers users mid-trial.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.models import User


def require_active_subscription(db: Session, user: User) -> None:
    """Raise 402 if the user doesn't have an active subscription (or trial)."""
    if user.is_premium:
        return
    raise HTTPException(
        status.HTTP_402_PAYMENT_REQUIRED,
        "Shield AI requires an active subscription. Start your free trial to run scans.",
    )
