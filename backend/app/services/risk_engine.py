"""Risk scoring engine.

Combines deterministic signals (weighted, explainable) with optional LLM
output. The final score is a blend so the system never relies on prompting
alone — a core Phase 1 safety principle.
"""
from __future__ import annotations

import re

from app.models.models import RiskLevel

# Phrases that frequently appear in phishing / social-engineering content.
URGENCY_PATTERNS = [
    r"act now", r"within \d+ ?hour", r"in \d+ ?hour", r"immediately",
    r"final notice", r"last chance", r"expire", r"urgent", r"asap",
    r"account (is |has been |will be )?(suspended|locked|closed|disabled|restricted|frozen)",
    r"(suspended|locked|closed|disabled|restricted|frozen) (your )?account",
    r"verify (your )?(account|identity|details|information)?", r"verify now",
    r"unusual activity", r"suspicious activity", r"confirm your identity",
    r"last warning", r"lose access", r"avoid (suspension|deactivation)",
]
CREDENTIAL_PATTERNS = [
    r"enter your password", r"log ?in to (confirm|verify)", r"sign ?in to (confirm|verify)",
    r"update your payment", r"confirm your (password|pin|card|payment)",
    r"social security", r"\bssn\b", r"bank(ing)? (details|account)",
    r"card (number|details)", r"one[- ]time (code|password)",
    r"\botp\b", r"seed phrase", r"private key", r"wallet recovery",
    r"verification code", r"security code",
]
PAYMENT_SCAM_PATTERNS = [
    r"gift card", r"google play card", r"wire transfer", r"bitcoin", r"crypto",
    r"zelle", r"venmo", r"cash app", r"western union", r"refund of \$",
]

# (signal_key, points, human-readable flag)
DETERMINISTIC_WEIGHTS = [
    ("safe_browsing_hit", 60, "Flagged by Google Safe Browsing as malicious."),
    ("typosquat_brand", 35, "Domain imitates a well-known brand (possible typosquatting)."),
    ("homograph", 30, "Domain uses look-alike or non-standard characters (homograph attack)."),
    ("is_ip_host", 25, "Link points directly to a raw IP address instead of a domain."),
    ("suspicious_tld", 18, "Domain uses a top-level domain commonly abused by scams."),
    ("is_shortener", 12, "Link is hidden behind a URL shortener."),
    ("no_https", 10, "Connection is not encrypted (no HTTPS)."),
    ("very_new_domain", 25, "Domain was registered very recently."),
    ("multi_redirect", 12, "Link bounces through multiple redirects."),
]

THREAT_CATEGORIES = {
    "credential_theft": "Credential / Phishing",
    "payment_fraud": "Payment Fraud",
    "impersonation": "Brand Impersonation",
    "malware": "Malicious Site",
    "social_engineering": "Social Engineering",
    "unknown": "Unclassified",
}


def _match_any(text: str, patterns: list[str]) -> list[str]:
    low = (text or "").lower()
    return [p for p in patterns if re.search(p, low)]


def score_url_evidence(ev: dict) -> tuple[int, list[str]]:
    score, flags = 0, []
    signals = dict(ev)
    signals["no_https"] = not ev.get("uses_https", True)
    age = ev.get("domain_age_days")
    signals["very_new_domain"] = age is not None and age < 30
    signals["multi_redirect"] = ev.get("redirect_count", 0) >= 2

    for key, pts, msg in DETERMINISTIC_WEIGHTS:
        val = signals.get(key)
        if val:
            score += pts
            if key == "typosquat_brand":
                msg = f"Domain imitates '{val}' (possible typosquatting)."
            flags.append(msg)
    return score, flags


# A legitimately-delivered one-time code ("your code is 123456") is NOT a
# phishing request. Detect that shape so we don't flag real 2FA messages.
_DELIVERED_CODE_RE = re.compile(
    r"(your )?(verification|security|one[- ]time|login|access|otp) ?(code|password|pin)"
    r"\s*(is|:)\s*\d{4,8}|\bis\s+\d{4,8}\b.*(code|verification)",
    re.IGNORECASE,
)


