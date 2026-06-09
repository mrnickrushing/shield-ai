"""Developer / API-key-platform routes — Phase 5.

POST   /api/v1/developer/keys          — create a new API key (returned once)
GET    /api/v1/developer/keys          — list own API keys (no raw key exposed)
DELETE /api/v1/developer/keys/{key_id} — revoke a key
"""
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_developer
from app.db.session import get_db
from app.models.models import ApiKey, User
from app.schemas.schemas import ApiKeyCreate, ApiKeyCreated, ApiKeyOut

router = APIRouter(prefix="/developer", tags=["developer"])

_KEY_PREFIX = "shld_"
_KEY_BYTES = 32


def _generate_raw_key() -> str:
    return _KEY_PREFIX + secrets.token_urlsafe(_KEY_BYTES)


@router.post("/keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_api_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_developer),
):
    """
    Generate a new API key. The full raw key is returned only here — store it
    securely. Subsequent calls only return the prefix for identification.
    """
    raw_key = _generate_raw_key()
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12]

    api_key = ApiKey(
        user_id=user.id,
        name=payload.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        scopes=payload.scopes,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    return ApiKeyCreated(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        raw_key=raw_key,
    )


@router.get("/keys", response_model=list[ApiKeyOut])
def list_api_keys(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(ApiKey)
        .filter(ApiKey.user_id == user.id, ApiKey.is_active.is_(True))
        .order_by(ApiKey.created_at.desc())
        .all()
    )


@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    api_key = db.get(ApiKey, key_id)
    if not api_key or api_key.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Key not found")
    api_key.is_active = False
    db.commit()
