"""Shared API dependencies."""
import hashlib

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.models import ApiKey, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not creds:
        raise cred_exc
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            raise cred_exc
        user_id = payload.get("sub")
    except Exception:
        raise cred_exc

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise cred_exc
    return user


def get_optional_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Return the current user when a valid token is present; otherwise continue anonymously."""
    if not creds:
        return None
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
    except Exception:
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active:
        return None
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def require_developer(user: User = Depends(get_current_user)) -> User:
    if not user.is_developer:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Developer access required. Ask an admin to enable your developer account.")
    return user


def _resolve_api_key(raw_key: str, db: Session, required_scope: str | None = None) -> User:
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key: ApiKey | None = (
        db.query(ApiKey)
        .filter(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
        .first()
    )
    if not api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or inactive API key")
    if required_scope and required_scope not in (api_key.scopes or []):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"API key missing required scope: {required_scope}",
        )
    user = db.get(User, api_key.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account associated with API key is inactive")
    from datetime import datetime, timezone
    api_key.last_used_at = datetime.now(timezone.utc)
    db.add(api_key)
    return user


def _jwt_user(creds: HTTPAuthorizationCredentials, db: Session) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            raise cred_exc
        user_id = payload.get("sub")
    except Exception as err:
        raise cred_exc from err
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise cred_exc
    return user


def get_user_from_api_key_or_jwt(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Accept either X-API-Key (B2B) or Bearer JWT (mobile/web). No scope check."""
    if x_api_key:
        return _resolve_api_key(x_api_key, db)
    if creds:
        return _jwt_user(creds, db)
    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Provide a Bearer token or X-API-Key header",
    )


def get_user_from_api_key_or_jwt_write(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Like get_user_from_api_key_or_jwt but enforces scan:write scope for API key callers."""
    if x_api_key:
        return _resolve_api_key(x_api_key, db, required_scope="scan:write")
    if creds:
        return _jwt_user(creds, db)
    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Provide a Bearer token or X-API-Key header",
    )
