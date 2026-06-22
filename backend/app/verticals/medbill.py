"""MedBill Shield — medical bill / EOB error + overcharge detector."""
from __future__ import annotations

import re

from app.verticals.base import VerticalResult, VerticalSpec

_MONEY = re.compile(r"\$\s?(\d[\d,]*(?:\.\d{2})?)")
_CPT = re.compile(r"\b\d{5}\b")
_OON = re.compile(r"out[- ]of[- ]network|balance bill|not covered|non[- ]covered", re.I)
_DUP_HINT = re.compile(r"duplicate|billed twice|same (charge|service)", re.I)


def _amounts(text: str) -> list[float]:
    out: list[float] = []
    for m in _MONEY.findall(text):
        try:
            out.append(float(m.replace(",", "")))
        except ValueError:
            pass
    return out


def analyze(text: str, ctx: dict) -> VerticalResult:
    flags: list[str] = []
    score = 0
    amounts = _amounts(text)
    codes = _CPT.findall(text)

    has_dupe = bool(_DUP_HINT.search(text)) or any(
        a > 0 and amounts.count(a) >= 2 for a in amounts
    )
    dupes = sorted({a for a in amounts if a > 0 and amounts.count(a) >= 2})
    category = "unknown"

    if has_dupe:
        score += 30
        flags.append("Possible duplicate charge — the same amount appears more than once.")
        category = "duplicate_charge"

    if _OON.search(text):
        score += 25
        flags.append("Mentions out-of-network / non-covered charges — a common surprise-billing pattern.")
        if category == "unknown":
            category = "balance_billing"

    # Simple math check: treat the largest amount as the stated total.
    if len(amounts) >= 3:
        total = max(amounts)
        rest = sum(a for a in amounts if a != total)
        if total and rest > total and (rest - total) / total > 0.05:
            score += 20
            flags.append("Line items appear to sum to more than the stated total (possible math error).")
            if category == "unknown":
                category = "math_error"

    if codes and not flags:
        flags.append(f"Detected {len(codes)} procedure code(s) to verify line-by-line against your EOB.")

    total_charges = max(amounts) if amounts else 0.0
    evidence = {
        "amounts_found": amounts[:20],
        "procedure_codes": codes[:20],
        "estimated_total": total_charges,
        "duplicate_amounts": dupes,
    }
    next_steps = [
        "Request a fully itemized bill (every line, code, and price) from the provider.",
        "Match each charge against your insurer's Explanation of Benefits (EOB).",
        "Dispute duplicate or out-of-network charges in writing and ask for corrected billing.",
        "If unresolved, escalate to a billing supervisor and cite the specific lines below.",
    ]
    return VerticalResult(
        score=score,
        flags=flags,
        category=category,
        evidence=evidence,
        next_steps=next_steps,
        output_title="Draft dispute letter",
        output_artifact=_dispute_letter(flags, total_charges),
        content_for_llm=f"Medical bill / EOB text:\n{text[:3500]}",
    )


def _dispute_letter(flags: list[str], total: float) -> str:
    issues = "\n".join(f"  - {f}" for f in flags) or "  - Itemization and code verification requested."
    amount = f" totaling approximately ${total:,.2f}" if total else ""
    return (
        "To the Billing Department,\n\n"
        f"I am writing to dispute charges on my recent statement{amount}. "
        "After review I have identified the following concerns:\n\n"
        f"{issues}\n\n"
        "Please provide a fully itemized bill and review these items for correction. "
        "I am prepared to pay any balance verified as accurate and covered by my plan.\n\n"
        "Sincerely,\n[Your name]"
    )


SPEC = VerticalSpec(
    key="medbill",
    name="MedBill Shield",
    tagline="Catch overcharges and errors on medical bills before you pay.",
    accent="#22c55e",
    icon="medkit-outline",
    input_label="Paste your bill or EOB",
    input_placeholder="Paste the line items, codes, and amounts from your medical bill or EOB...",
    analyze=analyze,
    system_hint=(
        "You are a medical billing advocate reviewing a patient's bill or EOB for errors "
        "and overcharges (duplicates, upcoding, unbundling, balance billing, math errors). "
        "Explain plainly what to question. Do not give medical advice."
    ),
    categories=("duplicate_charge", "upcoding", "unbundling", "balance_billing", "math_error", "unknown"),
)
