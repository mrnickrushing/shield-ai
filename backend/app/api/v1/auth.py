"""Authentication routes: register, login, refresh, me, social."""
import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
import jwt
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.models import AuditLog, Profile, SocialIdentity, User
from app.schemas.schemas import (
    ProfileUpdate,
    RefreshRequest,
    SocialAuthRequest,
    TokenPair,
    UserLogin,
    UserOut,
    UserRegister,
)

router = APIRouter(prefix="/auth", tags=["auth"])
GOOGLE_DISCOVERY_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo"


def _normalize_email(email: str | None) -> str | None:
    if email is None:
        return None
    normalized = email.strip().lower()
    return normalized or None


def _decode_jwt_payload(token: str) -> dict:
    parts = token.split(".")
    if len(parts) < 2:
        raise ValueError("Malformed JWT")
    padding = "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(parts[1] + padding))


def _create_google_state(return_url: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": secrets.token_urlsafe(12),
        "iat": now,
        "exp": now + timedelta(minutes=10),
        "type": "google_oauth_state",
        "return_url": return_url,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_google_state(state: str) -> dict:
    payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("type") != "google_oauth_state":
        raise ValueError("Invalid state type")
    return payload


def _normalize_google_return_url(return_url: str | None) -> str:
    candidate = (return_url or settings.MOBILE_GOOGLE_AUTH_RETURN_URI).strip()
    if not candidate.startswith("shieldai://"):
        return settings.MOBILE_GOOGLE_AUTH_RETURN_URI
    return candidate


def _require_google_oauth_config() -> tuple[str, str, str]:
    client_id = settings.GOOGLE_OAUTH_CLIENT_ID.strip()
    client_secret = settings.GOOGLE_OAUTH_CLIENT_SECRET.strip()
    redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI.strip()
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google sign-in is not configured yet.",
        )
    return client_id, client_secret, redirect_uri


def _redirect_with_error(return_url: str, message: str) -> RedirectResponse:
    separator = "&" if "?" in return_url else "?"
    return RedirectResponse(f"{return_url}{separator}error={quote(message)}", status_code=status.HTTP_302_FOUND)


def _user_out(user: User) -> UserOut:
    profile = user.profile
    return UserOut(
        id=user.id,
        email=user.email,
        is_premium=user.is_premium,
        display_name=profile.display_name if profile else "",
        simple_language_mode=profile.simple_language_mode if profile else False,
        large_text_mode=profile.large_text_mode if profile else False,
    )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email is required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id, display_name=payload.display_name.strip()))
    db.add(AuditLog(user_id=user.id, action="register"))
    db.commit()
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenPair)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == _normalize_email(payload.email)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    db.add(AuditLog(user_id=user.id, action="login"))
    db.commit()
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/social", response_model=TokenPair)
def social_auth(payload: SocialAuthRequest, db: Session = Depends(get_db)):
    """Sign in or register via Apple or Google identity token."""
    email: str | None = None
    subject: str | None = None
    display_name = (payload.display_name or "").strip()

    if payload.provider == "google":
        try:
            r = httpx.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.token}", timeout=10)
            if r.status_code != 200:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid Google token")
            info = r.json()
            email = _normalize_email(info.get("email"))
            subject = info.get("sub")
            if not display_name:
                display_name = info.get("name", "")
        except httpx.RequestError:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google verification unavailable")

    elif payload.provider == "apple":
        try:
            claims = _decode_jwt_payload(payload.token)
            email = _normalize_email(claims.get("email") or payload.email)
            subject = claims.get("sub")
        except Exception:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid Apple token")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown provider")

    if not subject:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Identity token did not include a valid account subject")

    identity = (
        db.query(SocialIdentity)
        .filter(
            SocialIdentity.provider == payload.provider,
            SocialIdentity.subject == subject,
        )
        .first()
    )

    user = db.get(User, identity.user_id) if identity else None
    if user is None and email:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        if not email:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "We could not match this account. Sign in with email once, then try Apple again.",
            )
        user = User(email=email, hashed_password=hash_password(secrets.token_urlsafe(32)))
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id, display_name=display_name))
        db.add(AuditLog(user_id=user.id, action=f"register_{payload.provider}"))
    else:
        if email and user.email != email:
            user.email = email
        if user.profile is None:
            db.add(Profile(user_id=user.id, display_name=display_name))
        elif display_name and not user.profile.display_name:
            user.profile.display_name = display_name
        db.add(AuditLog(user_id=user.id, action=f"login_{payload.provider}"))

    if identity is None:
        db.add(
            SocialIdentity(
                user_id=user.id,
                provider=payload.provider,
                subject=subject,
                email=email or user.email,
            )
        )
    elif email and identity.email != email:
        identity.email = email

    db.commit()
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/google/start")
def google_auth_start(return_url: str | None = None):
    client_id, _, redirect_uri = _require_google_oauth_config()
    normalized_return_url = _normalize_google_return_url(return_url)
    state = _create_google_state(normalized_return_url)
    auth_url = (
        f"{GOOGLE_DISCOVERY_AUTH_ENDPOINT}"
        f"?client_id={quote(client_id)}"
        f"&redirect_uri={quote(redirect_uri)}"
        f"&response_type=code"
        f"&scope={quote('openid email')}"
        f"&access_type=offline"
        f"&prompt=select_account"
        f"&state={quote(state)}"
    )
    return RedirectResponse(auth_url, status_code=status.HTTP_302_FOUND)


