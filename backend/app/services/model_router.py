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
    # URL / link scans — factual, low creativity needed
    "link": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.1,
        max_tokens=512,
        system_hint="You are a cybersecurity analyst evaluating URLs for phishing and malware. Be concise and factual.",
    ),
    # Screenshot / image — needs richer reasoning over OCR text
    "image": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.2,
        max_tokens=768,
        system_hint="You are a cybersecurity analyst evaluating screenshot text for scams and fraud. Focus on visual deception tactics.",
    ),
    # QR codes decode to URLs — same profile as link
    "qr": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.1,
        max_tokens=512,
        system_hint="You are a cybersecurity analyst evaluating QR code destinations for phishing and malware.",
    ),
    # SMS / chat — needs social engineering understanding
    "message": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.2,
        max_tokens=640,
        system_hint="You are a cybersecurity analyst evaluating text messages for social engineering, phishing, and scam patterns.",
    ),
    # Email — complex headers + body; needs highest reasoning
    "email": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.15,
        max_tokens=896,
        system_hint="You are a cybersecurity analyst evaluating emails for spoofing, phishing, and business email compromise. Analyze sender legitimacy, reply-to mismatches, and urgency manipulation.",
    ),
    # Phone — short input, fast response preferred
    "phone": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.1,
        max_tokens=384,
        system_hint="You are a cybersecurity analyst evaluating phone numbers for scam and spam reputation.",
    ),
    # Marketplace listings — fraud pattern recognition
    "marketplace": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.2,
        max_tokens=640,
        system_hint="You are a fraud analyst evaluating marketplace listings for overpayment scams, fake escrow, and buyer/seller fraud.",
    ),
    # Social media posts — misinformation + social engineering
    "social": LLMConfig(
        model="gpt-4o-mini",
        temperature=0.2,
        max_tokens=640,
        system_hint="You are a cybersecurity analyst evaluating social media content for fake giveaways, impersonation, crypto lures, and account-takeover phishing.",
    ),
}

_DEFAULT = LLMConfig(
    model="gpt-4o-mini",
    temperature=0.2,
    max_tokens=512,
    system_hint="You are a cybersecurity analyst evaluating content for scams, phishing, and fraud.",
)


def get_config(artifact_type: str) -> LLMConfig:
    """Return the optimal LLM config for the given artifact type."""
    return _ROUTE_TABLE.get(artifact_type, _DEFAULT)
