"""Cloudflare R2 object storage (S3-compatible) for user-uploaded assets.

R2 speaks the S3 API, so we drive it with boto3 pointed at the account's R2
endpoint. Everything is a no-op that raises ``StorageNotConfigured`` until the
R2_* settings are populated, so local/dev environments without credentials fail
loudly and predictably rather than silently pretending to store a file.
"""

from __future__ import annotations

import io
from functools import lru_cache
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:  # boto3 is only imported lazily so the dep stays optional at import time
    from mypy_boto3_s3 import S3Client


class StorageNotConfigured(RuntimeError):
    """Raised when an upload is attempted without R2 credentials configured."""


def storage_configured() -> bool:
    return all(
        [
            settings.R2_ACCOUNT_ID,
            settings.R2_ACCESS_KEY_ID,
            settings.R2_SECRET_ACCESS_KEY,
            settings.R2_BUCKET,
            settings.R2_PUBLIC_BASE_URL,
        ]
    )


@lru_cache(maxsize=1)
def _client() -> "S3Client":
    import boto3
    from botocore.client import Config

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_bytes(key: str, data: bytes, content_type: str) -> str:
    """Store ``data`` at ``key`` and return its public URL.

    Raises ``StorageNotConfigured`` when R2 isn't set up.
    """
    if not storage_configured():
        raise StorageNotConfigured("R2 object storage is not configured")
    _client().upload_fileobj(
        io.BytesIO(data),
        settings.R2_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000"},
    )
    base = settings.R2_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/{key}"
