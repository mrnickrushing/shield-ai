"""Authentication routes: register, login, refresh, me, social."""
import base64
import json
import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
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
