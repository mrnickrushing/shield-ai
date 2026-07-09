"""Phone reputation sync — feeds the iOS Call Directory Extension.

GET /api/v1/phone-reputation/sync — corroborated scam-number snapshot (authenticated)
"""
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.models import (
    PersonalBlockedNumber,
    PhoneScan,
    RiskReport,
    ScanHistory,
    RiskLevel,
    SeededScamNumber,
    User,
)
from app.schemas.schemas import PhoneReputationEntry, PhoneReputationSyncOut

router = APIRouter(prefix="/phone-reputation", tags=["phone-reputation"])


class BlockNumberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: str


def _normalize_block_number(raw: str) -> str:
    """Digits only, NANP 10-digit gets the US/Canada country code — matching
    how the Call Directory snapshot stores numbers so a personal block lines up
    with what iOS hands the extension."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "1" + digits
    return digits

# RiskReport.threat_category stores the display string from
# risk_engine.THREAT_CATEGORIES, not the raw category key — map from that.
# Short CallKit label (Apple caps Call Directory labels around 24 chars).
_CATEGORY_LABELS = {
    "Social Engineering": "Scam Likely",
    "Payment Fraud": "Scam Likely",
}
_DEFAULT_LABEL = "Reported Spam"


def _to_e164_digits(normalized_number: str) -> str:
    """CallKit requires the full digit string including country code (no '+',
    no separators). A bare 10-digit number is a NANP-local input missing its
    country code — assume US/Canada ("1") since our scam-area-code list is
    NANP-specific. Anything else is left as-is."""
    if len(normalized_number) == 10:
        return "1" + normalized_number
    return normalized_number


@router.get("/sync", response_model=PhoneReputationSyncOut)
def sync_phone_reputation(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Corroborated scam numbers, for the main app to snapshot into the shared
    App Group container that the Call Directory Extension reads from."""
    rows = (
        db.query(
            PhoneScan.normalized_number,
            RiskReport.threat_category,
            func.count(func.distinct(ScanHistory.user_id)).label("reporters"),
            func.max(RiskReport.created_at).label("last_seen"),
        )
        .join(ScanHistory, PhoneScan.scan_id == ScanHistory.id)
        .join(RiskReport, RiskReport.scan_id == ScanHistory.id)
        .filter(
            PhoneScan.normalized_number != "",
            RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
        )
        .group_by(PhoneScan.normalized_number, RiskReport.threat_category)
        .having(func.count(func.distinct(ScanHistory.user_id)) >= settings.PHONE_BLOCKLIST_MIN_REPORTERS)
        .all()
    )

    # Externally-seeded numbers (FCC complaint feed) fill the list before the
    # community reaches the corroboration threshold; corroborated community
    # entries below overwrite the seed's softer label.
    seeds = (
        db.query(SeededScamNumber)
        .filter(SeededScamNumber.is_active.is_(True))
        .all()
    )
    entries: dict[str, str] = {seed.number: seed.label for seed in seeds}
    latest_seen = max((seed.created_at for seed in seeds), default=None)

    for number, category, _reporters, last_seen in rows:
        entries[_to_e164_digits(number)] = _CATEGORY_LABELS.get(category, _DEFAULT_LABEL)
        if latest_seen is None or (last_seen and last_seen > latest_seen):
            latest_seen = last_seen

    # This user's own blocks always win — a number they chose to block is
    # blocked no matter what the community/feed says.
    personal = db.query(PersonalBlockedNumber).filter(PersonalBlockedNumber.user_id == user.id).all()
    for block in personal:
        entries[block.number] = block.label or "Blocked"
        if latest_seen is None or block.created_at > latest_seen:
            latest_seen = block.created_at

    return PhoneReputationSyncOut(
        version=latest_seen.isoformat() if latest_seen else "0",
        entries=[PhoneReputationEntry(number=n, label=l) for n, l in entries.items()],
    )


@router.get("/blocks")
def list_personal_blocks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(PersonalBlockedNumber)
        .filter(PersonalBlockedNumber.user_id == user.id)
        .order_by(PersonalBlockedNumber.created_at.desc())
        .all()
    )
    return [{"number": r.number, "label": r.label, "created_at": r.created_at} for r in rows]


@router.post("/block", status_code=status.HTTP_201_CREATED)
def add_personal_block(
    payload: BlockNumberIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a number to this user's personal call blocklist. Takes effect on the
    next Call Directory sync."""
    number = _normalize_block_number(payload.number)
    if len(number) < 7:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid phone number.")

    existing = (
        db.query(PersonalBlockedNumber)
        .filter(PersonalBlockedNumber.user_id == user.id, PersonalBlockedNumber.number == number)
        .first()
    )
    if existing:
        return {"number": number, "already_blocked": True}

    db.add(PersonalBlockedNumber(user_id=user.id, number=number, label="Blocked"))
    db.commit()
    return {"number": number, "already_blocked": False}


@router.delete("/block/{number}", status_code=status.HTTP_204_NO_CONTENT)
def remove_personal_block(
    number: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    normalized = _normalize_block_number(number)
    (
        db.query(PersonalBlockedNumber)
        .filter(PersonalBlockedNumber.user_id == user.id, PersonalBlockedNumber.number == normalized)
        .delete()
    )
    db.commit()
