"""Notification routes — Phase 2.

POST /api/v1/notifications/devices  — register (or update) a push token
GET  /api/v1/notifications          — list the user's notifications
POST /api/v1/notifications/{id}/read — mark a notification as read
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Device, Notification, User
from app.schemas.schemas import DeviceRegister, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    payload: DeviceRegister,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Register or update the push token for this device."""
    existing = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.push_token == payload.push_token)
        .first()
    )
    if existing:
        existing.platform = payload.platform
    else:
        db.add(Device(user_id=user.id, push_token=payload.push_token, platform=payload.platform))
    db.commit()


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return q.order_by(Notification.created_at.desc()).limit(min(limit, 200)).all()


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
