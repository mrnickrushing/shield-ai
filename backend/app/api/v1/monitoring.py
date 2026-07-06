"""Real-time monitoring routes."""
import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import SessionLocal, get_db
from app.models.models import BrowserTelemetryEvent, ExtensionTelemetryEvent, IdentityAlert, MonitoredIdentity, Notification, User
from app.schemas.schemas import BrowserTelemetryCreate, ExtensionTelemetryCreate, MonitoredIdentityCreate, MonitoredIdentityOut
from app.services import monitoring

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/targets", response_model=list[MonitoredIdentityOut])
def list_targets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(MonitoredIdentity)
        .filter(MonitoredIdentity.user_id == user.id)
        .order_by(MonitoredIdentity.created_at.desc())
        .all()
    )


@router.post("/targets", response_model=MonitoredIdentityOut, status_code=status.HTTP_201_CREATED)
def add_target(payload: MonitoredIdentityCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    value = payload.value.strip().lower()
    target = MonitoredIdentity(
        user_id=user.id,
        target_type=payload.target_type,
        value=value,
        label=payload.label.strip(),
    )
    db.add(target)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This target is already monitored")
    db.refresh(target)
    return target


@router.delete("/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_target(target_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    target = db.get(MonitoredIdentity, target_id)
    if not target or target.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Monitor target not found")
    target.is_active = False
    db.commit()


@router.post("/browser-events", status_code=status.HTTP_201_CREATED)
def record_browser_event(payload: BrowserTelemetryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = monitoring.record_browser_event(
        db,
        user_id=user.id,
        url=payload.url,
        domain=payload.domain,
        verdict=payload.verdict,
        action=payload.action,
        reason=payload.reason,
    )
    db.commit()
    return {"id": event.id}


@router.post("/extension-events", status_code=status.HTTP_201_CREATED)
def record_extension_event(payload: ExtensionTelemetryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = monitoring.record_extension_event(
        db,
        user_id=user.id,
        extension_type=payload.extension_type,
        event_type=payload.event_type,
        counts=payload.counts,
        detail=payload.detail,
    )
    db.commit()
    return {"id": event.id}


@router.get("/summary")
def monitoring_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {
        "monitored_targets": db.query(MonitoredIdentity).filter(MonitoredIdentity.user_id == user.id, MonitoredIdentity.is_active.is_(True)).count(),
        "unread_notifications": db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).count(),
        "identity_alerts": db.query(IdentityAlert).filter(IdentityAlert.user_id == user.id, IdentityAlert.is_read.is_(False)).count(),
        "browser_events_24h": db.query(BrowserTelemetryEvent).filter(BrowserTelemetryEvent.user_id == user.id).count(),
        "extension_events_24h": db.query(ExtensionTelemetryEvent).filter(ExtensionTelemetryEvent.user_id == user.id).count(),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/stream")
async def alert_stream(user: User = Depends(get_current_user)):
    async def events():
        last_seen = datetime.now(timezone.utc)
        yield f"event: heartbeat\ndata: {json.dumps({'at': last_seen.isoformat()})}\n\n"
        while True:
            await asyncio.sleep(10)
            db = SessionLocal()
            try:
                rows = (
                    db.query(Notification)
                    .filter(Notification.user_id == user.id, Notification.created_at > last_seen)
                    .order_by(Notification.created_at.asc())
                    .limit(25)
                    .all()
                )
                for row in rows:
                    created_at = row.created_at.replace(tzinfo=timezone.utc) if row.created_at.tzinfo is None else row.created_at
                    last_seen = max(last_seen, created_at)
                    payload = {
                        "id": row.id,
                        "title": row.title,
                        "body": row.body,
                        "scan_id": row.scan_id,
                        "created_at": row.created_at.isoformat(),
                    }
                    yield f"event: notification\ndata: {json.dumps(payload)}\n\n"
                yield f"event: heartbeat\ndata: {json.dumps({'at': datetime.now(timezone.utc).isoformat()})}\n\n"
            finally:
                db.close()

    return StreamingResponse(events(), media_type="text/event-stream")
