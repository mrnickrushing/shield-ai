"""Fast URL verdicts for the live Safe Browser.

Unlike the full link-scan pipeline this runs in the WebView navigation path,
so it must answer in well under a second: no redirect expansion, no WHOIS,
no LLM, no scan-history writes. Deterministic heuristics + Google Web Risk,
with a two-layer cache (Redis when available, in-process fallback).
"""
from __future__ import annotations

import json
import time
from urllib.parse import urlparse

from app.core.config import settings
from app.services.url_enrichment import (
    SUSPICIOUS_TLDS,
    URL_SHORTENERS,
    _has_homograph,
    _is_ip_host,
    _looks_like_typosquat,
    check_safe_browsing,
    normalize_url,
)

CACHE_TTL_SECONDS = 15 * 60
_MEM_CACHE: dict[str, tuple[float, dict]] = {}
_MEM_CACHE_MAX = 5000

# Well-known destinations that skip the reputation call entirely. Matching is
# on the registrable domain, so subdomains (www., mail., …) are covered.
TRUSTED_DOMAINS = {
    "google.com", "youtube.com", "gmail.com", "facebook.com", "instagram.com",
    "whatsapp.com", "wikipedia.org", "amazon.com", "apple.com", "icloud.com",
    "microsoft.com", "live.com", "office.com", "netflix.com", "x.com",
    "twitter.com", "reddit.com", "github.com", "stackoverflow.com",
    "linkedin.com", "tiktok.com", "twitch.tv", "yahoo.com", "bing.com",
    "duckduckgo.com", "paypal.com", "ebay.com", "walmart.com", "target.com",
    "costco.com", "bestbuy.com", "etsy.com", "craigslist.org", "zillow.com",
    "chase.com", "bankofamerica.com", "wellsfargo.com", "capitalone.com",
    "fidelity.com", "schwab.com", "vanguard.com", "irs.gov", "usps.com",
    "ups.com", "fedex.com", "nytimes.com", "cnn.com", "bbc.com", "espn.com",
    "weather.com", "openai.com", "anthropic.com", "shieldai.rushingtechnologies.com",
}


def _is_trusted(host: str) -> bool:
    host = host.lower().rstrip(".")
    return any(host == d or host.endswith("." + d) for d in TRUSTED_DOMAINS)


def _redis():
    try:
        import redis

        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3, socket_timeout=0.3)
        client.ping()
        return client
    except Exception:
        return None


def _cache_get(key: str) -> dict | None:
    now = time.time()
    hit = _MEM_CACHE.get(key)
    if hit and hit[0] > now:
        return hit[1]
    r = _redis()
    if r is not None:
        try:
            raw = r.get(f"urlcheck:{key}")
            if raw:
                payload = json.loads(raw)
                _MEM_CACHE[key] = (now + CACHE_TTL_SECONDS, payload)
                return payload
        except Exception:
            pass
    return None


def _cache_set(key: str, payload: dict) -> None:
    if len(_MEM_CACHE) >= _MEM_CACHE_MAX:
        _MEM_CACHE.pop(next(iter(_MEM_CACHE)))
    _MEM_CACHE[key] = (time.time() + CACHE_TTL_SECONDS, payload)
    r = _redis()
    if r is not None:
        try:
            r.setex(f"urlcheck:{key}", CACHE_TTL_SECONDS, json.dumps(payload))
        except Exception:
            pass


def _verdict(score: int) -> str:
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "suspicious"
    if score >= 20:
        return "low"
    return "safe"


def check_url(url: str) -> dict:
    """Return {url, domain, verdict, score, reason, cached} quickly."""
    normalized = normalize_url(url)
    parsed = urlparse(normalized)
    host = (parsed.hostname or "").lower()
    key = f"{parsed.scheme}://{host}{parsed.path or '/'}"

    cached = _cache_get(key)
    if cached is not None:
        return {**cached, "cached": True}

    result: dict
    if not host:
        result = {"url": url, "domain": "", "verdict": "suspicious", "score": 50, "reason": "The address could not be parsed."}
    elif _is_trusted(host):
        result = {"url": url, "domain": host, "verdict": "safe", "score": 0, "reason": "Well-known trusted site."}
    else:
        score = 0
        reason = "No threats detected."
        tld = host.rsplit(".", 1)[-1] if "." in host else ""

        if check_safe_browsing(normalized):
            score, reason = 95, "Flagged as dangerous by Google's threat intelligence."
        else:
            typosquat = _looks_like_typosquat(host)
            if _has_homograph(host):
                score, reason = 75, "The address uses look-alike characters to impersonate a real site."
            elif typosquat:
                score, reason = 70, f"This address imitates {typosquat.title()} but is not the real site."
            elif _is_ip_host(host):
                score, reason = 55, "The site hides behind a raw IP address instead of a domain."
            elif tld in SUSPICIOUS_TLDS:
                score, reason = 45, "This site uses a domain ending commonly abused by scammers."
            elif host in URL_SHORTENERS:
                score, reason = 30, "Shortened link — the destination is hidden."
            if score > 0 and parsed.scheme != "https":
                score = min(score + 10, 100)

        result = {"url": url, "domain": host, "verdict": _verdict(score), "score": score, "reason": reason}

    _cache_set(key, result)
    return {**result, "cached": False}
