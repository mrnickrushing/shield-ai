"""FinePrint — contract / lease / ToS / offer clause analyzer."""
from __future__ import annotations

import re

from app.verticals.base import VerticalResult, VerticalSpec

# (key, points, pattern, human-readable flag)
_CLAUSES = [
    ("auto_renewal", 15, re.compile(r"auto(?:matic)?(?:ally)?\s+renew|renews automatically|auto-renew", re.I),
     "Automatic renewal clause — you may be charged again unless you cancel in time."),
    ("arbitration_waiver", 15, re.compile(r"binding arbitration|waiv\w* .*class action|class action waiver", re.I),
     "Forces arbitration and/or waives your right to join a class action."),
    ("non_compete", 15, re.compile(r"non[- ]compete|noncompet|shall not .*compete", re.I),
     "Non-compete clause — may restrict your future work."),
    ("early_termination", 10, re.compile(r"early termination|termination fee|cancellation fee|break the lease", re.I),
     "Early-termination / cancellation fee."),
    ("junk_fees", 10, re.compile(r"non[- ]refundable|restocking fee|processing fee|late fee", re.I),
     "Non-refundable or add-on fees."),
    ("liability", 10, re.compile(r"indemnif|hold harmless|not be liable|limitation of liability", re.I),
     "Liability / indemnification shifted onto you."),
]

_QUESTIONS = {
    "auto_renewal": "How and by when exactly do I cancel to avoid automatic renewal?",
    "arbitration_waiver": "Can the arbitration / class-action waiver be struck or opted out of?",
    "non_compete": "What are the exact scope, duration, and geography of the non-compete?",
    "early_termination": "What is the precise early-termination fee and how is it calculated?",
    "junk_fees": "Which fees are refundable, and can any be waived in writing?",
    "liability": "What exactly am I being asked to be liable for or to indemnify?",
}


def analyze(text: str, ctx: dict) -> VerticalResult:
    flags: list[str] = []
    found: list[str] = []
    score = 0
    category = "unknown"

    for key, pts, rx, msg in _CLAUSES:
        if rx.search(text):
            score += pts
            flags.append(msg)
            found.append(key)
            if category == "unknown":
                category = key

    questions = [_QUESTIONS[k] for k in found]
    return VerticalResult(
        score=min(score, 100),
        flags=flags,
        category=category,
        evidence={"clauses_found": found},
        next_steps=questions
        or ["No high-risk clauses jumped out — still read the payment, cancellation, and renewal terms closely."],
        output_title="Questions to ask before you sign",
        output_artifact="\n".join(f"- {q}" for q in questions)
        or "- Confirm the total cost, cancellation terms, and renewal terms in writing.",
        content_for_llm=f"Contract / agreement text:\n{text[:3500]}",
    )


SPEC = VerticalSpec(
    key="contract",
    name="FinePrint",
    tagline="Spot the gotchas in a lease, offer, or contract before you sign.",
    accent="#0ea5e9",
    icon="document-text-outline",
    input_label="Paste the contract or terms",
    input_placeholder="Paste a lease, job offer, ToS, loan, or contractor agreement...",
    analyze=analyze,
    system_hint=(
        "You are a plain-English contract reviewer. Identify clauses that carry risk to the "
        "signer (auto-renewal, arbitration/class-action waivers, non-compete, fees, liability "
        "shifts) and list questions to ask. You are not a lawyer; flag what to check, do not "
        "give legal advice."
    ),
    categories=("auto_renewal", "arbitration_waiver", "non_compete", "early_termination", "junk_fees", "liability", "unknown"),
    accepts_files=True,
)
