"""Social media scam analysis — Phase 3.

Detects fake giveaways, brand/celebrity impersonation, crypto investment
lures, account-takeover phishing, and romance patterns specific to social
media platforms (Instagram, Facebook, Twitter/X, TikTok, YouTube, etc.).
"""
from __future__ import annotations

import re

GIVEAWAY_PATTERNS = [
    r"like.*share.*win", r"follow.*win.*prize", r"dm.*to.*claim",
    r"retweet.*win", r"share.*giveaway", r"100.*winner.*selected",
    r"randomly.*selected.*follower", r"congratulations.*follower",
    r"comment.*win.*iphone", r"tag.*friend.*win",
]

CRYPTO_LURE_PATTERNS = [
    r"double.*bitcoin", r"double.*crypto", r"guaranteed.*return",
    r"invest.*now.*profit", r"trading.*expert.*teach",
    r"made.*\$\d+.*trading", r"passive.*income.*crypto",
    r"exclusive.*investment.*opportunity", r"blockchain.*profit",
    r"send.*btc.*receive.*back.*double",
]

IMPERSONATION_PATTERNS = [
    r"official.*giveaway.*dm", r"celebrity.*dm.*prize",
    r"verified.*account.*sending", r"elon.*musk.*send.*back",
    r"official.*support.*dm", r"brand.*giveaway.*dm",
]

ACCOUNT_TAKEOVER_PATTERNS = [
    r"account.*suspend.*\d+.*hour", r"your.*page.*will.*be.*removed",
    r"violat.*community.*standard", r"appeal.*click.*here",
    r"confirm.*identity.*immediately", r"account.*restricted.*verify",
    r"unusual.*login.*activity.*secure.*now",
]

PHISHING_DM_PATTERNS = [
    r"your.*post.*been.*flagged", r"meta.*business.*support",
    r"instagram.*support.*team.*dm", r"facebook.*help.*center.*dm",
    r"tiktok.*verify.*account.*link", r"youtube.*policy.*violation.*dm",
    r"platform.*suspend.*unless.*verify",
]

PIG_BUTCHERING_PATTERNS = [
    r"met.*online.*invest", r"successful.*trader.*teach",
    r"crypto.*platform.*exclusive", r"profit.*screenshot",
    r"withdraw.*profits.*small.*fee", r"investment.*platform.*friend",
]

_URL_RE = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+')

_PLATFORMS = [
    "instagram", "facebook", "twitter", "tiktok", "youtube",
    "snapchat", "linkedin", "reddit", "telegram", "discord",
]


def analyze_social(text: str, platform: str = "") -> dict:
    """Run deterministic scam-pattern analysis on social media content."""
    low = text.lower()
    signals: dict = {}
    flags: list[str] = []
    category = "unknown"

    if any(re.search(p, low) for p in GIVEAWAY_PATTERNS):
        signals["fake_giveaway"] = True
        flags.append(
            "Matches fake giveaway patterns — legitimate giveaways never require "
            "you to DM, follow, or click a link to claim a prize."
        )
        category = "social_engineering"

    if any(re.search(p, low) for p in CRYPTO_LURE_PATTERNS):
        signals["crypto_investment_lure"] = True
        flags.append(
            "Promotes guaranteed crypto returns or investment opportunities — "
            "a hallmark of pig-butchering and Ponzi financial scams."
        )
        category = "payment_fraud"

    if any(re.search(p, low) for p in IMPERSONATION_PATTERNS):
        signals["impersonation"] = True
        flags.append(
            "Appears to impersonate a celebrity, public figure, or official brand "
            "account to lend false credibility to a scam."
        )
        category = "impersonation"

    if any(re.search(p, low) for p in ACCOUNT_TAKEOVER_PATTERNS):
        signals["account_takeover_attempt"] = True
        flags.append(
            "Threatens account suspension and urges immediate action — "
            "a classic credential-phishing pattern targeting social media users."
        )
        category = "credential_theft"

    if any(re.search(p, low) for p in PHISHING_DM_PATTERNS):
        signals["phishing_dm"] = True
        flags.append(
            "Impersonates platform support via DM — real platforms never ask for "
            "account credentials or payment through direct messages."
        )
        category = "impersonation"

    if any(re.search(p, low) for p in PIG_BUTCHERING_PATTERNS):
        signals["pig_butchering"] = True
        flags.append(
            "Matches pig-butchering / romance-investment scam patterns — "
            "where trust is built before introducing a fraudulent investment platform."
        )
        category = "payment_fraud"

    # Detect platform
    detected = platform
    if not detected:
        for p in _PLATFORMS:
            if p in low:
                detected = p
                break
    signals["platform"] = detected or "unknown"

    urls = _URL_RE.findall(text)
    signals["extracted_urls"] = urls
    if urls:
        flags.append(f"Post/message contains {len(urls)} external link(s) — verify before clicking.")

    signals["char_count"] = len(text)

    return {
        "artifact_type": "social",
        "signals": signals,
        "flags": flags,
        "category": category,
        "extracted_urls": urls,
        "platform": detected or "unknown",
    }
