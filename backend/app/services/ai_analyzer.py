"""LLM analysis layer.

The LLM only *interprets evidence* and produces a user-facing explanation +
classification. It receives the deterministic signals as context so it grounds
its reasoning in real evidence rather than guessing.
"""
from __future__ import annotations

import json

from app.core.config import settings
from app.services.model_router import get_config

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
    """Call the LLM. Returns parsed dict or None on failure (graceful fallback).

    ``system_hint`` and ``categories`` let verticals override the analyst persona
    and classification vocabulary without touching the core scam scanner.
    """
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI

        cfg = get_config(artifact_type)
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=cfg.model,
            response_format={"type": "json_object"},
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            messages=[
                {"role": "system", "content": _build_system_prompt(system_hint or cfg.system_hint, categories)},
                {"role": "user", "content": _build_user_prompt(content, evidence)},
            ],
        )
        return json.loads(resp.choices[0].message.content)
    except Exception:
        return None
