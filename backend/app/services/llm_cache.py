"""Dedupe cache for LLM analysis results.

Identical scan content (same URL, message, screenshot, ...) produces the same
verdict, so we key the model output on a hash of the exact request and reuse
it within a TTL instead of paying for a repeat Anthropic call. This is what
protects margin against a user (or a script) scanning the same thing over and
over — we pay for the first call and serve the rest from cache.

Mirrors url_check's two-layer approach: Redis when available (shared across
workers), with an in-process fallback. Degrades to a plain no-op miss when
neither is reachable, so caching can never break a scan.
"""
from __future__ import annotations

import hashlib
import json
import time

from app.core.config import settings

_MEM_CACHE: dict[str, tuple[float, dict]] = {}
_MEM_CACHE_MAX = 500


def cache_key(*parts: object) -> str:
    """Stable hash over the parts that determine an LLM response."""
    hasher = hashlib.sha256()
    for part in parts:
        hasher.update(repr(part).encode("utf-8", "ignore"))
        hasher.update(b"\x00")
    return hasher.hexdigest()


def _redis():
    if not settings.LLM_CACHE_TTL_SECONDS:
        return None
    try:
        import redis

        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3, socket_timeout=0.3)
        client.ping()
        return client
    except Exception:
        return None


def get_cached(key: str) -> dict | None:
    if not settings.LLM_CACHE_TTL_SECONDS:
        return None
    now = time.time()
    hit = _MEM_CACHE.get(key)
    if hit and hit[0] > now:
        return hit[1]
    r = _redis()
    if r is not None:
        try:
            raw = r.get(f"llmcache:{key}")
            if raw:
                payload = json.loads(raw)
                _MEM_CACHE[key] = (now + settings.LLM_CACHE_TTL_SECONDS, payload)
                return payload
        except Exception:
            pass
    return None


def set_cached(key: str, payload: dict) -> None:
    if not settings.LLM_CACHE_TTL_SECONDS or not isinstance(payload, dict):
        return
    if len(_MEM_CACHE) >= _MEM_CACHE_MAX:
        _MEM_CACHE.pop(next(iter(_MEM_CACHE)))
    _MEM_CACHE[key] = (time.time() + settings.LLM_CACHE_TTL_SECONDS, payload)
    r = _redis()
    if r is not None:
        try:
            r.setex(f"llmcache:{key}", settings.LLM_CACHE_TTL_SECONDS, json.dumps(payload))
        except Exception:
            pass
