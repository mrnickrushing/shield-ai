"""Scam recovery wizard routes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Incident, IncidentEvidence, User
from app.schemas.schemas import IncidentCreate, IncidentEvidenceCreate, IncidentOut, IncidentUpdate
from app.services import recovery_service

router = APIRouter(prefix="/recovery", tags=["recovery"])


@router.get("/wizard/{incident_type}")
def get_wizard_steps(incident_type: str):
    return recovery_service.get_wizard_steps(incident_type)


@router.post("/incidents", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    incident = Incident(
        user_id=user.id, incident_type=payload.incident_type, title=payload.title or "",
        amount_lost=payload.amount_lost, currency=payload.currency, notes=payload.notes or "",
        linked_scan_id=payload.linked_scan_id, created_at=now, updated_at=now,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Incident).filter(Incident.user_id == user.id).order_by(Incident.created_at.desc()).all()


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    incident = db.get(Incident, incident_id)
    if not incident or incident.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    return incident


@router.patch("/incidents/{incident_id}", response_model=IncidentOut)
def update_incident(incident_id: str, payload: IncidentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    incident = db.get(Incident, incident_id)
    if not incident or incident.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(incident, field, val)
    incident.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(incident)
    return incident


@router.post("/incidents/{incident_id}/evidence", status_code=status.HTTP_201_CREATED)
def add_evidence(incident_id: str, payload: IncidentEvidenceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    incident = db.get(Incident, incident_id)
    if not incident or incident.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    ev = IncidentEvidence(incident_id=incident_id, evidence_type=payload.evidence_type, content=payload.content, label=payload.label, created_at=datetime.now(timezone.utc))
    db.add(ev)
    db.commit()
    return {"id": ev.id}


@router.get("/incidents/{incident_id}/summary")
def get_incident_summary(incident_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    incident = db.get(Incident, incident_id)
    if not incident or incident.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    evidence_items = db.query(IncidentEvidence).filter(IncidentEvidence.incident_id == incident_id).order_by(IncidentEvidence.created_at).all()
    return {"summary": recovery_service.generate_incident_summary(incident, evidence_items)}
