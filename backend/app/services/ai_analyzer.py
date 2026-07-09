"""LLM analysis layer.

The LLM interprets evidence and produces a user-facing explanation +
classification. It receives the deterministic signals as context so it grounds
its reasoning in real evidence rather than guessing.

For image scans, analyze_image_with_vision() sends the raw screenshot to
Claude's vision input — far more accurate than OCR text alone.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import re

from app.core.config import settings
from app.services import llm_cache
from app.services.model_router import get_config

log = logging.getLogger(__name__)

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json_response(text: str) -> dict:
    """Claude sometimes wraps JSON in prose or markdown fences despite
    instructions to return JSON only — extract the outermost object."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_BLOCK_RE.search(text)
        if not match:
            raise
        return json.loads(match.group(0))


DEFAULT_CATEGORIES = (
    "credential_theft",
    "payment_fraud",
    "impersonation",
    "malware",
    "social_engineering",
    "unknown",
)


def _json_format(categories: tuple[str, ...]) -> str:
    enum = "|".join(categories)
    return f"""
Return ONLY valid JSON with this exact shape:
{{
  "risk_score": <int 0-100>,
  "threat_category": "<{enum}>",
  "confidence": <float 0-1>,
  "explanation": "<2-4 plain-language sentences a non-technical person understands>",
  "red_flags": ["<short red flag>", ...]
}}

Rules:
- Ground your reasoning in the provided evidence. Do not invent facts.
- If evidence is weak, lower confidence and say so plainly.
- Never tell the user something is definitely safe; say what you observed.
- Keep language simple and calm. No jargon.
- When in doubt, score higher rather than lower — a missed scam harms the user.
"""


# Preserved for backward compatibility / external references.
_JSON_FORMAT = _json_format(DEFAULT_CATEGORIES)


def _build_system_prompt(system_hint: str, categories: tuple[str, ...] | None = None) -> str:
    return f"{system_hint}\n{_json_format(categories or DEFAULT_CATEGORIES)}"


def _build_user_prompt(content: str, evidence: dict) -> str:
    return (
        "CONTENT TO ANALYZE:\n"
        f"{content[:4000]}\n\n"
        "DETERMINISTIC SIGNALS (already verified):\n"
        f"{json.dumps(evidence, indent=2, default=str)}\n\n"
        "Analyze and respond with JSON only."
    )


def analyze(
    content: str,
    evidence: dict,
    artifact_type: str = "unknown",
    *,
    system_hint: str | None = None,
    categories: tuple[str, ...] | None = None,
) -> dict | None:
    """Call the LLM with text content. Returns parsed dict or None on failure.

    ``system_hint`` and ``categories`` let verticals override the analyst persona
    and classification vocabulary without touching the core scam scanner.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic

        cfg = get_config(artifact_type)
        system = _build_system_prompt(system_hint or cfg.system_hint, categories)
        user_prompt = _build_user_prompt(content, evidence)

        # Identical request → reuse the prior verdict instead of paying again.
        key = llm_cache.cache_key("analyze", cfg.model, cfg.temperature, cfg.max_tokens, system, user_prompt)
        cached = llm_cache.get_cached(key)
        if cached is not None:
            return cached

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=cfg.model,
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )
        parsed = _parse_json_response(resp.content[0].text)
        if parsed is not None:
            llm_cache.set_cached(key, parsed)
        return parsed
    except Exception as exc:
        log.warning("LLM analysis failed (artifact_type=%s): %s", artifact_type, exc)
        return None


def analyze_image_with_vision(image_bytes: bytes, evidence: dict) -> dict | None:
    """Send the raw screenshot to Claude's vision input for direct visual analysis.

    This is dramatically more accurate than OCR text alone — the model can
    see logos, layout, color, and visual urgency cues that OCR loses.
    Falls back to None so scan_service can fall through to text-based analysis.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic

        cfg = get_config("image")

        # Vision scans are the priciest; dedupe identical screenshots on the
        # image bytes + detected signals before paying for another call.
        img_hash = hashlib.sha256(image_bytes).hexdigest()
        evidence_text = json.dumps(evidence, indent=2, default=str)
        key = llm_cache.cache_key("vision", cfg.model, cfg.temperature, cfg.max_tokens, img_hash, evidence_text)
        cached = llm_cache.get_cached(key)
        if cached is not None:
            return cached

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        b64 = base64.b64encode(image_bytes).decode()
        user_message = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
            },
            {
                "type": "text",
                "text": (
                    "Analyze this screenshot for scams, phishing, and fraud.\n\n"
                    f"Additional signals already detected by automated checks:\n{evidence_text}\n\n"
                    "Respond with JSON only."
                ),
            },
        ]

        resp = client.messages.create(
            model=cfg.model,
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            system=_build_system_prompt(cfg.system_hint),
            messages=[{"role": "user", "content": user_message}],
        )
        parsed = _parse_json_response(resp.content[0].text)
        if parsed is not None:
            llm_cache.set_cached(key, parsed)
        return parsed
    except Exception as exc:
        log.warning("Vision analysis failed, falling back to text analysis: %s", exc)
        return None


def generate_text(instruction: str, facts: str, example: str) -> str | None:
    """Free-form document generation grounded in provided facts.

    Used by the recovery concierge. Returns plain text or None (caller falls
    back to its deterministic template).
    """
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic

        cfg = get_config("message")
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=cfg.model,
            temperature=0.2,
            max_tokens=1500,
            system=(
                "You draft documents for scam victims. Be factual and precise. "
                "Use only the facts given; keep bracketed placeholders for anything "
                "unknown. Return only the document text — no preamble or comments."
            ),
            messages=[{
                "role": "user",
                "content": f"{instruction}\n\nFACTS:\n{facts}\n\nEXAMPLE STRUCTURE TO FOLLOW:\n{example}",
            }],
        )
        text = resp.content[0].text.strip()
        return text or None
    except Exception as exc:
        log.warning("LLM document generation failed: %s", exc)
        return None
