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
from app.models.models import BreachRecord, IdentityAlert, User
from app.schemas.schemas import BreachCheckRequest, BreachCheckResult, IdentityAlertOut
from app.services import breach_check

router = APIRouter(prefix="/identity", tags=["identity"])

_CACHE_TTL_HOURS = 24


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

    # Persist result
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
    password = payload.get("password", "")
    if not password:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "password is required")
    count = breach_check.check_password_pwned(password)
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
