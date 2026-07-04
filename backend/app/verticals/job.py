"""JobShield — job offer & recruiter scam detector."""
from __future__ import annotations

import re

from app.verticals.base import VerticalResult, VerticalSpec

# (key, points, pattern, human-readable flag)
_RULES = [
    ("fake_check", 35, re.compile(r"cashier'?s? check|deposit (the|this) check|overpay|send .*difference", re.I),
     "Mentions checks / overpayment — a classic fake-check job scam."),
    ("advance_fee", 30, re.compile(r"(upfront|registration|training|onboarding) fee|pay .* to (start|begin)", re.I),
     "Asks you to pay money to get the job — legitimate employers never do this."),
    ("equipment_scam", 25, re.compile(r"purchase .*(equipment|laptop|gift card)|buy your own .*equipment", re.I),
     "Asks you to buy equipment or gift cards upfront."),
    ("offplatform", 20, re.compile(r"\b(telegram|whatsapp|signal)\b|text me at|chat on telegram", re.I),
     "Pushes you to an off-platform chat (Telegram/WhatsApp) — common for job scams."),
    ("too_good", 15, re.compile(r"no interview|hired immediately|guaranteed (job|income)|\$\d{3,}\s*(?:/|per )?\s*(?:day|week)\b", re.I),
     "Offer sounds too good (no interview / guaranteed high pay)."),
    ("data_harvest", 25, re.compile(r"social security|\bssn\b|bank (account|routing)|copy of your (id|passport)", re.I),
     "Requests sensitive personal/bank details before any real hiring step."),
]


def analyze(text: str, ctx: dict) -> VerticalResult:
    flags: list[str] = []
    found: list[str] = []
    score = 0
    category = "unknown"

    for key, pts, rx, msg in _RULES:
        if rx.search(text):
            score += pts
            flags.append(msg)
            found.append(key)
            if category == "unknown":
                category = key

    return VerticalResult(
        score=min(score, 100),
        flags=flags,
        category=category,
        evidence={"signals": found},
        next_steps=[
            "Never pay money or deposit a check to start a job.",
            "Verify the company through its official website and a known phone number.",
            "Confirm the recruiter's email domain matches the real company domain.",
            "Don't share SSN or bank details until you've signed a verified offer.",
        ],
        output_title="Recruiter red-flag summary",
        output_artifact="\n".join(f"- {f}" for f in flags)
        or "- No obvious job-scam signals detected. Still verify the company independently.",
        content_for_llm=f"Job posting / recruiter message:\n{text[:3500]}",
    )


SPEC = VerticalSpec(
    key="job",
    name="JobShield",
    tagline="Tell a real job offer from a scam before you share anything.",
    accent="#a855f7",
    icon="briefcase-outline",
    input_label="Paste the job post or recruiter message",
    input_placeholder="Paste a job listing, recruiter DM, or offer letter...",
    analyze=analyze,
    system_hint=(
        "You are a fraud analyst reviewing a job posting or recruiter message for employment-scam "
        "patterns (fake-check/overpayment, advance fees, equipment scams, off-platform chats, and "
        "premature requests for SSN or bank details)."
    ),
    categories=("fake_check", "advance_fee", "equipment_scam", "offplatform", "too_good", "data_harvest", "unknown"),
)
