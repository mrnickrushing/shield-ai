"""ILMessageFilter network endpoint: live scam-text classification for iMessage.

Apple's MessageFilterExtension defers unknown-sender texts here (via Apple's
proxy, which strips user identity — requests arrive anonymous by design, so
this router is deliberately unauthenticated). The reply tells iOS which tab
the message lands in: junk, promotion, transaction, or none.

Request shape (ILMessageFilterQueryRequest network payload):
    {"_version": 1, "query": {"sender": "+1555…", "message": {"text": "…"}}}
Response shape:
    {"action": "junk" | "promotion" | "transaction" | "none", "subAction": "none"}

Safety posture: only clear scam signals junk a message; anything ambiguous or
any internal error returns "none" (fail open) so real texts are never hidden.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import PhoneScan, RiskLevel, RiskReport, ScanHistory
from app.services import message_analyzer, risk_engine
from app.services.url_check import check_url

router = APIRouter(prefix="/message-filter", tags=["message-filter"])

JUNK_THRESHOLD = 60


def _digits(sender: str) -> str:
    return "".join(c for c in sender if c.isdigit())


def _sender_reported_as_scam(db: Session, sender: str) -> bool:
    """True when the community phone-reputation data marks this sender high-risk
    (same source the Call Directory extension labels 'Scam Likely' from)."""
    normalized = _digits(sender)
    if len(normalized) < 7:
        return False
    try:
        count = (
            db.query(func.count(func.distinct(ScanHistory.user_id)))
            .select_from(PhoneScan)
            .join(ScanHistory, ScanHistory.id == PhoneScan.scan_id)
            .join(RiskReport, RiskReport.scan_id == ScanHistory.id)
            .filter(
                PhoneScan.normalized_number == normalized,
                RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
            )
            .scalar()
        )
        return bool(count and count >= 2)
    except Exception:
        return False


@router.post("")
async def filter_message(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return {"action": "none", "subAction": "none"}

    query = payload.get("query") or {}
    sender = str(query.get("sender") or "")
    text = str((query.get("message") or {}).get("text") or "")

    if not text and not sender:
        return {"action": "none", "subAction": "none"}

    try:
        if sender and _sender_reported_as_scam(db, sender):
            return {"action": "junk", "subAction": "none"}

        if text:
            msg_ev = message_analyzer.analyze_message(text)
            text_score, text_flags, _ = risk_engine.score_text_evidence(text)
            sig_score, _ = risk_engine.score_message_signals(msg_ev["signals"])
            score = min(text_score + sig_score, 100)
            # A link in the text is often the decisive signal (typosquat /
            # threat-list domains); the cached fast check keeps this quick.
            if msg_ev.get("extracted_urls"):
                url_verdict = check_url(msg_ev["extracted_urls"][0])
                score = min(score + url_verdict["score"], 100)
            # The analyzer's benign 2FA/OTP guard shows up as empty signals +
            # low score, so legitimate verification texts pass through.
            if score >= JUNK_THRESHOLD:
                return {"action": "junk", "subAction": "none"}
    except Exception:
        pass

    return {"action": "none", "subAction": "none"}
