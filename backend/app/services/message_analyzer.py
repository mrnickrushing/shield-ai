"""Message analysis service — Phase 2.

Analyzes pasted SMS, chat messages, and marketplace threads for scam signals.
Deterministic patterns run before any LLM call — same principle as Phase 1.
"""
from __future__ import annotations

import re

DELIVERY_SCAM_PATTERNS = [
    r"package.*hold", r"delivery.*failed", r"usps.*parcel", r"fedex.*redelivery",
    r"confirm.*address", r"customs.*fee", r"duty.*payment", r"parcel.*detained",
    r"failed.*delivery.*attempt", r"shipping.*label.*issue", r"redelivery.*fee",
]

PRIZE_SCAM_PATTERNS = [
    r"won.*prize", r"selected.*winner", r"claim.*reward", r"congratulations.*won",
    r"lottery.*winner", r"free.*iphone", r"free.*gift", r"you.ve been selected",
]

ROMANCE_SCAM_PATTERNS = [
    r"met.*online", r"military.*overseas", r"investment.*together",
    r"crypto.*opportunity", r"foreign.*contract", r"transfer.*money",
    r"trading.*platform.*profit", r"guaranteed.*(profit|return)s?",
    r"double.*your.*(investment|money)", r"send.*more.*to.*withdraw",
]

JOB_SCAM_PATTERNS = [
    r"work.*from.*home", r"easy.*money", r"daily.*task.*pay",
    r"amazon.*hiring.*now", r"quick.*cash.*opportunity", r"part.time.*earn",
    r"telegram.*(job|recruiter)", r"whatsapp.*(job|recruiter)",
    r"product tester.*paid", r"complete.*tasks?.*earn.*(crypto|commission)",
    r"recruiter.*reached out.*(telegram|whatsapp)",
]

IMPERSONATION_PATTERNS = [
    r"irs.*contact", r"social security.*suspended", r"bank.*account.*suspended",
    r"medicare.*benefit", r"government.*grant", r"fbi.*warrant",
    r"social security (administration|number).*(suspend|deactivat|frozen)",
    r"ssn.*(suspended|compromised)", r"dmv.*(suspend|fine|violation)",
    r"warrant.*(arrest|issued)", r"failure to (respond|comply).*legal action",
]

# Toll-road / parking smishing — one of the highest-volume SMS scam vectors
# (fake "you owe an unpaid toll" texts impersonating E-ZPass, FasTrak, SunPass).
TOLL_SCAM_PATTERNS = [
    r"unpaid toll", r"outstanding toll", r"toll.*(balance|violation|invoice)",
    r"e-?z ?pass", r"fastrak", r"sunpass", r"toll.*(pay|settle).*avoid",
    r"pay.*toll.*(fee|fine)", r"parking.*(violation|citation).*pay",
]

# Tech-support scams — fake virus alerts / "call this number" / remote-access tools.
TECH_SUPPORT_SCAM_PATTERNS = [
    r"computer.*(infected|compromised)", r"virus.*detected", r"security alert.*windows",
    r"call.*(microsoft|apple|amazon).*support", r"your ip.*(compromised|flagged)",
    r"remote access", r"teamviewer", r"anydesk", r"geek squad.*renewal",
    r"unusual.*sign.?in.*device", r"your device.*at risk",
]

# Family-emergency / "grandparent" scams — including AI voice-clone variants
# ("this is my new number, I'm in trouble") that surface as texts first.
FAMILY_EMERGENCY_PATTERNS = [
    r"this is my new number", r"lost my (old )?phone", r"i'?m in jail",
    r"need bail", r"don'?t tell (mom|dad|anyone)", r"i'?ve been in an accident",
    r"stuck (at|in).*(hospital|airport|border)", r"send money (right away|urgently|now)",
    r"can'?t talk.*(call|text) me.*money", r"emergency.*wire.*money",
]

# Business email compromise / CEO fraud — "are you available" pretexting
# followed by a gift-card or wire request, often impersonating a boss/exec.
BEC_PATTERNS = [
    r"are you available right now", r"i need a favor", r"keep this between us",
    r"can you do something for me (quickly|right now)",
    r"wire.*(new|updated) account", r"vendor.*payment.*update",
    r"change.*bank(ing)? details", r"updated.*wiring instructions",
    r"need you to (buy|send).*gift card.*urgent",
]

# Fake bank-fraud-alert smishing ("Did you spend $X at Y? Reply YES/NO") that
# leads to a follow-up phishing call/link once the victim replies.
BANK_ALERT_SMISHING_PATTERNS = [
    r"did you (authorize|make|attempt).*(charge|transaction|purchase|payment)",
    r"reply (yes|no|stop).*(confirm|verify|cancel)",
    r"unusual.*transaction.*detected", r"your card.*(locked|frozen|suspended)",
    r"suspicious.*charge.*your (card|account)",
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

    if any(re.search(p, low) for p in TOLL_SCAM_PATTERNS):
        signals["toll_scam_signals"] = True
        flags.append("Message matches fake unpaid-toll smishing patterns (E-ZPass/FasTrak/SunPass impersonation).")
        category = "payment_fraud"

    if any(re.search(p, low) for p in TECH_SUPPORT_SCAM_PATTERNS):
        signals["tech_support_scam_signals"] = True
        flags.append("Message matches tech-support scam patterns (fake virus alert, remote-access request).")
        category = "social_engineering"

    if any(re.search(p, low) for p in FAMILY_EMERGENCY_PATTERNS):
        signals["family_emergency_signals"] = True
        flags.append("Message matches family-emergency / 'grandparent scam' patterns demanding urgent money.")
        category = "social_engineering"

    if any(re.search(p, low) for p in BEC_PATTERNS):
        signals["bec_signals"] = True
        flags.append("Message matches business email compromise / CEO-fraud pretexting patterns.")
        category = "social_engineering"

    if any(re.search(p, low) for p in BANK_ALERT_SMISHING_PATTERNS):
        signals["bank_alert_smishing_signals"] = True
        flags.append("Message mimics a bank fraud alert to bait a reply, a common smishing setup.")
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
