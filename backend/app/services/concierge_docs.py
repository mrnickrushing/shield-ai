"""Recovery concierge: personalized documents generated from an incident.

The case pack (recovery.py) bundles everything generically; these generators
produce the specific documents a victim actually has to send — written from
their incident's real details (type, amount, dates, evidence), personalized
by the LLM when available and fully usable from deterministic templates when
not. Every document ends as plain text the user can paste, print, or share.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import Incident, IncidentEvidence, User
from app.services import ai_analyzer

DOC_TYPES = {
    "bank_dispute": "Bank / card dispute letter",
    "ftc_complaint": "FTC complaint draft",
    "police_report": "Police report narrative",
}

_LABELS = {
    "bank_transfer": "an unauthorized bank transfer scam",
    "gift_card": "a gift card payment scam",
    "crypto": "a cryptocurrency investment scam",
    "marketplace": "an online marketplace scam",
    "account_takeover": "an account takeover",
    "romance": "a romance scam",
    "investment": "an investment fraud scheme",
    "other": "a financial scam",
}


def _fmt_amount(incident: Incident) -> str:
    if incident.amount_lost is None:
        return "an amount still being determined"
    return f"{incident.currency} {incident.amount_lost:,.2f}"


def _incident_facts(incident: Incident, evidence: list[IncidentEvidence], user: User) -> str:
    """Compact factual context block shared by all generators."""
    lines = [
        f"Victim name: {user.profile.display_name if user.profile and user.profile.display_name else '[YOUR NAME]'}",
        f"Incident type: {_LABELS.get(str(incident.incident_type.value if hasattr(incident.incident_type, 'value') else incident.incident_type), 'a financial scam')}",
        f"Amount lost: {_fmt_amount(incident)}",
        f"Date discovered: {incident.created_at.strftime('%B %d, %Y')}",
        f"Case notes: {incident.notes or 'none provided'}",
    ]
    for item in evidence[:6]:
        lines.append(f"Evidence ({item.evidence_type}): {item.label} — {item.content[:300]}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Deterministic templates (always work, no LLM required)
# ---------------------------------------------------------------------------

def _template_bank_dispute(incident: Incident, evidence: list[IncidentEvidence], user: User) -> str:
    name = user.profile.display_name if user.profile and user.profile.display_name else "[YOUR NAME]"
    label = _LABELS.get(str(incident.incident_type.value if hasattr(incident.incident_type, "value") else incident.incident_type), "a financial scam")
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    return f"""{today}

To: Fraud / Disputes Department
Re: Dispute of unauthorized transaction(s) — request for investigation and reversal

To whom it may concern,

I am writing to formally dispute one or more transactions on my account. On or
around {incident.created_at.strftime('%B %d, %Y')} I was targeted by {label},
and as a result {_fmt_amount(incident)} left my account without my informed,
legitimate authorization.

I request that you:
1. Open a fraud investigation and provide me a written claim or case number.
2. Reverse or provisionally credit the disputed amount as required under
   Regulation E / your zero-liability policy, as applicable.
3. Block further transfers, payees, or account changes originating from this
   incident, and preserve all related records.
4. Confirm in writing the outcome of the investigation and the timeline.

A timeline of events, preserved evidence, and a full case summary are
available in my Shield AI recovery case pack, which I can provide on request.

Sincerely,
{name}
[Account number: last 4 digits only]
[Phone number]
"""


def _template_ftc_complaint(incident: Incident, evidence: list[IncidentEvidence], user: User) -> str:
    label = _LABELS.get(str(incident.incident_type.value if hasattr(incident.incident_type, "value") else incident.incident_type), "a financial scam")
    return f"""FTC Complaint Draft — file at ReportFraud.ftc.gov

What happened (paste into the FTC form):

I was the victim of {label}. The incident began on or around
{incident.created_at.strftime('%B %d, %Y')}. I lost {_fmt_amount(incident)}.

{incident.notes or '[Describe in 2-3 sentences how the scammer first contacted you, what they claimed, and how the payment happened.]'}

I have preserved evidence of the incident (messages, receipts, and a timeline)
in a Shield AI recovery case pack and can provide it to investigators.

Checklist before you file:
- Have dates, amounts, and any phone numbers / emails / URLs the scammer used.
- Note how you paid (card, wire, gift card, crypto) — the FTC asks.
- After filing, save your FTC report number; banks and police will ask for it.
"""


def _template_police_report(incident: Incident, evidence: list[IncidentEvidence], user: User) -> str:
    name = user.profile.display_name if user.profile and user.profile.display_name else "[YOUR NAME]"
    label = _LABELS.get(str(incident.incident_type.value if hasattr(incident.incident_type, "value") else incident.incident_type), "a financial scam")
    ev_lines = "\n".join(
        f"- {item.label or item.evidence_type}: {item.content[:200]}" for item in evidence[:6]
    ) or "- Evidence preserved in Shield AI case pack (available on request)"
    return f"""Police Report Narrative — bring this to your local department or file online

Reporting party: {name}
Incident type: {label}
Date discovered: {incident.created_at.strftime('%B %d, %Y')}
Reported loss: {_fmt_amount(incident)}

Narrative:
{incident.notes or '[Describe what happened in your own words: first contact, what the scammer said, what you sent or shared, and when you realized it was a scam.]'}

Preserved evidence:
{ev_lines}

I request a report number for this incident so I can provide it to my bank,
the FTC, and any affected platforms.
"""


_TEMPLATES = {
    "bank_dispute": _template_bank_dispute,
    "ftc_complaint": _template_ftc_complaint,
    "police_report": _template_police_report,
}

_LLM_INSTRUCTIONS = {
    "bank_dispute": "a formal bank/card dispute letter demanding investigation, reversal or provisional credit, record preservation, and a written case number",
    "ftc_complaint": "the 'what happened' narrative for an FTC ReportFraud.ftc.gov complaint, first person, factual, chronological",
    "police_report": "a police report narrative: factual, chronological, first person, suitable for filing with a local department",
}


def generate_document(
    db: Session,
    incident: Incident,
    user: User,
    doc_type: str,
) -> dict:
    """Return {doc_type, title, body, personalized} for the requested document."""
    if doc_type not in DOC_TYPES:
        raise ValueError(f"Unknown document type: {doc_type}")

    evidence = (
        db.query(IncidentEvidence)
        .filter(IncidentEvidence.incident_id == incident.id)
        .order_by(IncidentEvidence.created_at)
        .all()
    )

    body = _TEMPLATES[doc_type](incident, evidence, user)
    personalized = False

    # Personalize with the LLM when configured; the template is both the
    # fallback and the structural example the model must follow.
    facts = _incident_facts(incident, evidence, user)
    llm = ai_analyzer.generate_text(
        instruction=(
            f"Write {_LLM_INSTRUCTIONS[doc_type]}. Use ONLY the facts provided — never "
            "invent transaction IDs, names, dates, or amounts; keep bracketed "
            "placeholders like [Account number] for anything unknown. Match the "
            "structure and tone of the example. Return only the document text."
        ),
        facts=facts,
        example=body,
    )
    if llm:
        body = llm
        personalized = True

    return {
        "doc_type": doc_type,
        "title": DOC_TYPES[doc_type],
        "body": body,
        "personalized": personalized,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
