"""RevenueCat billing webhook: keeps users.is_premium in sync with subscriptions.

RevenueCat POSTs every subscription lifecycle event here (configured in the
RevenueCat dashboard → Integrations → Webhooks). The dashboard is set to send
an Authorization header whose value must match REVENUECAT_WEBHOOK_SECRET.

app_user_id is the backend user id — the mobile app calls
Purchases.logIn(<backend user id>) right after auth, so purchases made while
signed in arrive with our id. Purchases made before login carry RevenueCat's
anonymous id; those events also include every known alias, so we match the
first alias that exists in our users table.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.models import AuditLog, User

router = APIRouter(prefix="/billing", tags=["billing"])

# Events that grant (or re-confirm) the premium entitlement.
PREMIUM_ON_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "TRANSFER",
}
# Events that end access. CANCELLATION only turns off auto-renew — access
# continues until EXPIRATION, so it deliberately isn't in this set.
PREMIUM_OFF_EVENTS = {"EXPIRATION"}


def _find_user(db: Session, event: dict) -> User | None:
    candidate_ids = [event.get("app_user_id"), *(event.get("aliases") or [])]
    for candidate in candidate_ids:
        if not candidate or candidate.startswith("$RCAnonymousID:"):
            continue
        user = db.get(User, candidate)
        if user is not None:
            return user
    return None


def _expires_at(event: dict) -> datetime | None:
    ms = event.get("expiration_at_ms")
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


@router.post("/revenuecat-webhook")
def revenuecat_webhook(
    payload: dict,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    secret = settings.REVENUECAT_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing webhook is not configured",
        )
    if authorization != secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad webhook credentials")

    event = payload.get("event") or {}
    event_type = event.get("type", "")

    if event_type in PREMIUM_ON_EVENTS:
        make_premium = True
    elif event_type in PREMIUM_OFF_EVENTS:
        make_premium = False
    else:
        # CANCELLATION, BILLING_ISSUE, TEST, etc. — acknowledged, no state change.
        return {"ok": True, "handled": False}

    user = _find_user(db, event)
    if user is None:
        # 200 so RevenueCat doesn't retry forever; the audit log keeps a trace.
        db.add(AuditLog(action="billing_webhook_unmatched", detail={"type": event_type, "app_user_id": event.get("app_user_id")}))
        db.commit()
        return {"ok": True, "handled": False}

    user.is_premium = make_premium
    user.premium_expires_at = _expires_at(event)
    user.rc_product_id = event.get("product_id") or user.rc_product_id
    db.add(
        AuditLog(
            user_id=user.id,
            action="billing_webhook",
            detail={"type": event_type, "product_id": event.get("product_id"), "is_premium": make_premium},
        )
    )
    db.commit()
    return {"ok": True, "handled": True}