@router.get("/google/callback")
async def google_auth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    client_id, client_secret, redirect_uri = _require_google_oauth_config()
    normalized_return_url = settings.MOBILE_GOOGLE_AUTH_RETURN_URI

    if state:
        try:
            normalized_return_url = _normalize_google_return_url(_decode_google_state(state).get("return_url"))
        except Exception:
            return _redirect_with_error(settings.MOBILE_GOOGLE_AUTH_RETURN_URI, "Invalid Google sign-in state.")

    if error:
        return _redirect_with_error(normalized_return_url, f"Google sign-in failed: {error}")
    if not code:
        return _redirect_with_error(normalized_return_url, "Google sign-in did not return an authorization code.")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_response = await client.post(
                GOOGLE_TOKEN_ENDPOINT,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            id_token = token_data.get("id_token")
            if not id_token:
                return _redirect_with_error(normalized_return_url, "Google sign-in did not return an identity token.")

            info_response = await client.get(
                GOOGLE_TOKENINFO_ENDPOINT,
                params={"id_token": id_token},
            )
            info_response.raise_for_status()
            info = info_response.json()
    except httpx.HTTPError:
        return _redirect_with_error(normalized_return_url, "Google verification is unavailable right now.")

    email = _normalize_email(info.get("email"))
    subject = info.get("sub")
    if not email or not subject:
        return _redirect_with_error(normalized_return_url, "Google sign-in did not return a valid account.")

    display_name = (info.get("name") or "").strip()
    identity = (
        db.query(SocialIdentity)
        .filter(
            SocialIdentity.provider == "google",
            SocialIdentity.subject == subject,
        )
        .first()
    )

    user = db.get(User, identity.user_id) if identity else None
    if user is None:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(email=email, hashed_password=hash_password(secrets.token_urlsafe(32)))
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id, display_name=display_name))
        db.add(AuditLog(user_id=user.id, action="register_google"))
    else:
        if user.email != email:
            user.email = email
        if user.profile is None:
            db.add(Profile(user_id=user.id, display_name=display_name))
        elif display_name and not user.profile.display_name:
            user.profile.display_name = display_name
        db.add(AuditLog(user_id=user.id, action="login_google"))

    if identity is None:
        db.add(
            SocialIdentity(
                user_id=user.id,
                provider="google",
                subject=subject,
                email=email,
            )
        )
    elif identity.email != email:
        identity.email = email

    db.commit()

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    separator = "&" if "?" in normalized_return_url else "?"
    callback_url = (
        f"{normalized_return_url}{separator}"
        f"access_token={quote(access_token)}"
        f"&refresh_token={quote(refresh_token)}"
    )
    return RedirectResponse(callback_url, status_code=status.HTTP_302_FOUND)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError
        user_id = data["sub"]
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if not db.get(User, user_id):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = user.profile
    if profile is None:
        profile = Profile(user_id=user.id)
        db.add(profile)
    if payload.display_name is not None:
        profile.display_name = payload.display_name
    if payload.simple_language_mode is not None:
        profile.simple_language_mode = payload.simple_language_mode
    if payload.large_text_mode is not None:
        profile.large_text_mode = payload.large_text_mode
    db.commit()
    db.refresh(profile)
    db.refresh(user)
    return _user_out(user)
