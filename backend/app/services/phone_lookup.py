"""Phone number reputation service — Phase 2.

Pattern-based analysis runs deterministically; optional external API adds
carrier/line-type data when NUMVERIFY_API_KEY is configured.
"""
from __future__ import annotations

import re

from app.core.config import settings

# Caribbean and offshore area codes frequently abused in "one-ring" and toll scams.
_SCAM_AREA_CODES = {
    "268", "473", "664", "767", "784", "809", "829", "849",
    "868", "869", "876", "900",
}

_DIGITS_RE = re.compile(r"\D")


def normalize_phone(phone: str) -> str:
    return _DIGITS_RE.sub("", phone)


def _country_and_local(normalized: str) -> tuple[str, str]:
    if normalized.startswith("1") and len(normalized) == 11:
        return "1", normalized[1:]
    if normalized.startswith("44") and len(normalized) >= 11:
        return "44", normalized[2:]
    if normalized.startswith("61") and len(normalized) >= 11:
        return "61", normalized[2:]
    return "", normalized


def analyze_phone(phone_number: str) -> dict:
    normalized = normalize_phone(phone_number)
    signals: dict = {"normalized_number": normalized}
    flags: list[str] = []
    category = "unknown"

    country_code, local = _country_and_local(normalized)
    signals["country_code"] = country_code or "unknown"

    # North-American Numbering Plan scam area codes
    if country_code == "1" and len(local) >= 3:
        area = local[:3]
        if area in _SCAM_AREA_CODES:
            signals["known_scam_area_code"] = True
            flags.append(
                f"Area code {area} is frequently associated with international toll-scam "
                "and 'one-ring' calls that charge premium rates when returned."
            )
            category = "social_engineering"

    # Short codes (5–6 digits) used in bulk SMS / smishing campaigns
    if 4 <= len(normalized) <= 6:
        signals["is_short_code"] = True
        flags.append("Short-code numbers are often used in bulk SMS campaigns and smishing.")

    # US premium-rate 900 numbers
    if normalized.startswith("1900") or normalized.startswith("900"):
        signals["premium_rate"] = True
        flags.append("900-numbers are premium-rate lines that charge the caller high per-minute fees.")
        category = "payment_fraud"

    # Suspicious repeating-digit pattern (e.g. 1234567890 is fine; 1111111111 is not)
    if len(normalized) > 4 and len(set(normalized)) <= 2:
        signals["suspicious_pattern"] = True
        flags.append("Phone number has a suspicious repeating-digit pattern.")

    # Optional external lookup
    external = _external_lookup(phone_number)
    if external:
        signals.update(external)
        if int(external.get("spam_score", 0)) > 70:
            flags.append("This number has been reported by multiple users as spam or scam.")
            if category == "unknown":
                category = "social_engineering"

    return {
        "artifact_type": "phone",
        "signals": signals,
        "flags": flags,
        "category": category,
        "normalized_number": normalized,
    }


def _external_lookup(phone: str) -> dict | None:
    if not settings.NUMVERIFY_API_KEY:
        return None
    try:
        import httpx

        resp = httpx.get(
            "https://apilayer.net/api/validate",
            params={"access_key": settings.NUMVERIFY_API_KEY, "number": phone, "format": 1},
            timeout=5.0,
        )
        data = resp.json()
        return {
            "valid": data.get("valid", False),
            "carrier": data.get("carrier", ""),
            "line_type": data.get("line_type", ""),
            "location": data.get("location", ""),
        }
    except Exception:
        return None
