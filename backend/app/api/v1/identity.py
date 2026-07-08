"""Identity protection routes — Phase 3.

POST /api/v1/identity/breach-check     — check email against HIBP
POST /api/v1/identity/password-check   — k-anonymity password pwned check
GET  /api/v1/identity/alerts           — list identity alerts
POST /api/v1/identity/alerts/{id}/read — mark alert as read
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import BreachRecord, BrokerOptOut, IdentityAlert, User
from app.schemas.schemas import (
    BreachCheckRequest,
    BreachCheckResult,
    BrokerExposureItem,
    BrokerExposureSummary,
    BrokerStatusUpdate,
    IdentityAlertOut,
)
from app.services import breach_check, broker_catalog

router = APIRouter(prefix="/identity", tags=["identity"])

_CACHE_TTL_HOURS = 24


def _require_premium(user: User) -> None:
    if not user.is_premium:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Identity protection requires Shield AI Premium.",
        )


def _fresh_cache(db: Session, user_id: str, email: str) -> BreachRecord | None:
    rec = (
        db.query(BreachRecord)
        .filter(BreachRecord.user_id == user_id, BreachRecord.email == email)
        .order_by(BreachRecord.checked_at.desc())
        .first()
    )
    if not rec:
        return None
    age = datetime.now(timezone.utc) - rec.checked_at.replace(tzinfo=timezone.utc)
    return rec if age.total_seconds() < _CACHE_TTL_HOURS * 3600 else None


@router.post("/breach-check", response_model=BreachCheckResult)
def check_breach(
    payload: BreachCheckRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Check an email address against known data breach databases."""
    _require_premium(user)
    email = str(payload.email).lower()

    # Return cached result if still fresh
    cached = _fresh_cache(db, user.id, email)
    if cached:
        return BreachCheckResult(
            email=cached.email,
            breach_count=cached.breach_count,
            severity=cached.severity,
            breaches=cached.breaches,
            actions=breach_check.CREDIT_FREEZE_GUIDANCE + breach_check.GENERAL_HYGIENE
            if cached.breach_count > 0
            else breach_check.GENERAL_HYGIENE,
            disclaimer=breach_check.DISCLAIMER,
            data_available=True,
            checked_at=cached.checked_at,
        )

    result = breach_check.check_breaches(email)
    now = datetime.now(timezone.utc)

    # Only persist when HIBP actually returned data. Caching a "no API key /
    # transient failure" result would suppress real lookups for 24 hours and
    # silently report zero breaches while the service is unavailable.
    if result["data_available"]:
        record = BreachRecord(
            user_id=user.id,
            email=email,
            breach_count=result["breach_count"],
            severity=result["severity"],
            breaches=result["breaches"],
            checked_at=now,
        )
        db.add(record)

        # Create an identity alert if new breaches were found
        if result["breach_count"] > 0:
            existing = (
                db.query(IdentityAlert)
                .filter(
                    IdentityAlert.user_id == user.id,
                    IdentityAlert.email == email,
                    IdentityAlert.alert_type == "breach",
                )
                .first()
            )
            if not existing:
                db.add(IdentityAlert(
                    user_id=user.id,
                    alert_type="breach",
                    email=email,
                    detail={
                        "breach_count": result["breach_count"],
                        "severity": result["severity"],
                        "top_breaches": [b["name"] for b in result["breaches"][:5]],
                    },
                ))
        db.commit()

    return BreachCheckResult(
        email=email,
        breach_count=result["breach_count"],
        severity=result["severity"],
        breaches=result["breaches"],
        actions=result["actions"],
        disclaimer=result["disclaimer"],
        data_available=result["data_available"],
        checked_at=now,
    )


@router.post("/password-check")
def check_password(
    payload: dict,
    user: User = Depends(get_current_user),
):
    """
    k-Anonymity password check. Returns the number of times this password
    appeared in known data breaches. Never logs or stores the password.
    """
    _require_premium(user)
    password = payload.get("password", "")
    if not password:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "password is required")
    try:
        count = breach_check.check_password_pwned(password)
    except Exception:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Password check service temporarily unavailable. Please try again.",
        )
    if count > 0:
        recommendation = (
            f"This password appeared {count:,} time(s) in known data breaches. "
            "Stop using it immediately and replace it with a unique, randomly generated password."
        )
    else:
        recommendation = (
            "This password was not found in known breach databases. "
            "Still use a unique password for every account."
        )
    return {"pwned_count": count, "is_compromised": count > 0, "recommendation": recommendation}


@router.get("/alerts", response_model=list[IdentityAlertOut])
def list_alerts(
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(IdentityAlert).filter(IdentityAlert.user_id == user.id)
    if unread_only:
        q = q.filter(IdentityAlert.is_read.is_(False))
    return q.order_by(IdentityAlert.created_at.desc()).limit(min(limit, 200)).all()


@router.post("/alerts/{alert_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_alert_read(
    alert_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = db.get(IdentityAlert, alert_id)
    if not alert or alert.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    alert.is_read = True
    db.commit()


# ---------------------------------------------------------------------------
# Data-broker exposure (premium): guided find-yourself-and-opt-out checklist
# ---------------------------------------------------------------------------

@router.get("/brokers", response_model=BrokerExposureSummary)
def broker_exposure(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_premium(user)
    display_name = user.profile.display_name if user.profile else ""
    statuses = {
        row.broker_key: row
        for row in db.query(BrokerOptOut).filter(BrokerOptOut.user_id == user.id).all()
    }

    items: list[dict] = []
    resolved = in_progress = not_started = 0
    for entry in broker_catalog.catalog_for(display_name):
        row = statuses.get(entry["key"])
        entry["status"] = row.status if row else "not_started"
        entry["notes"] = row.notes if row else ""
        entry["requested_at"] = row.requested_at if row else None
        entry["updated_at"] = row.updated_at if row else None
        if entry["status"] in broker_catalog.RESOLVED_STATUSES:
            resolved += 1
        elif entry["status"] == "not_started":
            not_started += 1
        else:
            in_progress += 1
        items.append(entry)

    total = len(items)
    exposure_score = round(100 * (total - resolved) / total) if total else 0
    return {
        "total": total,
        "resolved": resolved,
        "in_progress": in_progress,
        "not_started": not_started,
        "exposure_score": exposure_score,
        "brokers": items,
    }


@router.put("/brokers/{broker_key}", response_model=BrokerExposureItem)
def update_broker_status(
    broker_key: str,
    payload: BrokerStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_premium(user)
    entry = next((b for b in broker_catalog.BROKERS if b["key"] == broker_key), None)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown broker")
    if payload.status not in broker_catalog.VALID_STATUSES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"status must be one of: {', '.join(sorted(broker_catalog.VALID_STATUSES))}",
        )

    row = (
        db.query(BrokerOptOut)
        .filter(BrokerOptOut.user_id == user.id, BrokerOptOut.broker_key == broker_key)
        .first()
    )
    if row is None:
        row = BrokerOptOut(user_id=user.id, broker_key=broker_key)
        db.add(row)
    row.status = payload.status
    row.notes = payload.notes[:2000]
    row.updated_at = datetime.now(timezone.utc)
    if payload.status == "requested" and row.requested_at is None:
        row.requested_at = row.updated_at
    db.commit()
    db.refresh(row)

    display_name = user.profile.display_name if user.profile else ""
    rendered = next(b for b in broker_catalog.catalog_for(display_name) if b["key"] == broker_key)
    rendered.update(
        status=row.status, notes=row.notes,
        requested_at=row.requested_at, updated_at=row.updated_at,
    )
    return rendered
