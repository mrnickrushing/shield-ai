"""Risk scoring engine.

Combines deterministic signals (weighted, explainable) with optional LLM
output. The final score is a blend so the system never relies on prompting
alone — a core Phase 1 safety principle.

Blend weights are artifact-type-aware: URL/QR/phone favor deterministic
signals (Safe Browsing is authoritative); image/message/social favor the LLM
(OCR and keyword matching are error-prone, LLM reasoning is more reliable).
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

# Blend weights (deterministic_weight, llm_weight) by artifact type.
# For signals where deterministic is authoritative (URLs, Safe Browsing) we
# give it more weight. For artifacts where OCR / keyword matching is unreliable
# (images, chat messages, social) we trust the LLM more.
_BLEND_WEIGHTS: dict[str, tuple[float, float]] = {
    "link":        (0.60, 0.40),
    "qr":          (0.60, 0.40),
    "phone":       (0.65, 0.35),
    "email":       (0.45, 0.55),
    "message":     (0.35, 0.65),
    "image":       (0.25, 0.75),
    "marketplace": (0.40, 0.60),
    "social":      (0.35, 0.65),
}
_DEFAULT_BLEND = (0.45, 0.55)

# Brand impersonation: keywords indicating the message is taking action on
# an account at a well-known brand. Combined with a brand detection, this is
# a strong impersonation signal even without a URL present.
_ACCOUNT_ACTION_RE = re.compile(
    r"(suspend|lock|clos|disabl|restrict|freez|limit|verif|confirm|updat"
    r"|unauthori|unusual|suspicious|secur|alert|notice|action required"
    r"|account|password|sign.?in|log.?in)",
    re.IGNORECASE,
)


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


def score_brand_impersonation(text: str, detected_brands: list[str]) -> tuple[int, list[str]]:
    """Detect brand impersonation: a well-known brand is named alongside
    account-action language. This is a strong deterministic signal even when
    no URL or Safe Browsing hit is present."""
    if not detected_brands:
        return 0, []
    if _ACCOUNT_ACTION_RE.search(text or ""):
        brand_list = ", ".join(b.title() for b in detected_brands)
        return 40, [
            f"Mentions {brand_list} alongside account-action language — "
            "possible brand impersonation or phishing."
        ]
    return 0, []


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

    # Compound boost: urgency + credential request together is a stronger signal
    if urgency and creds:
        score += 15
        flags.append("Combines urgency with a credential request — classic phishing pattern.")

    return score, flags, category


# Message-level signal weights (from message_analyzer.analyze_message signals).
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
    if score >= 75:
        return RiskLevel.critical
    if score >= 55:
        return RiskLevel.high
    if score >= 30:
        return RiskLevel.suspicious
    if score >= 12:
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
    artifact_type: str = "unknown",
    ocr_failed: bool = False,
) -> dict:
    """Blend deterministic score with optional LLM assessment.

    Weights are artifact-type-aware — see _BLEND_WEIGHTS. A safety floor
    prevents the LLM's clear scam signal from being buried by a low
    deterministic score when keyword matching failed.
    """
    det = min(deterministic_score, 100)
    flags = list(dict.fromkeys(deterministic_flags))
    confidence = 0.6 if det > 0 else 0.4
    explanation = ""
    final = det

    if ocr_failed:
        flags.append("Image text could not be fully extracted — visual analysis may be incomplete.")
        confidence = min(confidence, 0.4)

    if llm:
        llm_score = int(llm.get("risk_score", det))
        det_w, llm_w = _BLEND_WEIGHTS.get(artifact_type, _DEFAULT_BLEND)
        final = round(det_w * det + llm_w * llm_score)

        # Safety floor: if the LLM is highly confident about a scam but the
        # deterministic engine missed it (keyword matching is brittle), don't
        # let the blend bury a genuine threat below "suspicious".
        llm_conf = float(llm.get("confidence", 0))
        if llm_score >= 70 and llm_conf >= 0.65 and final < 35:
            final = 35
        # Stronger floor: LLM says critical-level threat at high confidence
        if llm_score >= 85 and llm_conf >= 0.75 and final < 55:
            final = 55

        category = llm.get("threat_category", category) or category
        confidence = float(llm.get("confidence", confidence))
        if ocr_failed:
            confidence = min(confidence, 0.5)
        explanation = llm.get("explanation", "")
        for f in llm.get("red_flags", []):
            if f not in flags:
                flags.append(f)
    else:
        # LLM unavailable — note degraded analysis so user knows score may be low
        if det == 0:
            explanation = (
                "Automated checks found no clear signals, but full AI analysis was unavailable. "
                "If anything about this feels off, treat it as suspicious."
            )
            confidence = 0.2
        else:
            explanation = (
                "Assessment based on automated security checks. "
                "Full AI analysis was unavailable — review the red flags below before acting."
            )
            confidence = min(confidence, 0.5)

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
