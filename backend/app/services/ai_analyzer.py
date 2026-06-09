"""LLM analysis layer.

The LLM only *interprets evidence* and produces a user-facing explanation +
classification. It receives the deterministic signals as context so it grounds
its reasoning in real evidence rather than guessing.
"""
from __future__ import annotations

import json

from app.core.config import settings

SYSTEM_PROMPT = """You are Shield AI, a scam, phishing, and fraud detection assistant.
You analyze suspicious content (a URL, OCR text from a screenshot, or a pasted message)
and the deterministic security signals already gathered about it.

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
"""


def _build_user_prompt(content: str, evidence: dict) -> str:
    return (
        "CONTENT TO ANALYZE:\n"
        f"{content[:4000]}\n\n"
        "DETERMINISTIC SIGNALS (already verified):\n"
        f"{json.dumps(evidence, indent=2, default=str)}\n\n"
        "Analyze and respond with JSON only."
    )


def analyze(content: str, evidence: dict) -> dict | None:
    """Call the LLM. Returns parsed dict or None on failure (graceful fallback)."""
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            response_format={"type": "json_object"},
            temperature=0.2,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(content, evidence)},
            ],
        )
        return json.loads(resp.choices[0].message.content)
    except Exception:
        return None