def score_text_evidence(text: str) -> tuple[int, list[str], str]:
    score, flags = 0, []
    category = "unknown"
    low = (text or "").lower()

    # Benign 2FA / OTP delivery: code is given to the user, no link, no ask.
    delivered_code = bool(_DELIVERED_CODE_RE.search(text or ""))
    has_link = bool(re.search(r"https?://|www\.", low))
    has_actionable_ask = bool(
        re.search(r"click|tap|log ?in|sign ?in|confirm|verify your|update your|reply|call", low)
    )
    benign_code_delivery = delivered_code and not has_link and not has_actionable_ask

    urgency = _match_any(text, URGENCY_PATTERNS)
    creds = _match_any(text, CREDENTIAL_PATTERNS)
    payment = _match_any(text, PAYMENT_SCAM_PATTERNS)

    if benign_code_delivery:
        # Looks like a real delivered code with no phishing ask — don't score.
        return 0, [], "unknown"

    if urgency:
        score += 15
        flags.append("Uses urgency or pressure tactics to force a quick decision.")
        category = "social_engineering"
    if creds:
        score += 30
        flags.append("Requests sensitive credentials or verification codes.")
        category = "credential_theft"
    if payment:
        score += 30
        flags.append("Asks for payment via untraceable methods (gift cards, crypto, wire).")
        category = "payment_fraud"
    return score, flags, category


# Message-level signal weights (from message_analyzer.analyze_message signals).
# These give the deterministic engine real teeth on pasted SMS/chat content,
# independent of whether an embedded URL is in a threat database yet.
MESSAGE_SIGNAL_WEIGHTS = [
    ("authority_impersonation", 40, "Impersonates a government agency, bank, or official authority."),
    ("delivery_scam_signals", 30, "Matches delivery / package-fee scam patterns."),
    ("prize_scam_signals", 30, "Claims you won a prize or reward (advance-fee pattern)."),
    ("romance_scam_signals", 30, "Matches romance / investment scam patterns."),
    ("job_scam_signals", 25, "Contains job / quick-money scam indicators."),
    ("sms_with_link", 25, "Unsolicited SMS containing a clickable link (common smishing tactic)."),
    ("has_urgency", 15, "Uses urgency or time pressure to force a quick decision."),
]


def score_message_signals(signals: dict) -> tuple[int, list[str]]:
    """Convert message_analyzer deterministic signals into weighted score + flags."""
    score, flags = 0, []
    for key, pts, msg in MESSAGE_SIGNAL_WEIGHTS:
        if signals.get(key):
            score += pts
            flags.append(msg)
    return score, flags


def level_for_score(score: int) -> RiskLevel:
    if score >= 80:
        return RiskLevel.critical
    if score >= 60:
        return RiskLevel.high
    if score >= 35:
        return RiskLevel.suspicious
    if score >= 15:
        return RiskLevel.low
    return RiskLevel.safe


def default_actions(level: RiskLevel, category: str) -> list[str]:
    if level in (RiskLevel.critical, RiskLevel.high):
        base = [
            "Do not click the link, reply, or share any information.",
            "Do not enter passwords, codes, or payment details.",
        ]
        if category == "payment_fraud":
            base.append("Never pay with gift cards, crypto, or wire transfers on demand.")
        if category in ("credential_theft", "impersonation"):
            base.append("Contact the company directly using a number from their official website.")
        base.append("Delete the message and report it to the platform it came from.")
        return base
    if level == RiskLevel.suspicious:
        return [
            "Treat this as suspicious until verified.",
            "Verify the sender through an official, independent channel.",
            "Do not share personal or financial information.",
        ]
    if level == RiskLevel.low:
        return [
            "Looks mostly okay, but stay cautious.",
            "Double-check the sender if anything feels off.",
        ]
    return ["No strong red flags detected. Stay alert as always."]


def combine(
    deterministic_score: int,
    deterministic_flags: list[str],
    category: str,
    llm: dict | None,
) -> dict:
    """Blend deterministic score with optional LLM assessment."""
    det = min(deterministic_score, 100)
    flags = list(dict.fromkeys(deterministic_flags))
    confidence = 0.6 if det > 0 else 0.4
    explanation = ""
    final = det

    if llm:
        llm_score = int(llm.get("risk_score", det))
        # Weighted blend: deterministic gets priority, LLM nudges + explains.
        final = round(0.6 * det + 0.4 * llm_score)
        category = llm.get("threat_category", category) or category
        confidence = float(llm.get("confidence", confidence))
        explanation = llm.get("explanation", "")
        for f in llm.get("red_flags", []):
            if f not in flags:
                flags.append(f)

    final = max(0, min(final, 100))
    level = level_for_score(final)
    if not explanation:
        explanation = (
            "Assessment based on automated security checks of the link and/or "
            "extracted text. Review the red flags below before acting."
        )

    return {
        "risk_score": final,
        "risk_level": level.value,
        "threat_category": THREAT_CATEGORIES.get(category, category),
        "confidence": round(confidence, 2),
        "explanation": explanation,
        "red_flags": flags,
        "recommended_actions": default_actions(level, category),
    }
