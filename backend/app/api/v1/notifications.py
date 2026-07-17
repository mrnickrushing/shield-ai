"""Notification routes — Phase 2.

POST /api/v1/notifications/devices  — register (or update) a push token
GET  /api/v1/notifications          — list the user's notifications
POST /api/v1/notifications/{id}/read — mark a notification as read
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Device, Notification, NotificationPreference, User
from app.schemas.schemas import DeviceRegister, NotificationOut, NotificationPreferenceIn, NotificationPreferenceOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

DEFAULT_TOPICS = {
    "breach": True,
    "impersonation": True,
    "account": True,
    "family": True,
    "community": False,
}


def _get_preferences(db: Session, user_id: str) -> NotificationPreference:
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if pref:
        if not pref.topics:
            pref.topics = DEFAULT_TOPICS.copy()
        return pref
    pref = NotificationPreference(user_id=user_id, topics=DEFAULT_TOPICS.copy())
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    payload: DeviceRegister,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Register or update the push token for this device."""
    # An Expo token identifies one app installation, not one account. Transfer
    # it atomically on account switch so the previous account can never keep
    # sending sensitive alerts to the same physical device.
    existing = db.query(Device).filter(Device.push_token == payload.push_token).first()
    if existing:
        existing.user_id = user.id
        existing.platform = payload.platform
        existing.label = payload.label
        existing.last_seen_at = datetime.now(timezone.utc)
        existing.revoked_at = None
    else:
        db.add(Device(user_id=user.id, push_token=payload.push_token, platform=payload.platform, label=payload.label, last_seen_at=datetime.now(timezone.utc)))
    db.commit()


@router.delete("/devices/current", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(
    push_token: str = Query(min_length=16, max_length=4096),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    device = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.push_token == push_token)
        .first()
    )
    if device:
        # Keep the row so delivery receipts retain referential integrity, but
        # make it immediately ineligible for future notifications.
        device.revoked_at = datetime.now(timezone.utc)
        device.last_seen_at = datetime.now(timezone.utc)
        db.commit()


@router.get("/preferences", response_model=NotificationPreferenceOut)
def get_preferences(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_preferences(db, user.id)


@router.put("/preferences", response_model=NotificationPreferenceOut)
def update_preferences(
    payload: NotificationPreferenceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = _get_preferences(db, user.id)
    pref.push_enabled = payload.push_enabled
    pref.email_enabled = payload.email_enabled
    pref.proactive_monitoring = payload.proactive_monitoring
    pref.quiet_hours_enabled = payload.quiet_hours_enabled
    pref.quiet_hours_start = payload.quiet_hours_start
    pref.quiet_hours_end = payload.quiet_hours_end
    pref.minimum_severity = payload.minimum_severity
    pref.topics = {**DEFAULT_TOPICS, **(payload.topics or {})}
    pref.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pref)
    return pref


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.post("/{notif_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    notif_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notif = db.get(Notification, notif_id)
    if not notif or notif.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    notif.is_read = True
    db.commit()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == user.id, Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()


@router.delete("/{notif_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notif_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notif = db.get(Notification, notif_id)
    if not notif or notif.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    db.delete(notif)
    db.commit()
