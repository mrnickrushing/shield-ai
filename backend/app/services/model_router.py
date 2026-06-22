"""Model routing — Phase 5.

Maps scan artifact types to optimal LLM configuration. Keeps all routing
logic in one place so any model upgrade or A/B experiment touches only
this file.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LLMConfig:
    model: str
    temperature: float
    max_tokens: int
    system_hint: str


_ROUTE_TABLE: dict[str, LLMConfig] = {
    # URL / link scans — factual, Safe Browsing is authoritative
    "link": LLMConfig(
        model="claude-haiku-4-5-20251001",
        temperature=0.1,
        max_tokens=512,
        system_hint=(
            "You are a cybersecurity analyst evaluating URLs for phishing and malware. "
            "Be concise and factual. Prioritize the deterministic signals provided."
        ),
    ),
    # Screenshot / image — Sonnet for best visual reasoning (vision call handled separately)
    "image": LLMConfig(
        model="claude-sonnet-4-6",
        temperature=0.15,
        max_tokens=1024,
        system_hint=(
            "You are a cybersecurity expert specializing in visual phishing and screenshot analysis. "
            "Screenshots may show phishing login pages, fake invoices, tech-support scam popups, "
            "social engineering DMs, or brand-impersonation pages. "
            "Be aggressive about flagging suspicious content — missing a scam is far worse than a false positive. "
            "Focus on: brand logos/design copied from real companies, urgency banners, "
            "any request for credentials or payment, suspicious URLs visible on screen, "
            "fake security warnings, and any language pressuring the user to act immediately."
        ),
    ),
    # QR codes decode to URLs — same profile as link
    "qr": LLMConfig(
        model="claude-haiku-4-5-20251001",
        temperature=0.1,
        max_tokens=512,
        system_hint="You are a cybersecurity analyst evaluating QR code destinations for phishing and malware.",
    ),
    # SMS / chat — social engineering needs strong reasoning
    "message": LLMConfig(
        model="claude-sonnet-4-6",
        temperature=0.15,
        max_tokens=768,
        system_hint=(
            "You are a cybersecurity analyst evaluating text messages for social engineering, "
            "phishing, smishing, and scam patterns. "
            "Common patterns include: fake package delivery fees, government/IRS impersonation, "
            "prize/lottery fraud, romance scams, fake job offers, and bank account alerts. "
            "Be aggressive — sophisticated scams are designed to look legitimate. "
            "If something feels off, flag it even if you can't pin down the exact pattern."
        ),
    ),
    # Email — complex analysis; needs highest reasoning
    "email": LLMConfig(
        model="claude-sonnet-4-6",
        temperature=0.15,
        max_tokens=1024,
        system_hint=(
            "You are a cybersecurity analyst evaluating emails for spoofing, phishing, and business "
            "email compromise. Analyze sender legitimacy, reply-to mismatches, urgency manipulation, "
            "brand impersonation, embedded links, and requests for credentials or wire transfers. "
            "Treat any mismatch between the displayed sender name and the actual email domain as a "
            "serious red flag."
        ),
    ),
    # Phone — short input, fast response
    "phone": LLMConfig(
        model="claude-haiku-4-5-20251001",
        temperature=0.1,
        max_tokens=384,
        system_hint="You are a cybersecurity analyst evaluating phone numbers for scam and spam reputation.",
    ),
    # Marketplace listings — fraud pattern recognition
    "marketplace": LLMConfig(
        model="claude-sonnet-4-6",
        temperature=0.15,
        max_tokens=768,
        system_hint=(
            "You are a fraud analyst evaluating marketplace listings and conversations for scam patterns. "
            "Key patterns: overpayment scams (buyer sends too much, asks for refund), fake escrow services, "
            "pressure to move off-platform, rental scams, and fake payment confirmations. "
            "Be aggressive — marketplace fraud causes direct financial loss."
        ),
    ),
    # Social media — impersonation + investment fraud
    "social": LLMConfig(
        model="claude-sonnet-4-6",
        temperature=0.15,
        max_tokens=768,
        system_hint=(
            "You are a cybersecurity analyst evaluating social media content for fake giveaways, "
            "celebrity/brand impersonation, crypto investment lures, pig-butchering setups, "
            "account-takeover phishing, and romance scams. "
            "Verified accounts can be compromised — don't assume a blue check means it's safe."
        ),
    ),
}

_DEFAULT = LLMConfig(
    model="claude-haiku-4-5-20251001",
    temperature=0.2,
    max_tokens=512,
    system_hint="You are a cybersecurity analyst evaluating content for scams, phishing, and fraud.",
)


def get_config(artifact_type: str) -> LLMConfig:
    """Return the optimal LLM config for the given artifact type."""
    return _ROUTE_TABLE.get(artifact_type, _DEFAULT)
