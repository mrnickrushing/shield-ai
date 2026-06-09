"""Identity breach check service — Phase 3.

Queries HaveIBeenPwned API v3 for email breach data. Also offers a
k-anonymity password check (no API key required, full privacy).
Gracefully degrades to guidance-only mode when HIBP_API_KEY is not set.
"""
from __future__ import annotations

from app.core.config import settings

DISCLAIMER = (
    "Shield AI provides breach information from publicly available data sources "
    "for informational purposes only. This is not legal, financial, or security advice. "
    "Data may not be complete or current. Shield AI is not affiliated with HaveIBeenPwned."
)

CREDIT_FREEZE_GUIDANCE = [
    "Place a free credit freeze with all three major bureaus: Equifax, Experian, and TransUnion.",
    "Enable two-factor authentication on every account that supports it.",
    "Change passwords on accounts that used the same password as a breached service.",
    "Monitor your credit report at annualcreditreport.com (free, weekly checks available).",
    "Consider a fraud alert — filing with one bureau automatically notifies the other two.",
    "Review bank and credit card statements for any unauthorized charges.",
]

GENERAL_HYGIENE = [
    "Use a unique, randomly generated password for every account.",
    "A password manager (Bitwarden, 1Password, etc.) makes this practical.",
    "Passwords should be at least 14 characters.",
    "Enable biometric login or passkeys where available — they can't be phished.",
]


def check_breaches(email: str) -> dict:
    """Return breach data for the email. Falls back to empty list if no API key."""
    breaches = _query_hibp(email)
    breach_count = len(breaches)
    severity = _severity(breaches)
    actions = (CREDIT_FREEZE_GUIDANCE + GENERAL_HYGIENE) if breach_count > 0 else GENERAL_HYGIENE

    return {
        "email": email,
        "breach_count": breach_count,
        "severity": severity,
        "breaches": breaches,
        "actions": actions,
        "disclaimer": DISCLAIMER,
        "data_available": bool(settings.HIBP_API_KEY),
    }


def check_password_pwned(password: str) -> int:
    """
    k-Anonymity password check via HIBP Pwned Passwords.
    Returns how many times this password appeared in known breach databases.
    Never sends the full password — only a 5-character SHA-1 prefix.
    """
    import hashlib

    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        import httpx

        resp = httpx.get(
            f"https://api.pwnedpasswords.com/range/{prefix}",
            headers={"user-agent": "Shield-AI/3.0"},
            timeout=5.0,
        )
        for line in resp.text.splitlines():
            parts = line.split(":")
            if len(parts) == 2 and parts[0] == suffix:
                return int(parts[1])
    except Exception:
        pass
    return 0


def _severity(breaches: list[dict]) -> str:
    if not breaches:
        return "none"
    sensitive = {
        "Passwords", "Password hints", "Credit cards",
        "Bank account numbers", "Social security numbers",
        "Passport numbers", "Private messages",
    }
    has_sensitive = any(
        bool(set(b.get("data_classes", [])) & sensitive)
        for b in breaches
    )
    if len(breaches) >= 5 or has_sensitive:
        return "high"
    if len(breaches) >= 2:
        return "medium"
    return "low"


def _query_hibp(email: str) -> list[dict]:
    """Query HaveIBeenPwned API v3. Returns empty list if key missing or on error."""
    if not settings.HIBP_API_KEY:
        return []
    try:
        import httpx

        resp = httpx.get(
            f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}",
            headers={
                "hibp-api-key": settings.HIBP_API_KEY,
                "user-agent": "Shield-AI/3.0",
            },
            params={"truncateResponse": "false"},
            timeout=8.0,
        )
        if resp.status_code == 404:
            return []
        if resp.status_code == 200:
            return [
                {
                    "name": b["Name"],
                    "title": b["Title"],
                    "domain": b.get("Domain", ""),
                    "breach_date": b.get("BreachDate", ""),
                    "pwn_count": b.get("PwnCount", 0),
                    "data_classes": b.get("DataClasses", []),
                    "is_verified": b.get("IsVerified", False),
                }
                for b in resp.json()
            ]
    except Exception:
        pass
    return []
