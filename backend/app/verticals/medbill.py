"""MedBill Shield — medical bill / EOB error + overcharge detector.

Parses a pasted bill/EOB into structured line items (description + CPT/HCPCS
code + amount), then flags the structurally-reliable problems: duplicate
charges, out-of-network / balance billing, and line items that sum to more than
the stated total. Produces a per-line verdict, an estimated overcharge, and an
itemized dispute letter.

Deliberately conservative: it does not guess "upcoding" or invent price
benchmarks (that needs a real fee-schedule dataset — a later slice). Everything
it flags is grounded in something on the page.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.verticals.base import VerticalResult, VerticalSpec

_MONEY = re.compile(r"\$\s?(\d[\d,]*(?:\.\d{2})?)")
# CPT (5 digits) or HCPCS (letter + 4 digits).
_CODE = re.compile(r"\b(\d{5}|[A-Z]\d{4})\b")
_OON = re.compile(r"out[- ]of[- ]network|balance bill|not covered|non[- ]covered", re.I)
_DUP_HINT = re.compile(r"duplicate|billed twice|same (charge|service)", re.I)
_TOTAL_LINE = re.compile(r"(?i)\b(total|amount due|balance due|subtotal)\b")
_TOTAL_AMOUNT = re.compile(
    r"(?im)\b(?:total|amount due|balance due)\b[^\n$]{0,30}\$\s?(\d[\d,]*(?:\.\d{2})?)"
)


def _money_to_float(s: str) -> float:
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return 0.0


@dataclass
class LineItem:
    raw: str
    description: str
    code: str
    amount: float
    status: str = "ok"  # ok | duplicate
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "description": self.description,
            "code": self.code,
            "amount": self.amount,
            "status": self.status,
            "reason": self.reason,
        }


def _parse_lines(text: str) -> list[LineItem]:
    """Turn each charge line into a structured item. Total/subtotal summary
    lines are skipped so they aren't mistaken for charges."""
    items: list[LineItem] = []
    for raw in text.splitlines():
        raw = raw.strip()
        if not raw or _TOTAL_LINE.search(raw):
            continue
        money = _MONEY.findall(raw)
        if not money:
            continue
        amount = _money_to_float(money[-1])  # last $ on the line is usually the charge
        without_money = _MONEY.sub(" ", raw)
        code_m = _CODE.search(without_money)
        code = code_m.group(1) if code_m else ""
        desc = _CODE.sub(" ", without_money).strip(" -\t:|.")
        items.append(
            LineItem(raw=raw, description=" ".join(desc.split())[:80], code=code, amount=amount)
        )
    return items


def analyze(text: str, ctx: dict) -> VerticalResult:
    items = _parse_lines(text)
    flags: list[str] = []
    score = 0
    category = "unknown"
    overcharge = 0.0

    # Duplicates: a charge keyed by (code or description) + amount appearing more
    # than once. The first occurrence is the legit charge; each extra copy is a
    # likely overcharge.
    counts: dict[tuple, int] = {}
    for it in items:
        key = (it.code or it.description.lower(), it.amount)
        counts[key] = counts.get(key, 0) + 1
        if counts[key] >= 2 and it.amount > 0:
            it.status = "duplicate"
            it.reason = "Same charge appears more than once."
            overcharge += it.amount

    if any(it.status == "duplicate" for it in items) or _DUP_HINT.search(text):
        score += 30
        flags.append("Possible duplicate charge — the same line appears more than once.")
        category = "duplicate_charge"

    if _OON.search(text):
        score += 25
        flags.append(
            "Mentions out-of-network / non-covered charges — a common surprise-billing pattern."
        )
        if category == "unknown":
            category = "balance_billing"

    # Math check anchored to an explicit "total / amount due" line; line items
    # already exclude the total line, so they should not exceed it.
    amounts = [it.amount for it in items if it.amount > 0]
    stated_totals = [_money_to_float(v) for v in _TOTAL_AMOUNT.findall(text)]
    if stated_totals and len(amounts) >= 2:
        total = max(stated_totals)
        rest = sum(amounts)
        if total and rest > total and (rest - total) / total > 0.05:
            score += 20
            flags.append(
                "Line items appear to sum to more than the stated total (possible math error)."
            )
            if category == "unknown":
                category = "math_error"

    coded = [it for it in items if it.code]
    if coded and not flags:
        flags.append(f"Detected {len(coded)} coded line item(s) to verify against your EOB.")

    estimated_total = (max(stated_totals) if stated_totals else sum(amounts)) or 0.0
    evidence = {
        "line_items": [it.to_dict() for it in items],
        "estimated_total": round(estimated_total, 2),
        "estimated_overcharge": round(overcharge, 2),
        "stated_total": round(max(stated_totals), 2) if stated_totals else None,
        "codes": [it.code for it in coded][:30],
    }
    next_steps = [
        "Request a fully itemized bill (every line, code, and price) from the provider.",
        "Match each charge against your insurer's Explanation of Benefits (EOB).",
        "Dispute the flagged lines below in writing and ask for a corrected bill.",
        "If unresolved, escalate to a billing supervisor and cite the specific lines.",
    ]
    return VerticalResult(
        score=score,
        flags=flags,
        category=category,
        evidence=evidence,
        next_steps=next_steps,
        output_title="Draft dispute letter",
        output_artifact=_dispute_letter(items, overcharge),
        content_for_llm=f"Medical bill / EOB text:\n{text[:3500]}",
    )


def _dispute_letter(items: list[LineItem], overcharge: float) -> str:
    flagged = [it for it in items if it.status != "ok"]
    if flagged:
        body_lines = "\n".join(
            f"  - {it.reason} {it.description or 'line item'}"
            + (f" (code {it.code})" if it.code else "")
            + f" — ${it.amount:,.2f}"
            for it in flagged
        )
    else:
        body_lines = "  - Please provide a fully itemized bill so each charge can be verified."
    over = (
        f" I have identified approximately ${overcharge:,.2f} in charges that appear incorrect."
        if overcharge
        else ""
    )
    return (
        "To the Billing Department,\n\n"
        f"I am writing to dispute charges on my recent statement.{over} "
        "Specifically:\n\n"
        f"{body_lines}\n\n"
        "Please review these items, correct any errors, and send a corrected, fully itemized "
        "bill. I am prepared to pay any balance verified as accurate and covered by my plan.\n\n"
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
