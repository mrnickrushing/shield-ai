"""Marketplace scam analysis — Phase 3.

Detects buyer/seller scam patterns common on Facebook Marketplace, eBay,
Craigslist, OfferUp, and similar platforms. Deterministic patterns run
before any LLM call — consistent with Phase 1/2 architecture.
"""
from __future__ import annotations

import re

OVERPAYMENT_PATTERNS = [
    r"send.*more.*than.*asking", r"overpay.*refund", r"cashier.s check",
    r"certified check", r"money order.*difference", r"accidentally.*sent.*more",
    r"already.*paid.*too much", r"wire.*back.*difference", r"refund.*difference",
    r"check.*over.*price", r"\$\d+.*over.*price",
]

PAYMENT_BYPASS_PATTERNS = [
    r"pay.*outside.*platform", r"skip.*ebay", r"skip.*facebook",
    r"avoid.*fees", r"pay.*me.*directly", r"off.*platform.*payment",
    r"(zelle|venmo|cashapp|cash app|paypal friends).*instead",
]

SHIPPING_SCAM_PATTERNS = [
    r"ship.*before.*payment", r"overseas.*ship", r"out of town.*ship",
    r"military.*deployed.*ship", r"pay.*shipping.*first",
    r"refund.*after.*receive", r"send.*item.*then.*pay",
]

FAKE_ESCROW_PATTERNS = [
    r"our.*secure.*escrow", r"use.*escrow.*we.*recommend",
    r"buyer.*protection.*link", r"verify.*escrow.*service",
    r"escrow\.(xyz|top|online|site|io)",
]

RENTAL_SCAM_PATTERNS = [
    r"deposit.*first.*key", r"keys.*mailed.*after.*deposit",
    r"landlord.*overseas", r"property.*manager.*abroad",
    r"western union.*deposit", r"wire.*deposit.*before.*view",
]

TICKET_SCAM_PATTERNS = [
    r"transfer.*ticket.*after.*pay", r"can.t meet.*ticket",
    r"send.*ticket.*electronically", r"season.*ticket.*below.*face.*value",
    r"ticket.*barcode.*via.*email",
]

_URL_RE = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+')

_PLATFORM_KEYWORDS: dict[str, list[str]] = {
    "facebook_marketplace": ["facebook marketplace", "fb marketplace", "fbm"],
    "ebay": ["ebay"],
    "craigslist": ["craigslist", "cl."],
    "offerup": ["offerup", "offer up"],
    "mercari": ["mercari"],
}


def analyze_marketplace(text: str, platform_hint: str = "") -> dict:
    """Run deterministic scam-pattern analysis on marketplace content."""
    low = text.lower()
    signals: dict = {}
    flags: list[str] = []
    category = "unknown"

    if any(re.search(p, low) for p in OVERPAYMENT_PATTERNS):
        signals["overpayment_scam"] = True
        flags.append(
            "Overpayment scam indicator — buyer offers more than asking price "
            "and requests a refund of the difference via untraceable payment."
        )
        category = "payment_fraud"

    if any(re.search(p, low) for p in PAYMENT_BYPASS_PATTERNS):
        signals["payment_bypass"] = True
        flags.append(
            "Seller is steering payment off-platform, bypassing the marketplace's "
            "buyer-protection and dispute-resolution systems."
        )
        category = "payment_fraud"

    if any(re.search(p, low) for p in SHIPPING_SCAM_PATTERNS):
        signals["shipping_scam"] = True
        flags.append(
            "Request to ship before receiving payment, or involves a buyer "
            "claiming to be overseas or deployed — a common shipping scam."
        )
        if category == "unknown":
            category = "social_engineering"

    if any(re.search(p, low) for p in FAKE_ESCROW_PATTERNS):
        signals["fake_escrow"] = True
        flags.append(
            "References a third-party escrow service not provided by the marketplace "
            "— fake escrow sites are a primary tool in high-value item fraud."
        )
        category = "payment_fraud"

    if any(re.search(p, low) for p in RENTAL_SCAM_PATTERNS):
        signals["rental_scam"] = True
        flags.append(
            "Requires deposit or payment before in-person viewing, or landlord "
            "claims to be overseas — classic rental listing scam pattern."
        )
        category = "payment_fraud"

    if any(re.search(p, low) for p in TICKET_SCAM_PATTERNS):
        signals["ticket_scam"] = True
        flags.append(
            "Ticket sale requires transfer before payment or seller cannot meet — "
            "high risk of counterfeit or duplicate tickets."
        )
        if category == "unknown":
            category = "payment_fraud"

    # Detect platform
    platform = platform_hint
    if not platform:
        for name, keywords in _PLATFORM_KEYWORDS.items():
            if any(kw in low for kw in keywords):
                platform = name
                break
    signals["platform"] = platform or "unknown"

    urls = _URL_RE.findall(text)
    signals["extracted_urls"] = urls
    if urls:
        flags.append(f"Listing contains {len(urls)} external link(s) — verify before clicking.")

    if re.search(r"act fast|today only|selling fast|first come|urgent|expires tonight", low):
        signals["artificial_urgency"] = True
        flags.append("Artificial urgency used to rush the transaction — a common manipulation tactic.")

    signals["char_count"] = len(text)

    return {
        "artifact_type": "marketplace",
        "signals": signals,
        "flags": flags,
        "category": category,
        "extracted_urls": urls,
        "platform": platform or "unknown",
    }
