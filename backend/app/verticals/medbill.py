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
from app.verticals.medbill_reference import REFERENCE_NOTE, lookup

# Only flag a charge as "high vs reference" at a large multiple, so the rough
# reference prices can't produce false alarms (providers legitimately bill above
# Medicare; a 5x+ charge is a fair thing to question).
OVER_REFERENCE_MULTIPLE = 5.0

_MONEY = re.compile(r"\$\s?(\d[\d,]*(?:\.\d{2})?)")
# CPT (5 digits) or HCPCS (letter + 4 digits).
_CODE = re.compile(r"\b(\d{5}|[A-Z]\d{4})\b")
_OON = re.compile(r"out[- ]of[- ]network|balance bill|not covered|non[- ]covered", re.I)
_DUP_HINT = re.compile(r"duplicate|billed twice|same (charge|service)", re.I)
# Unambiguous summary labels — these are essentially never a service description.
_SUMMARY_LABEL = re.compile(r"(?i)\b(amount due|balance due|sub[- ]?total|total due|grand total)\b")
_BARE_TOTAL = re.compile(r"(?i)\btotal\b")


def _money_to_float(s: str) -> float:
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return 0.0


def _is_summary_line(raw: str) -> bool:
    """Whether a row is a bill total/subtotal as opposed to a charge.

    "total" on its own is ambiguous (e.g. "Total knee replacement 27447 ..."),
    so a bare "total" only counts as a summary when the line carries no
    procedure code. Real charges keep their code and stay in the itemization.
    """
    if _SUMMARY_LABEL.search(raw):
        return True
    if _BARE_TOTAL.search(raw) and not _CODE.search(_MONEY.sub(" ", raw)):
        return True
    return False


@dataclass
class LineItem:
    raw: str
    description: str
    code: str
    amount: float
    status: str = "ok"  # ok | duplicate | over_reference
    reason: str = ""
    reference: float | None = None
    multiple: float | None = None

    def to_dict(self) -> dict:
        return {
            "description": self.description,
            "code": self.code,
            "amount": self.amount,
            "status": self.status,
            "reason": self.reason,
            "reference": self.reference,
            "multiple": self.multiple,
        }


def _parse(text: str) -> tuple[list[LineItem], list[float]]:
    """Single pass: charge rows become LineItems; summary rows yield stated totals."""
    items: list[LineItem] = []
    stated_totals: list[float] = []
    for raw in text.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        money = _MONEY.findall(raw)
        if _is_summary_line(raw):
            if money:
                stated_totals.append(_money_to_float(money[-1]))
            continue
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
    return items, stated_totals


def analyze(text: str, ctx: dict) -> VerticalResult:
    items, stated_totals = _parse(text)
    flags: list[str] = []
    score = 0
    category = "unknown"
    overcharge = 0.0

    # Duplicates: a charge keyed by (code or description) + amount appearing more
    # than once. The first occurrence is the legit charge; each extra copy is a
    # likely overcharge.
    counts: dict[tuple, int] = {}
    for it in items:
        if it.amount > 0:
            key = (it.code or it.description.lower(), it.amount)
            counts[key] = counts.get(key, 0) + 1
    dup_keys = {k for k, n in counts.items() if n >= 2}

    seen: dict[tuple, int] = {}
    for it in items:
        if it.amount <= 0:
            continue
        key = (it.code or it.description.lower(), it.amount)
        if key in dup_keys:
            seen[key] = seen.get(key, 0) + 1
            if seen[key] >= 2:  # mark only the extra copies; keeps the dispute letter clean
                it.status = "duplicate"
                it.reason = "Duplicate charge"
                overcharge += it.amount

    if dup_keys or _DUP_HINT.search(text):
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

    # Math check anchored to an explicit total/subtotal row; charge lines should
    # not sum to more than the stated total.
    amounts = [it.amount for it in items if it.amount > 0]
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

    # Price benchmark: flag coded charges that run far above a reference rate.
    over_reference: list[LineItem] = []
    for it in items:
        if it.status != "ok" or not it.code or it.amount <= 0:
            continue
        key = (it.code or it.description.lower(), it.amount)
        if key in dup_keys:
            continue  # a duplicated charge is reported as a duplicate, not over-reference
        ref = lookup(it.code)
        if ref and it.amount >= ref * OVER_REFERENCE_MULTIPLE:
            it.status = "over_reference"
            it.reference = ref
            it.multiple = round(it.amount / ref, 1)
            it.reason = f"Charged about {it.multiple:.0f}x a typical Medicare reference (~${ref:,.0f})"
            over_reference.append(it)
    if over_reference:
        score += 10
        flags.append(
            "Some charges are far above typical reference rates — ask the provider for the "
            f"cash/self-pay or negotiated rate. {REFERENCE_NOTE}"
        )

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
        "over_reference_count": len(over_reference),
        "reference_note": REFERENCE_NOTE,
    }
    next_steps = [
        "Request a fully itemized bill (every line, code, and price) from the provider.",
        "Match each charge against your insurer's Explanation of Benefits (EOB).",
        "Dispute the flagged issues below in writing and ask for a corrected bill.",
        "If unresolved, escalate to a billing supervisor and cite the specific lines.",
    ]
    return VerticalResult(
        score=score,
        flags=flags,
        category=category,
        evidence=evidence,
        next_steps=next_steps,
        output_title="Draft dispute letter",
        output_artifact=_dispute_letter(items, overcharge, flags),
        content_for_llm=f"Medical bill / EOB text:\n{text[:3500]}",
    )


def _dispute_letter(items: list[LineItem], overcharge: float, concerns: list[str]) -> str:
    bullets: list[str] = []
    has_line_dupes = False
    for it in items:
        if it.status != "ok":
            has_line_dupes = True
            bullets.append(
                f"{it.reason}: {it.description or 'line item'}"
                + (f" (code {it.code})" if it.code else "")
                + f" — ${it.amount:,.2f}"
            )
    # Fold in bill-level concerns (out-of-network, math error, ...) so an issue
    # that isn't tied to a single line still makes it into the letter.
    for c in concerns:
        if has_line_dupes and "duplicate" in c.lower():
            continue  # already itemized per line above
        bullets.append(c)
    if not bullets:
        bullets = ["Please provide a fully itemized bill so each charge can be verified."]

    over = (
        f" I have identified approximately ${overcharge:,.2f} in charges that appear incorrect."
        if overcharge
        else ""
    )
    body = "\n".join(f"  - {b}" for b in bullets)
    return (
        "To the Billing Department,\n\n"
        f"I am writing to dispute charges on my recent statement.{over} Specifically:\n\n"
        f"{body}\n\n"
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
    accepts_files=True,
)
