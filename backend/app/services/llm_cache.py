"""Dedupe cache for LLM analysis results + shared Redis client.

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

import copy
import hashlib
import json
import logging
import time

from app.core.config import settings

log = logging.getLogger(__name__)

_MEM_CACHE: dict[str, tuple[float, dict]] = {}
_MEM_CACHE_MAX = 500

# Lazily-created, reused Redis client — a new client + ping per cache call
# would defeat pooling and risk exhausting connections under load.
_redis_client = None
_redis_initialized = False


def cache_key(*parts: object) -> str:
    """Stable hash over the parts that determine an LLM response."""
    hasher = hashlib.sha256()
    for part in parts:
        hasher.update(repr(part).encode("utf-8", "ignore"))
        hasher.update(b"\x00")
    return hasher.hexdigest()


def get_redis():
    """Shared Redis client (singleton). Returns None if Redis is unreachable;
    callers must tolerate that and degrade gracefully."""
    global _redis_client, _redis_initialized
    if _redis_initialized:
        return _redis_client
    _redis_initialized = True
    try:
        import redis

        client = redis.Redis.from_url(
            settings.REDIS_URL, socket_connect_timeout=0.3, socket_timeout=0.3
        )
        client.ping()
        _redis_client = client
    except Exception as exc:
        log.debug("llm_cache Redis unavailable: %s", exc)
        _redis_client = None
    return _redis_client


def get_cached(key: str) -> dict | None:
    if not settings.LLM_CACHE_TTL_SECONDS:
        return None
    now = time.time()
    hit = _MEM_CACHE.get(key)
    if hit and hit[0] > now:
        # Copy so a caller mutating the result can't corrupt the shared entry.
        return copy.deepcopy(hit[1])
    r = get_redis()
    if r is not None:
        try:
            raw = r.get(f"llmcache:{key}")
            if raw:
                payload = json.loads(raw)  # fresh object, safe to hand out
                _MEM_CACHE[key] = (now + settings.LLM_CACHE_TTL_SECONDS, payload)
                return copy.deepcopy(payload)
        except Exception as exc:
            log.debug("llm_cache Redis get failed: %s", exc)
    return None


def set_cached(key: str, payload: dict) -> None:
    if not settings.LLM_CACHE_TTL_SECONDS or not isinstance(payload, dict):
        return
    if len(_MEM_CACHE) >= _MEM_CACHE_MAX:
        _MEM_CACHE.pop(next(iter(_MEM_CACHE)))
    _MEM_CACHE[key] = (time.time() + settings.LLM_CACHE_TTL_SECONDS, copy.deepcopy(payload))
    r = get_redis()
    if r is not None:
        try:
            r.setex(f"llmcache:{key}", settings.LLM_CACHE_TTL_SECONDS, json.dumps(payload))
        except Exception as exc:
            log.debug("llm_cache Redis set failed: %s", exc)
