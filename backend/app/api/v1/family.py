"""Family protection — trusted contacts."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import TrustedContact, User
from app.schemas.schemas import TrustedContactCreate, TrustedContactOut

router = APIRouter(prefix="/family", tags=["family"])


def _require_premium(user: User) -> None:
    if not user.is_premium:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Family Protection requires Shield AI Premium.",
        )


@router.get("/contacts", response_model=list[TrustedContactOut])
def list_contacts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(TrustedContact).filter(TrustedContact.user_id == user.id).order_by(TrustedContact.created_at).all()


@router.post("/contacts", response_model=TrustedContactOut, status_code=status.HTTP_201_CREATED)
def add_contact(payload: TrustedContactCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_premium(user)
    contact = TrustedContact(
        user_id=user.id, name=payload.name, phone=payload.phone or "",
        email=payload.email or "", relationship_label=payload.relationship_label or "",
        created_at=datetime.now(timezone.utc),
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(contact_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    contact = db.get(TrustedContact, contact_id)
    if not contact or contact.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    db.delete(contact)
    db.commit()
