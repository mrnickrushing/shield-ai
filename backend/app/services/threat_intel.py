"""Threat intelligence pre-filter — Phase 5.

Checks scan input against the analyst-reviewed ScamPattern library before
the LLM call. Matching patterns contribute deterministic score boosts and
flags that are blended with the main risk engine output.
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models.models import ScamPattern, ScanType


def check_patterns(
    db: Session | None,
    text: str,
    artifact_type: str,
) -> tuple[int, list[str]]:
    """
    Return (score_boost, flag_messages) for all active ScamPatterns
    that match *text* and apply to *artifact_type*.
    """
    if db is None:
        return 0, []

    patterns: list[ScamPattern] = (
        db.query(ScamPattern)
        .filter(
            ScamPattern.is_active.is_(True),
        )
        .all()
    )

    total_boost = 0
    flags: list[str] = []
    low = text.lower()

    for p in patterns:
        if p.artifact_types and artifact_type not in p.artifact_types:
            continue

        matched = False
        data = p.pattern_data if isinstance(p.pattern_data, dict) else {}
        if p.pattern_type == "regex":
            regex = data.get("regex", "")
            flags_str = data.get("flags", "i")
            if not isinstance(regex, str):
                regex = ""
            if not isinstance(flags_str, str):
                flags_str = "i"
            re_flags = re.IGNORECASE if "i" in flags_str else 0
            try:
                if regex and re.search(regex, text, re_flags):
                    matched = True
            except re.error:
                pass
        elif p.pattern_type == "keyword":
            keywords = data.get("keywords", [])
            if isinstance(keywords, list) and any(isinstance(kw, str) and kw.lower() in low for kw in keywords):
                matched = True

        if matched:
            total_boost += p.risk_score_boost
            flags.append(
                f"[ThreatIntel] Matched pattern '{p.name}': {p.description}"
            )

    return total_boost, flags


def seed_default_patterns(db: Session) -> int:
    """Seed a handful of baseline patterns if the table is empty. Returns how
    many patterns were added."""
    if db.query(ScamPattern).count() > 0:
        return 0

    defaults = [
        ScamPattern(
            name="irs_impersonation",
            description="IRS / tax authority impersonation demanding immediate payment",
            pattern_type="regex",
            artifact_types=["message", "email", "phone"],
            pattern_data={"regex": r"irs.*arrest|tax.*warrant.*immediate|call.*irs.*immediately", "flags": "i"},
            risk_score_boost=55,
            category="government_impersonation",
            source="analyst",
        ),
        ScamPattern(
            name="cryptocurrency_doubling",
            description="Crypto doubling / giveaway scam",
            pattern_type="regex",
            artifact_types=["message", "social", "email"],
            pattern_data={"regex": r"send.*btc.*get.*back|double.*crypto.*send|elon.*musk.*bitcoin.*giveaway", "flags": "i"},
            risk_score_boost=60,
            category="payment_fraud",
            source="analyst",
        ),
        ScamPattern(
            name="gift_card_payment_demand",
            description="Demands payment via gift card — never a legitimate request",
            pattern_type="regex",
            artifact_types=["message", "email"],
            pattern_data={"regex": r"(google play|itunes|amazon|walmart).*gift card.*pay|pay.*gift card.*code", "flags": "i"},
            risk_score_boost=70,
            category="payment_fraud",
            source="analyst",
        ),
        ScamPattern(
            name="lottery_winning_unsolicited",
            description="Unsolicited lottery / prize winning notification",
            pattern_type="regex",
            artifact_types=["message", "email", "social"],
            pattern_data={"regex": r"(selected|chosen|winner).*lottery|claim.*prize.*fee|unclaimed.*winning", "flags": "i"},
            risk_score_boost=45,
            category="social_engineering",
            source="analyst",
        ),
        ScamPattern(
            name="grandparent_scam",
            description="Emergency family member in trouble requiring immediate wire transfer",
            pattern_type="keyword",
            artifact_types=["message", "phone"],
            pattern_data={"keywords": ["grandson in trouble", "bail money urgent", "don't tell mom", "secret emergency wire"]},
            risk_score_boost=50,
            category="social_engineering",
            source="analyst",
        ),
    ]
    for p in defaults:
        db.add(p)
    db.commit()
    return len(defaults)
