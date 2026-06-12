"""LLM analysis layer.

The LLM interprets evidence and produces a user-facing explanation +
classification. It receives the deterministic signals as context so it grounds
its reasoning in real evidence rather than guessing.

For image scans, analyze_image_with_vision() sends the raw screenshot to
GPT-4o vision — far more accurate than OCR text alone.
"""
from __future__ import annotations

import base64
import json
import logging

from app.core.config import settings
from app.services.model_router import get_config

log = logging.getLogger(__name__)

_JSON_FORMAT = """
Return ONLY valid JSON with this exact shape:
{
  "risk_score": <int 0-100>,
  "threat_category": "<credential_theft|payment_fraud|impersonation|malware|social_engineering|unknown>",
  "confidence": <float 0-1>,
  "explanation": "<2-4 plain-language sentences a non-technical person understands>",
  "red_flags": ["<short red flag>", ...]
}

Rules:
- Ground your reasoning in the provided evidence. Do not invent facts.
- If evidence is weak, lower confidence and say so plainly.
- Never tell the user something is definitely safe; say what you observed.
- Keep language simple and calm. No jargon.
- When in doubt, score higher rather than lower — a missed scam harms the user.
"""


def _build_system_prompt(system_hint: str) -> str:
    return f"{system_hint}\n{_JSON_FORMAT}"


def _build_user_prompt(content: str, evidence: dict) -> str:
    return (
        "CONTENT TO ANALYZE:\n"
        f"{content[:4000]}\n\n"
        "DETERMINISTIC SIGNALS (already verified):\n"
        f"{json.dumps(evidence, indent=2, default=str)}\n\n"
        "Analyze and respond with JSON only."
    )


def analyze(content: str, evidence: dict, artifact_type: str = "unknown") -> dict | None:
    """Call the LLM with text content. Returns parsed dict or None on failure."""
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
                {"role": "system", "content": _build_system_prompt(cfg.system_hint)},
                {"role": "user", "content": _build_user_prompt(content, evidence)},
            ],
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:
        log.warning("LLM analysis failed (artifact_type=%s): %s", artifact_type, exc)
        return None


def analyze_image_with_vision(image_bytes: bytes, evidence: dict) -> dict | None:
    """Send the raw screenshot to GPT-4o vision for direct visual analysis.

    This is dramatically more accurate than OCR text alone — the model can
    see logos, layout, color, and visual urgency cues that OCR loses.
    Falls back to None so scan_service can fall through to text-based analysis.
    """
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI

        cfg = get_config("image")
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        b64 = base64.b64encode(image_bytes).decode()
        # Try JPEG first; if it was a PNG the base64 still works with image/jpeg hint
        # for most content — OpenAI accepts both.
        data_uri = f"data:image/jpeg;base64,{b64}"

        evidence_text = json.dumps(evidence, indent=2, default=str)
        user_message = [
            {
                "type": "text",
                "text": (
                    "Analyze this screenshot for scams, phishing, and fraud.\n\n"
                    f"Additional signals already detected by automated checks:\n{evidence_text}\n\n"
                    "Respond with JSON only."
                ),
            },
            {
                "type": "image_url",
                "image_url": {"url": data_uri, "detail": "high"},
            },
        ]

        resp = client.chat.completions.create(
            model=cfg.model,
            response_format={"type": "json_object"},
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            messages=[
                {"role": "system", "content": _build_system_prompt(cfg.system_hint)},
                {"role": "user", "content": user_message},
            ],
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:
        log.warning("Vision analysis failed, falling back to text analysis: %s", exc)
        return None
