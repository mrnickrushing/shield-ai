"""Extract text from an uploaded bill/document (image or PDF) for verticals.

Photos go through the existing Tesseract OCR pipeline; PDFs (digital EOBs /
itemized statements) are read with pypdf. Scanned image-only PDFs yield no
text — callers should surface a "couldn't read it, try a photo or paste" hint.
"""
from __future__ import annotations

import io
import logging

from app.services import ocr

log = logging.getLogger(__name__)


def _looks_like_pdf(data: bytes) -> bool:
    # PDFs start with %PDF, sometimes after a BOM / whitespace.
    return b"%PDF" in data[:1024]


def _extract_pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        parts: list[str] = []
        for page in reader.pages[:30]:  # cap pages for safety
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(p for p in parts if p).strip()
    except Exception as exc:
        log.warning("PDF text extraction failed: %s", exc)
        return ""


def extract_text(data: bytes) -> dict:
    """Pull text out of an uploaded file.

    Returns ``{"text": str, "kind": "pdf"|"image", "ok": bool}``. ``ok`` is False
    when nothing usable was extracted (empty/scanned PDF, OCR unavailable).
    """
    if _looks_like_pdf(data):
        text = _extract_pdf_text(data)
        return {"text": text, "kind": "pdf", "ok": bool(text.strip())}
    text, ocr_ok = ocr.extract_text(data)
    return {"text": text, "kind": "image", "ok": ocr_ok and bool(text.strip())}
