"""Get-My-Money-Back — agentic-style scam recovery action pack."""
from __future__ import annotations

import re

from app.verticals.base import VerticalResult, VerticalSpec

# (key, pattern, tailored action)
_METHODS = [
    ("gift_card", re.compile(r"gift card|google play|apple card|steam card", re.I),
     "Call the gift-card issuer's fraud line immediately and report the card numbers."),
    ("bank_transfer", re.compile(r"wire transfer|western union|moneygram|bank transfer", re.I),
     "Call your bank's wire/fraud desk and request a recall — speed matters most here."),
    ("crypto", re.compile(r"crypto|bitcoin|\bbtc\b|usdt|ethereum|wallet", re.I),
     "Report the wallet address to the exchange and law enforcement; crypto is hard to reverse, so report fast."),
    ("p2p", re.compile(r"zelle|venmo|cash ?app|paypal", re.I),
     "Open a dispute in the payment app and call your bank to report the unauthorized transfer."),
    ("card", re.compile(r"credit card|debit card|card number", re.I),
     "Call your card issuer to dispute the charge and request a new card number."),
]


def analyze(text: str, ctx: dict) -> VerticalResult:
    methods: list[str] = []
    actions: list[str] = []
    for key, rx, action in _METHODS:
        if rx.search(text):
            methods.append(key)
            actions.append(action)

    amount = ctx.get("amount")
    # Higher urgency when a fast-moving method is involved, so the UI conveys priority.
    score = 70 if methods else 40

    steps = [
        "Stop all contact with the scammer and do not send anything more.",
        *actions,
        "File a report at reportfraud.ftc.gov and (for online crime) ic3.gov.",
        "Change passwords and enable 2FA on any affected accounts.",
        "Keep every receipt, screenshot, and message as evidence.",
    ]
    return VerticalResult(
        score=score,
        flags=actions or ["Tell us how you paid so we can tailor the recovery steps."],
        category=(methods[0] if methods else "other"),
        evidence={"methods": methods, "amount": amount},
        next_steps=steps,
        output_title="Your recovery action pack",
        output_artifact=_action_pack(text, methods, amount),
        content_for_llm=f"Scam/incident description:\n{text[:3000]}\nPayment methods: {methods}",
    )


def _action_pack(desc: str, methods: list[str], amount) -> str:
    amt = f"${amount:,.2f}" if isinstance(amount, (int, float)) else "(amount)"
    return (
        "RECOVERY ACTION PACK\n\n"
        f"What happened: {desc[:400]}\n"
        f"Amount at risk: {amt}\n"
        f"Payment method(s): {', '.join(methods) or 'unspecified'}\n\n"
        "BANK / PROVIDER DISPUTE (read aloud):\n"
        '  "I am reporting a fraudulent transfer made under false pretenses. I want to dispute '
        'it, request a recall/chargeback, and receive a case number."\n\n'
        "FTC REPORT: reportfraud.ftc.gov\n"
        "IC3 (FBI) REPORT: ic3.gov\n"
        "Keep this pack and all evidence together for your bank and any police report."
    )


SPEC = VerticalSpec(
    key="recovery",
    name="Get-My-Money-Back",
    tagline="Already hit? Get a step-by-step pack to dispute, report, and recover.",
    accent="#14b8a6",
    icon="cash-outline",
    input_label="Tell us what happened",
    input_placeholder="Describe what happened and how you paid (gift card, wire, crypto, Zelle, card)...",
    analyze=analyze,
    system_hint=(
        "You are a victim-recovery advocate. Someone may have just been scammed. Be calm and "
        "action-oriented: prioritize the fastest steps to stop the loss and recover funds, and "
        "name which authorities to contact."
    ),
    categories=("bank_transfer", "gift_card", "crypto", "p2p", "card", "other"),
)
