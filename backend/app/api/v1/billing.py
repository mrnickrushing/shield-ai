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
import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.models import AuditLog, BillingWebhookEvent, User

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


def _event_identity(event: dict) -> str:
    return str(event.get("id") or hashlib.sha256(
        json.dumps(event, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest())


def _event_time(event: dict) -> datetime:
    ms = event.get("event_timestamp_ms")
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc) if ms else datetime.now(timezone.utc)


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
    event_id = _event_identity(event)
    if db.query(BillingWebhookEvent.id).filter(BillingWebhookEvent.event_id == event_id).first():
        return {"ok": True, "handled": False, "duplicate": True}

    if event_type in PREMIUM_ON_EVENTS:
        make_premium = True
    elif event_type in PREMIUM_OFF_EVENTS:
        make_premium = False
    else:
        make_premium = None

    user = _find_user(db, event)
    if user is None:
        # 200 so RevenueCat doesn't retry forever; the audit log keeps a trace.
        db.add(BillingWebhookEvent(
            event_id=event_id,
            event_type=event_type,
            event_at=_event_time(event),
            handled=False,
            detail={"outcome": "unmatched", "app_user_id": event.get("app_user_id")},
        ))
        db.add(AuditLog(action="billing_webhook_unmatched", detail={"type": event_type, "app_user_id": event.get("app_user_id")}))
        db.commit()
        return {"ok": True, "handled": False}

    event_at = _event_time(event)
    last_event_at = user.rc_last_event_at
    if last_event_at is not None and last_event_at.tzinfo is None:
        last_event_at = last_event_at.replace(tzinfo=timezone.utc)
    stale = last_event_at is not None and event_at < last_event_at
    handled = make_premium is not None and not stale
    if not stale:
        expires_at = _expires_at(event)
        if make_premium is not None:
            user.is_premium = bool(make_premium and (expires_at is None or expires_at > datetime.now(timezone.utc)))
        if expires_at is not None:
            user.premium_expires_at = expires_at
        user.rc_product_id = event.get("product_id") or user.rc_product_id
        user.rc_last_event_at = event_at
    db.add(BillingWebhookEvent(
        event_id=event_id,
        user_id=user.id,
        event_type=event_type,
        event_at=event_at,
        handled=handled,
        detail={"stale": stale, "product_id": event.get("product_id")},
    ))
    db.add(
        AuditLog(
            user_id=user.id,
            action="billing_webhook",
            detail={"type": event_type, "product_id": event.get("product_id"), "is_premium": user.is_premium, "stale": stale},
        )
    )
    db.commit()
    return {"ok": True, "handled": handled, "stale": stale}
