"""Family Guardian — protect a less tech-savvy family member from scams."""
from __future__ import annotations

from app.services import message_analyzer, risk_engine
from app.verticals.base import VerticalResult, VerticalSpec


def analyze(text: str, ctx: dict) -> VerticalResult:
    mev = message_analyzer.analyze_message(text, ctx.get("platform_hint", ""))
    text_score, text_flags, text_cat = risk_engine.score_text_evidence(text)
    sig_score, sig_flags = risk_engine.score_message_signals(mev["signals"])

    score = min(text_score + sig_score, 100)
    flags = list(dict.fromkeys(text_flags + sig_flags + mev["flags"]))
    category = mev["category"] if mev["category"] != "unknown" else text_cat
    level = risk_engine.level_for_score(score).value

    member = str(ctx.get("member_name") or "your family member")
    alert = (
        f"Shield Family alert: a message {member} received looks {level.upper()}-risk. "
        "Suggested: call them (don't text), make sure they don't click or pay, and review it together."
    )
    return VerticalResult(
        score=score,
        flags=flags,
        category=category,
        evidence={**mev, "level": level},
        next_steps=[
            f"Call {member} directly — don't text — and walk through it together.",
            "Tell them not to click links, share codes, or send money until you've checked.",
            "If money already moved, open a recovery case right away.",
            "Add yourself as a trusted contact so future high-risk scans alert you.",
        ],
        output_title="Guardian alert preview",
        output_artifact=alert,
        content_for_llm=f"Message a family member received:\n{text[:3500]}",
    )


SPEC = VerticalSpec(
    key="family",
    name="Family Guardian",
    tagline="A simple check for a parent — with alerts that reach the whole family.",
    accent="#f43f5e",
    icon="people-circle-outline",
    input_label="Paste what they received",
    input_placeholder="Paste the text, email, or message your family member got...",
    analyze=analyze,
    system_hint=(
        "You are helping an adult child protect a less tech-savvy parent from scams. Explain the "
        "risk in calm, simple language and give the family one clear next step."
    ),
    categories=("credential_theft", "payment_fraud", "impersonation", "social_engineering", "unknown"),
)
