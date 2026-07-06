"""Scam recovery wizard routes."""
import hashlib
import secrets
import textwrap
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import CasePackShare, Incident, IncidentEvidence, User
from app.schemas.schemas import IncidentCreate, IncidentEvidenceCreate, IncidentOut, IncidentUpdate
from app.services import recovery_service

router = APIRouter(prefix="/recovery", tags=["recovery"])


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _incident_label(incident_type: str) -> str:
    return {
        "bank_transfer": "Bank Transfer Fraud",
        "gift_card": "Gift Card Scam",
        "crypto": "Cryptocurrency Fraud",
        "marketplace": "Marketplace Scam",
        "account_takeover": "Account Takeover",
        "romance": "Romance Scam",
        "investment": "Investment Fraud",
        "other": "Scam Incident",
    }.get(incident_type, "Scam Incident")


def _build_case_pack(db: Session, incident: Incident) -> dict:
    evidence_items = db.query(IncidentEvidence).filter(IncidentEvidence.incident_id == incident.id).order_by(IncidentEvidence.created_at).all()
    steps = recovery_service.get_wizard_steps(str(incident.incident_type.value if hasattr(incident.incident_type, "value") else incident.incident_type))
    completed = set(incident.steps_completed or [])
    completed_steps = [s for s in steps if s["id"] in completed]
    remaining_steps = [s for s in steps if s["id"] not in completed]
    incident_type = str(incident.incident_type.value if hasattr(incident.incident_type, "value") else incident.incident_type)
    label = _incident_label(incident_type)
    summary = recovery_service.generate_incident_summary(incident, evidence_items)
    return {
        "title": f"Shield AI Recovery Case Pack - {label}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "case": {
            "id": incident.id,
            "type": incident_type,
            "label": label,
            "status": str(incident.status.value if hasattr(incident.status, "value") else incident.status),
            "amount_lost": incident.amount_lost,
            "currency": incident.currency,
            "linked_scan_id": incident.linked_scan_id,
            "created_at": incident.created_at.isoformat(),
            "updated_at": incident.updated_at.isoformat(),
            "notes": incident.notes,
        },
        "summary": summary,
        "timeline": [
            f"Case opened in Shield AI on {incident.created_at.isoformat()}.",
            f"Recovery checklist progress: {len(completed_steps)} of {len(steps)} steps completed.",
            f"Last case update recorded on {incident.updated_at.isoformat()}.",
        ],
        "completed_actions": completed_steps,
        "recommended_next_actions": remaining_steps,
        "evidence": [
            {
                "id": item.id,
                "type": item.evidence_type,
                "label": item.label,
                "content": item.content,
                "created_at": item.created_at.isoformat(),
            }
            for item in evidence_items
        ],
        "bank_or_platform_template": (
            f"I am reporting suspected {label.lower()}. Please preserve records, block further transfers "
            "or account changes, investigate the activity, and provide a written case or dispute number. "
            "I can provide the timeline, linked scan, and evidence preserved in this Shield AI case pack."
        ),
        "police_report_summary": (
            f"I believe I was targeted by {label.lower()}. Shield AI has preserved a recovery timeline, "
            "risk context, recommended actions, and user-provided evidence notes for follow-up."
        ),
    }


def _case_pack_text(pack: dict) -> str:
    lines = [
        pack["title"],
        f"Generated: {pack['generated_at']}",
        f"Case ID: {pack['case']['id']}",
        "",
        "Case Overview",
        f"Type: {pack['case']['label']}",
        f"Status: {pack['case']['status']}",
        f"Opened: {pack['case']['created_at']}",
        f"Last updated: {pack['case']['updated_at']}",
        f"Reported loss: {pack['case']['currency']} {pack['case']['amount_lost']}" if pack["case"]["amount_lost"] is not None else "Reported loss: Not entered",
        f"Linked scan: {pack['case']['linked_scan_id']}" if pack["case"]["linked_scan_id"] else "",
        "",
        "Incident Summary",
        pack["summary"],
        "",
        "Timeline",
    ]
    lines.extend(f"{i + 1}. {item}" for i, item in enumerate(pack["timeline"]))
    lines.extend(["", "Completed Actions"])
    lines.extend([f"- {item['title']}" for item in pack["completed_actions"]] or ["No completed actions marked yet."])
    lines.extend(["", "Recommended Next Actions"])
    lines.extend(
        [f"{i + 1}. {item['title']}: {item['body']}" for i, item in enumerate(pack["recommended_next_actions"][:8])]
        or ["All recovery steps are marked complete."]
    )
    lines.extend(["", "Evidence"])
    if pack["evidence"]:
        for index, item in enumerate(pack["evidence"], start=1):
            lines.extend(
                [
                    f"Evidence {index}: {item['label'] or item['type']}",
                    f"Type: {item['type']}",
                    f"Captured: {item['created_at']}",
                    f"Content: {item['content']}",
                ]
            )
    else:
        lines.append("No evidence entered yet.")
    lines.extend([
        "",
        "Bank or Platform Dispute Template",
        pack["bank_or_platform_template"],
        "",
        "Platform / Bank Request Checklist",
        "- Preserve account, message, transaction, login, and device records related to this incident.",
        "- Block further transfers, withdrawals, password resets, or account changes where possible.",
        "- Provide a written case, claim, or dispute number and next-response timeline.",
        "",
        "Police Report Summary",
        pack["police_report_summary"],
        "",
        "Notes",
        pack["case"]["notes"] or "No additional notes entered.",
    ])
    return "\n".join(str(line) for line in lines if line != "")


