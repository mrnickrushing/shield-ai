"""URL parsing, expansion, and reputation enrichment.

Phase 1 deterministic signals run BEFORE any LLM call. These are cheap,
explainable, and high-signal.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app.core.config import settings

URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
    "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc",
}

SUSPICIOUS_TLDS = {
    "zip", "mov", "xyz", "top", "click", "country", "stream", "gq", "tk",
    "ml", "cf", "ga", "work", "support", "review", "loan", "win",
}

# Common brands frequently impersonated in phishing.
SENSITIVE_BRANDS = [
    # Payment / financial
    "paypal", "apple", "icloud", "microsoft", "amazon", "netflix", "chase",
    "wellsfargo", "bankofamerica", "coinbase", "binance", "usps", "fedex",
    "ups", "dhl", "irs", "facebook", "instagram", "google", "outlook",
    "mcafee", "norton", "lifelock", "webroot", "malwarebytes", "geek squad",
    "citibank", "citi", "capitalone", "usbank", "tdbank", "discover",
    "americanexpress", "amex", "hsbc", "venmo", "cashapp", "zelle",
    "robinhood", "kraken", "schwab", "fidelity",
    # Tech / subscriptions
    "adobe", "dropbox", "spotify", "disneyplus", "hulu", "linkedin",
    "tiktok", "snapchat", "whatsapp", "twitter", "steam", "playstation",
    "xbox", "roblox",
    # Telecom / retail
    "verizon", "at&t", "tmobile", "t-mobile", "xfinity", "comcast", "walmart", "target",
    "costco", "bestbuy",
    # Shipping / logistics
    "dpd", "ontrac",
    # Government / insurance
    "socialsecurity", "medicare", "dmv", "geico", "statefarm", "allstate",
    "progressive",
]


def normalize_url(url: str) -> str:
    url = url.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
        url = "http://" + url
    return url


def _is_ip_host(host: str) -> bool:
    return bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host))


def _looks_like_typosquat(domain: str) -> str | None:
    """Return the impersonated brand if the domain looks like a typosquat."""
    bare = domain.split(":")[0]
    for brand in SENSITIVE_BRANDS:
        if brand in bare and not bare.endswith(f"{brand}.com"):
            # brand appears but not as the registrable domain -> suspicious
            return brand
    return None


def _has_homograph(host: str) -> bool:
    # Non-ASCII (punycode / unicode) chars in a host are a homograph red flag.
    return any(ord(c) > 127 for c in host) or host.startswith("xn--")


def expand_url(url: str, timeout: float = 5.0) -> tuple[str, int]:
    """Follow redirects, returning (final_url, redirect_count)."""
    try:
        with httpx.Client(follow_redirects=True, timeout=timeout) as client:
            resp = client.head(url)
            return str(resp.url), len(resp.history)
    except Exception:
        return url, 0


# Threat types shared across both Google URL-reputation APIs.
_WEBRISK_THREAT_TYPES = ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]
_SB_THREAT_TYPES = [
    "MALWARE", "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION",
]


def _check_web_risk(url: str, key: str) -> bool | None:
    """Google Web Risk uris:search (the supported, non-deprecated API).
    Returns True/False on a definitive answer, or None if the API is
    unavailable/disabled so the caller can fall back."""
    params = [("key", key), ("uri", url)]
    params += [("threatTypes", t) for t in _WEBRISK_THREAT_TYPES]
    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.get(
                "https://webrisk.googleapis.com/v1/uris:search", params=params
            )
            if resp.status_code == 200:
                return bool(resp.json().get("threat"))
            # 403/SERVICE_DISABLED, etc. -> let caller try the legacy API
            return None
    except Exception:
        return None


def _check_safe_browsing_v4(url: str, key: str) -> bool | None:
    """Legacy Safe Browsing v4 threatMatches:find. Deprecated by Google but
    kept as a fallback for projects where it is still enabled."""
    endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={key}"
    body = {
        "client": {"clientId": "shield-ai", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": _SB_THREAT_TYPES,
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.post(endpoint, json=body)
            if resp.status_code == 200:
                return bool(resp.json().get("matches"))
            return None
    except Exception:
        return None


def check_safe_browsing(url: str) -> bool:
    """Check a URL against Google's threat lists. Prefers Web Risk (current
    API); falls back to legacy Safe Browsing v4. Returns True on a match.

    Both APIs use the same GOOGLE_SAFE_BROWSING_KEY. A None result from one
    API (unavailable/disabled) triggers the other; if both are unavailable
    we fail open (False) so detection degrades gracefully."""
    key = settings.GOOGLE_SAFE_BROWSING_KEY
    if not key:
        return False
    result = _check_web_risk(url, key)
    if result is None:
        result = _check_safe_browsing_v4(url, key)
    return bool(result)


def estimate_domain_age_days(domain: str) -> int | None:
    """Best-effort WHOIS creation-date lookup. Returns age in days or None."""
    try:
        import whois  # python-whois, optional

        info = whois.whois(domain)
        created = info.creation_date
        if isinstance(created, list):
            created = created[0]
        if created:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - created).days
    except Exception:
        return None
    return None


def enrich(url: str) -> dict:
    """Run the full deterministic enrichment pipeline for a URL."""
    normalized = normalize_url(url)
    parsed = urlparse(normalized)
    host = parsed.hostname or ""
    tld = host.rsplit(".", 1)[-1].lower() if "." in host else ""

    final_url, redirects = expand_url(normalized)
    final_host = urlparse(final_url).hostname or host

    age = estimate_domain_age_days(final_host) if final_host else None
    sb_hit = check_safe_browsing(normalized)
    typosquat = _looks_like_typosquat(final_host)

    return {
        "original_url": url,
        "normalized_url": normalized,
        "final_url": final_url,
        "domain": final_host,
        "tld": tld,
        "redirect_count": redirects,
        "is_shortener": host in URL_SHORTENERS,
        "is_ip_host": _is_ip_host(host),
        "suspicious_tld": tld in SUSPICIOUS_TLDS,
        "homograph": _has_homograph(host),
        "typosquat_brand": typosquat,
        "domain_age_days": age,
        "safe_browsing_hit": sb_hit,
        "uses_https": parsed.scheme == "https",
    }
