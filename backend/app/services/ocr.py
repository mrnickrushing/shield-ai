"""OCR pipeline for screenshot analysis.

Phase 1 uses Tesseract (pytesseract) for offline OCR. The extracted text and
detected brands feed the rule engine and the LLM analyzer.
"""
from __future__ import annotations

import base64
import io
import logging
import re

from app.services.url_enrichment import SENSITIVE_BRANDS

log = logging.getLogger(__name__)
URL_RE = re.compile(r"https?://[^\s\"'>)]+", re.IGNORECASE)


def _preprocess_for_ocr(img):
    """Grayscale, upscale, and threshold the image before OCR.

    Tesseract's raw output on real-world screenshots is unreliable —
    anti-aliased or colored text (red warning text, small mobile UI fonts)
    gets silently dropped rather than misread, which starves the rule engine
    of exactly the words ("update your payment", "renew now") that matter
    most for scam detection. Converting to high-contrast black-on-white at
    2x resolution recovers most of that text.
    """
    from PIL import ImageEnhance, ImageOps

    gray = ImageOps.grayscale(img.convert("RGB"))
    w, h = gray.size
    gray = gray.resize((w * 2, h * 2))
    gray = ImageEnhance.Contrast(gray).enhance(2.0)
    return gray.point(lambda p: 255 if p > 140 else 0)


def extract_text(image_bytes: bytes) -> tuple[str, bool]:
    """Run OCR over an image. Returns (text, ocr_available).

    ocr_available=False means Tesseract failed or isn't installed — callers
    should degrade confidence rather than treating the empty string as clean.
    """
    try:
        import pytesseract
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(_preprocess_for_ocr(img))
        return text, True
    except Exception as exc:
        log.warning("OCR failed: %s", exc)
        return "", False


def decode_base64_image(b64: str) -> bytes:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return base64.b64decode(b64)


def detect_brands(text: str) -> list[str]:
    low = text.lower()
    return sorted({b for b in SENSITIVE_BRANDS if b in low})


def extract_urls(text: str) -> list[str]:
    return list(dict.fromkeys(URL_RE.findall(text)))


def analyze_screenshot(image_bytes: bytes) -> dict:
    text, ocr_available = extract_text(image_bytes)
    return {
        "ocr_text": text,
        "ocr_available": ocr_available,
        "detected_brands": detect_brands(text),
        "extracted_urls": extract_urls(text),
        "char_count": len(text),
    }