def _minimal_pdf(text: str) -> bytes:
    def esc(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    wrapped: list[str] = []
    for paragraph in text.splitlines():
        wrapped.extend(textwrap.wrap(paragraph, width=88) or [""])
    pages = [wrapped[i:i + 48] for i in range(0, len(wrapped), 48)] or [[]]
    objects: list[bytes] = [b"<< /Type /Catalog /Pages 2 0 R >>"]
    kids = []
    for index, page_lines in enumerate(pages):
        page_obj = 3 + index * 2
        content_obj = page_obj + 1
        kids.append(f"{page_obj} 0 R")
        stream_lines = ["BT", "/F1 10 Tf", "50 760 Td", "14 TL"]
        for line in page_lines:
            stream_lines.append(f"({esc(line)}) Tj")
            stream_lines.append("T*")
        stream_lines.append("ET")
        stream = "\n".join(stream_lines).encode()
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents {content_obj} 0 R >>".encode())
        objects.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    objects.insert(1, f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>".encode())
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode())
        output.extend(obj)
        output.extend(b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(output)


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


@router.get("/incidents/{incident_id}/case-pack")
def get_case_pack(
    incident_id: str,
    format: str = Query(default="json", pattern="^(json|text|pdf)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    incident = db.get(Incident, incident_id)
    if not incident or incident.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    pack = _build_case_pack(db, incident)
    if format == "json":
        return pack
    text = _case_pack_text(pack)
    if format == "text":
        return Response(text, media_type="text/plain; charset=utf-8")
    return Response(
        _minimal_pdf(text),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="shield-ai-case-pack-{incident.id}.pdf"'},
    )


@router.post("/incidents/{incident_id}/share")
def create_case_pack_share(
    incident_id: str,
    request: Request,
    expires_days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    incident = db.get(Incident, incident_id)
    if not incident or incident.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    token = secrets.token_urlsafe(32)
    share = CasePackShare(
        incident_id=incident.id,
        user_id=user.id,
        token_hash=_hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
    )
    db.add(share)
    db.commit()
    base = str(request.base_url).rstrip("/")
    return {
        "url": f"{base}/api/v1/recovery/case-packs/{token}",
        "pdf_url": f"{base}/api/v1/recovery/case-packs/{token}?format=pdf",
        "expires_at": share.expires_at,
    }


@router.get("/case-packs/{token}")
def get_shared_case_pack(
    token: str,
    format: str = Query(default="text", pattern="^(json|text|pdf)$"),
    db: Session = Depends(get_db),
):
    share = db.query(CasePackShare).filter(CasePackShare.token_hash == _hash_token(token)).first()
    if not share or share.revoked_at is not None or _as_utc(share.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case pack link not found or expired")
    incident = db.get(Incident, share.incident_id)
    if not incident:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case pack link not found or expired")
    pack = _build_case_pack(db, incident)
    if format == "json":
        return pack
    text = _case_pack_text(pack)
    if format == "text":
        return Response(text, media_type="text/plain; charset=utf-8")
    return Response(
        _minimal_pdf(text),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="shield-ai-case-pack-{incident.id}.pdf"'},
    )


@router.get("/incidents/{incident_id}/documents/{doc_type}")
def generate_incident_document(
    incident_id: str,
    doc_type: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Concierge documents: bank dispute, FTC complaint, police narrative."""
    from app.services import concierge_docs

    incident = db.get(Incident, incident_id)
    if not incident or incident.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    try:
        return concierge_docs.generate_document(db, incident, user, doc_type)
    except ValueError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Unknown document type. Available: {', '.join(concierge_docs.DOC_TYPES)}",
        )
