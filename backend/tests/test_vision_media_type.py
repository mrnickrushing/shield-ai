"""Vision image preparation — media type sniffing and conversion."""
import io
import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "development")

import pytest
from PIL import Image

from app.services.ai_analyzer import _detect_image_media_type, _prepare_vision_image


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "blue").save(buf, format="JPEG")
    return buf.getvalue()


def test_detects_png_and_jpeg_from_magic_bytes():
    assert _detect_image_media_type(_png_bytes()) == "image/png"
    assert _detect_image_media_type(_jpeg_bytes()) == "image/jpeg"
    assert _detect_image_media_type(b"GIF89a" + b"\x00" * 10) == "image/gif"
    assert _detect_image_media_type(b"RIFF\x00\x00\x00\x00WEBP") == "image/webp"
    assert _detect_image_media_type(b"not an image") is None


def test_prepare_passes_supported_formats_through_unchanged():
    png = _png_bytes()
    out, mt = _prepare_vision_image(png)
    assert out == png and mt == "image/png"


def test_prepare_converts_unsupported_format_to_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "green").save(buf, format="BMP")
    out, mt = _prepare_vision_image(buf.getvalue())
    assert mt == "image/jpeg"
    assert out[:3] == b"\xff\xd8\xff"


def test_prepare_raises_on_garbage_so_caller_falls_back():
    with pytest.raises(Exception):
        _prepare_vision_image(b"definitely not an image")
