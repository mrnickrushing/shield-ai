"""Single source of truth for entitlement authorization."""
from datetime import datetime, timezone

from app.models.models import User


def is_premium_active(user: User, now: datetime | None = None) -> bool:
    if not user.is_premium:
        return False
    expires_at = user.premium_expires_at
    if expires_at is None:
        return True
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at > (now or datetime.now(timezone.utc))
