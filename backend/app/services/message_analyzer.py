"""Message analysis service — Phase 2.

Analyzes pasted SMS, chat messages, and marketplace threads for scam signals.
Deterministic patterns run before any LLM call — same principle as Phase 1.
"""
from __future__ import annotations

import re

DELIVERY_SCAM_PATTERNS = [
    r"package.*hold", r"delivery.*failed", r"usps.*parcel", r"fedex.*redelivery",
    r"confirm.*address", r"customs.*fee", r"duty.*payment", r"parcel.*detained",
    r"failed.*delivery.*attempt",
]

PRIZE_SCAM_PATTERNS = [
    r"won.*prize", r"selected.*winner", r"claim.*reward", r"congratulations.*won",
    r"lottery.*winner", r"free.*iphone", r"free.*gift", r"you.ve been selected",
]

ROMANCE_SCAM_PATTERNS = [
    r"met.*online", r"military.*overseas", r"investment.*together",
    r"crypto.*opportunity", r"foreign.*contract", r"transfer.*money",
]

JOB_SCAM_PATTERNS = [
    r"work.*from.*home", r"easy.*money", r"daily.*task.*pay",
    r"amazon.*hiring.*now", r"quick.*cash.*opportunity", r"part.time.*earn",
]

IMPERSONATION_PATTERNS = [
    r"irs.*contact", r"social security.*suspended", r"bank.*account.*suspended",
    r"medicare.*benefit", r"government.*grant", r"fbi.*warrant",
]

_URL_RE = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+')


def extract_urls(text: str) -> list[str]:
    return _URL_RE.findall(text)


def analyze_message(text: str, platform_hint: str = "") -> dict:
    """Run deterministic scam-pattern analysis on message text."""
    low = text.lower()
    signals: dict = {}
    flags: list[str] = []
    category = "unknown"

    # --- pattern groups ---
    if any(re.search(p, low) for p in DELIVERY_SCAM_PATTERNS):
        signals["delivery_scam_signals"] = True
        flags.append("Message matches delivery/package-fee scam patterns.")
        category = "impersonation"

    if any(re.search(p, low) for p in PRIZE_SCAM_PATTERNS):
        signals["prize_scam_signals"] = True
        flags.append("Message claims you won a prize or reward — a classic advance-fee pattern.")
        category = "social_engineering"

    if any(re.search(p, low) for p in ROMANCE_SCAM_PATTERNS):
        signals["romance_scam_signals"] = True
        flags.append("Message shows patterns consistent with romance or investment scams.")
        category = "social_engineering"

    if any(re.search(p, low) for p in JOB_SCAM_PATTERNS):
        signals["job_scam_signals"] = True
        flags.append("Message contains job/quick-money scam indicators.")
        category = "payment_fraud"

    if any(re.search(p, low) for p in IMPERSONATION_PATTERNS):
        signals["authority_impersonation"] = True
        flags.append("Message impersonates a government agency or official authority.")
        category = "impersonation"

    # --- embedded URLs ---
    urls = extract_urls(text)
    signals["extracted_url_count"] = len(urls)

    if urls:
        flags.append(f"Message contains {len(urls)} embedded link(s) — verify each before clicking.")

    if platform_hint == "sms" and urls:
        signals["sms_with_link"] = True
        flags.append("Unsolicited SMS containing a clickable link is a common smishing tactic.")

    # --- urgency / pressure ---
    urgency_hit = bool(re.search(r"act now|immediately|expire|within \d+ hour|last chance|final notice", low))
    signals["has_urgency"] = urgency_hit
    if urgency_hit:
        flags.append("Message uses urgency or time pressure to force a quick decision.")

    signals["char_count"] = len(text)
    signals["platform_hint"] = platform_hint

    return {
        "artifact_type": "message",
        "signals": signals,
        "flags": flags,
        "category": category,
        "extracted_urls": urls,
    }
