"""Call Guard — caller reputation + verification flow for the deepfake era."""
from __future__ import annotations

import re

from app.services import phone_lookup
from app.verticals.base import VerticalResult, VerticalSpec

_AUTH_CLAIM = re.compile(
    r"\b(bank|irs|ssa|social security|police|sheriff|microsoft|amazon|apple|grandson|grandchild|family)\b",
    re.I,
)
_URGENCY = re.compile(r"\b(urgent|immediately|right now|gift card|wire|bail|arrest|warrant|don'?t tell)\b", re.I)


def analyze(text: str, ctx: dict) -> VerticalResult:
    phone_ev = phone_lookup.analyze_phone(text)
    sig = phone_ev.get("signals", {})
    flags = list(phone_ev.get("flags", []))
    category = phone_ev.get("category", "unknown")

    score = 0
    if sig.get("known_scam_area_code"):
        score += 35
    if sig.get("premium_rate"):
        score += 50
    if sig.get("suspicious_pattern"):
        score += 15
    try:
        if int(sig.get("spam_score", 0) or 0) > 70:
            score += 45
    except (TypeError, ValueError):
        pass

    claim = str(ctx.get("claim", ""))
    if claim and _AUTH_CLAIM.search(claim) and _URGENCY.search(claim):
        score += 20
        flags.append(
            "Caller claims to be an authority or family member AND uses urgency or a payment "
            "demand — a hallmark of AI voice-cloning scams."
        )
        if category == "unknown":
            category = "impersonation"

    return VerticalResult(
        score=min(score, 100),
        flags=flags,
        category=category,
        evidence={"phone": phone_ev, "claim": claim},
        next_steps=[
            "Hang up. Do not act on anything said during the call.",
            "Call the bank/agency/person back using a number YOU look up independently.",
            "Agree on a family 'safe word' so voice-cloning calls can be verified.",
            "Never send gift cards, wire transfers, or codes because a caller pressured you.",
        ],
        output_title="Caller verification steps",
        output_artifact=(
            "Verify before you trust:\n"
            "1. Hang up and breathe.\n"
            "2. Look up the official number yourself (card back / official website).\n"
            "3. Call back and confirm the request independently.\n"
            "4. If 'family' is in trouble, call them directly and use your safe word."
        ),
        content_for_llm=f"Phone number: {text}\nCaller claim: {claim or '(none provided)'}",
    )


SPEC = VerticalSpec(
    key="call",
    name="Call Guard",
    tagline="Check a caller and verify before you trust — even a familiar voice.",
    accent="#f59e0b",
    icon="call-outline",
    input_label="Enter the phone number",
    input_placeholder="+1 555 123 4567",
    analyze=analyze,
    system_hint=(
        "You are a fraud analyst assessing a phone call for scam risk, including AI voice-cloning "
        "impersonation of banks, agencies, or family members. Emphasize independent call-back "
        "verification over anything said on the call."
    ),
    categories=("spam", "scam_likely", "impersonation", "payment_fraud", "social_engineering", "unknown"),
    input_multiline=False,
)
