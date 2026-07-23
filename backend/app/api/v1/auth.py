"""Authentication routes: register, login, refresh, me, social."""
import hashlib
import hmac
import io
import secrets
import base64
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
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
from app.models.models import (
    ApiKey,
    ApiUsage,
    AuthSession,
    AuditLog,
    AvatarImage,
    BillingWebhookEvent,
    BreachRecord,
    BrokerOptOut,
    BrowserTelemetryEvent,
    CasePackShare,
    CommunityReport,
    Device,
    EducationProgress,
    EmailScan,
    ExtensionTelemetryEvent,
    IdentityAlert,
    ImageScan,
    Incident,
    IncidentEvidence,
    LinkScan,
    MarketplaceScan,
    MessageScan,
    MonitoredIdentity,
    Notification,
    NotificationPreference,
    OAuthAuthorizationCode,
    PersonalBlockedNumber,
    PhoneScan,
    PrivacyPreference,
    Profile,
    PushReceipt,
    QRScan,
    RiskReport,
    ScanHistory,
    ScanFeedbackDetail,
    SocialScan,
    SocialIdentity,
    TrustedContact,
    User,
)
from app.schemas.schemas import (
    AuthSessionOut,
    DeviceOut,
    OAuthCodeExchange,
    PrivacyPreferenceIn,
    PrivacyPreferenceOut,
    ProfileUpdate,
    RefreshRequest,
    SocialAuthRequest,
    TokenPair,
    UserLogin,
    UserOut,
    UserRegister,
)
from app.services.privacy import apply_retention_policy, purge_user_scans
from app.services.account_deletion import delete_user_account
from app.services.subscription import is_premium_active

router = APIRouter(prefix="/auth", tags=["auth"])
GOOGLE_DISCOVERY_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo"
APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
_apple_jwks_client = jwt.PyJWKClient(APPLE_JWKS_URL)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _request_user_agent(request: Request | None) -> str:
    return (request.headers.get("user-agent", "") if request else "")[:500]


def _request_ip(request: Request | None) -> str:
    if not request:
        return ""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "")[:64]


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _issue_token_pair(db: Session, user: User, request: Request | None = None, session: AuthSession | None = None) -> TokenPair:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    if session is None:
        session = AuthSession(
            user_id=user.id,
            refresh_token_hash="pending",
            user_agent=_request_user_agent(request),
            ip_address=_request_ip(request),
            created_at=now,
            last_used_at=now,
            expires_at=expires_at,
        )
        db.add(session)
        db.flush()
    else:
        session.last_used_at = now
        session.expires_at = expires_at
        session.is_active = True
        session.revoked_at = None

    refresh_token = create_refresh_token(user.id, session.id)
    session.refresh_token_hash = _hash_token(refresh_token)
    db.add(session)
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=refresh_token,
    )


def _normalize_email(email: str | None) -> str | None:
    if email is None:
        return None
    normalized = email.strip().lower()
    return normalized or None


def _hash_apple_nonce(nonce: str) -> str:
    return hashlib.sha256(nonce.encode()).hexdigest()


def _verified_apple_email(claims: dict) -> str | None:
    """Return only an email Apple explicitly attested as verified.

    The client credential's ``email`` field is profile metadata delivered only
    on first authorization; it is not an authenticated token claim and must
    never be used to locate or link an account.
    """
    verified = claims.get("email_verified")
    if verified is not True and str(verified).lower() != "true":
        return None
    return _normalize_email(claims.get("email"))


def _verify_apple_identity_token(token: str, nonce: str) -> dict:
    signing_key = _apple_jwks_client.get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.APPLE_CLIENT_ID,
        issuer=APPLE_ISSUER,
        options={"require": ["sub", "iss", "aud", "exp"]},
    )
    token_nonce = claims.get("nonce")
    expected_nonce = _hash_apple_nonce(nonce)
    if not isinstance(token_nonce, str) or not hmac.compare_digest(token_nonce, expected_nonce):
        raise ValueError("Invalid Apple nonce")
    return claims


def _create_google_state(return_url: str, code_challenge: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": secrets.token_urlsafe(12),
        "iat": now,
        "exp": now + timedelta(minutes=10),
        "type": "google_oauth_state",
        "return_url": return_url,
        "code_challenge": code_challenge,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_google_state(state: str) -> dict:
    payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("type") != "google_oauth_state":
        raise ValueError("Invalid state type")
    return payload


def _normalize_google_return_url(return_url: str | None) -> str:
    candidate = (return_url or settings.MOBILE_GOOGLE_AUTH_RETURN_URI).strip()
    allowed = urlparse(settings.MOBILE_GOOGLE_AUTH_RETURN_URI)
    parsed = urlparse(candidate)
    if (
        parsed.scheme != "https"
        or parsed.netloc != allowed.netloc
        or parsed.path != allowed.path
        or parsed.params
        or parsed.fragment
    ):
        return settings.MOBILE_GOOGLE_AUTH_RETURN_URI
    return f"https://{parsed.netloc}{parsed.path}"


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


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
        is_premium=is_premium_active(user),
        display_name=profile.display_name if profile else "",
        avatar_url=profile.avatar_url if profile else "",
        simple_language_mode=profile.simple_language_mode if profile else False,
        large_text_mode=profile.large_text_mode if profile else False,
    )


def _delete_user_scans(db: Session, user_id: str) -> int:
    return purge_user_scans(db, user_id)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, request: Request, db: Session = Depends(get_db)):
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
    tokens = _issue_token_pair(db, user, request)
    db.commit()
    return tokens


@router.post("/login", response_model=TokenPair)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == _normalize_email(payload.email)).first()
    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    db.add(AuditLog(user_id=user.id, action="login"))
    tokens = _issue_token_pair(db, user, request)
    db.commit()
    return tokens


@router.post("/social", response_model=TokenPair)
def social_auth(payload: SocialAuthRequest, request: Request, db: Session = Depends(get_db)):
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
            expected_audience = settings.GOOGLE_OAUTH_CLIENT_ID.strip()
            if expected_audience and info.get("aud") != expected_audience:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid Google token")
            if str(info.get("email_verified", "")).lower() != "true":
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google account email is not verified")
            email = _normalize_email(info.get("email"))
            subject = info.get("sub")
            if not display_name:
                display_name = info.get("name", "")
        except httpx.RequestError:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google verification unavailable")

    elif payload.provider == "apple":
        if not payload.nonce:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Apple nonce is required")
        try:
            claims = _verify_apple_identity_token(payload.token, payload.nonce)
            email = _verified_apple_email(claims)
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

    if user is not None and not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is unavailable")

    if not user:
        if not email:
            # Apple only includes a verified email claim on a user's
            # first-ever authorization for this app; every repeat sign-in (a
            # new device, a reinstall, or Apple's own review pass reusing an
            # already-authorized test account) omits it entirely. Fall back
            # to a stable placeholder keyed on Apple's immutable subject so
            # account creation never depends on an email Apple may not send.
            if payload.provider == "apple" and subject:
                email = f"apple-{subject}@users.shieldai.rushingtechnologies.com"
            else:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Apple did not provide a verified email. Sign in with another method.",
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

    tokens = _issue_token_pair(db, user, request)
    db.commit()
    return tokens


@router.get("/google/start")
def google_auth_start(code_challenge: str, return_url: str | None = None):
    if len(code_challenge) != 43 or any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" for c in code_challenge):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A valid PKCE challenge is required")
    client_id, _, redirect_uri = _require_google_oauth_config()
    normalized_return_url = _normalize_google_return_url(return_url)
    state = _create_google_state(normalized_return_url, code_challenge)
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
    request: Request = None,
    db: Session = Depends(get_db),
):
    client_id, client_secret, redirect_uri = _require_google_oauth_config()
    normalized_return_url = settings.MOBILE_GOOGLE_AUTH_RETURN_URI

    if not state:
        return _redirect_with_error(settings.MOBILE_GOOGLE_AUTH_RETURN_URI, "Invalid Google sign-in state.")
    try:
        state_payload = _decode_google_state(state)
        normalized_return_url = _normalize_google_return_url(state_payload.get("return_url"))
        if not state_payload.get("code_challenge"):
            raise ValueError("Missing PKCE challenge")
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

    if info.get("aud") != client_id or str(info.get("email_verified", "")).lower() != "true":
        return _redirect_with_error(normalized_return_url, "Google did not return a verified account.")
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

    if user is not None and not user.is_active:
        return _redirect_with_error(normalized_return_url, "Account is unavailable.")

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

    authorization_code = secrets.token_urlsafe(48)
    db.add(
        OAuthAuthorizationCode(
            user_id=user.id,
            code_hash=_hash_token(authorization_code),
            code_challenge=state_payload["code_challenge"],
            redirect_uri=normalized_return_url,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )
    )
    db.commit()

    separator = "&" if "?" in normalized_return_url else "?"
    callback_url = f"{normalized_return_url}{separator}code={quote(authorization_code)}"
    return RedirectResponse(callback_url, status_code=status.HTTP_302_FOUND)


@router.post("/google/exchange", response_model=TokenPair)
def google_auth_exchange(
    payload: OAuthCodeExchange,
    request: Request,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    auth_code = (
        db.query(OAuthAuthorizationCode)
        .filter(OAuthAuthorizationCode.code_hash == _hash_token(payload.code))
        .with_for_update()
        .first()
    )
    if (
        not auth_code
        or auth_code.used_at is not None
        or _as_utc(auth_code.expires_at) < now
        or not hmac.compare_digest(auth_code.code_challenge, _pkce_challenge(payload.code_verifier))
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired authorization code")
    user = db.get(User, auth_code.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is unavailable")
    auth_code.used_at = now
    tokens = _issue_token_pair(db, user, request)
    db.commit()
    return tokens


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError
        user_id = data["sub"]
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is unavailable")
    session: AuthSession | None = None
    if data.get("sid"):
        session = db.get(AuthSession, data["sid"])
        if (
            not session
            or session.user_id != user_id
            or not session.is_active
            or session.revoked_at is not None
            or _as_utc(session.expires_at) < datetime.now(timezone.utc)
            or session.refresh_token_hash != _hash_token(payload.refresh_token)
        ):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired or revoked")
    tokens = _issue_token_pair(db, user, request, session=session)
    db.commit()
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Revoke the server-side session represented by a refresh token.

    This endpoint intentionally does not require an access token: a client may
    still revoke its long-lived session after the short-lived access token has
    expired. Possession of the exact current refresh token is required.
    """
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh" or not data.get("sid"):
            raise ValueError
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    session = db.get(AuthSession, data["sid"])
    if (
        not session
        or session.user_id != data.get("sub")
        or not hmac.compare_digest(session.refresh_token_hash, _hash_token(payload.refresh_token))
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    session.is_active = False
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()


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


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Accept an image, normalize it to a square JPEG, store the bytes in the
    app database, and point the profile at the API's serve endpoint."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    max_bytes = settings.AVATAR_MAX_MB * 1024 * 1024
    raw = await file.read(max_bytes + 1)
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file.")
    if len(raw) > max_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Image must be under {settings.AVATAR_MAX_MB} MB.")

    try:
        image = Image.open(io.BytesIO(raw))
        if image.width * image.height > 25_000_000:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image dimensions are too large.")
        image.verify()  # detect truncated/forged files before decoding
        image = Image.open(io.BytesIO(raw))
        # Honor EXIF orientation, then drop all metadata by re-encoding.
        image = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file isn't a valid image.")

    # Center-crop to a square and cap the resolution — avatars never need more.
    image = ImageOps.fit(image, (512, 512), method=Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85, optimize=True)
    data = buffer.getvalue()

    avatar = db.get(AvatarImage, user.id)
    if avatar is None:
        avatar = AvatarImage(user_id=user.id, data=data, content_type="image/jpeg")
        db.add(avatar)
    else:
        avatar.data = data
        avatar.content_type = "image/jpeg"

    profile = user.profile
    if profile is None:
        profile = Profile(user_id=user.id)
        db.add(profile)
    # Version the URL with a content hash so the app (and any CDN) refetches
    # when the photo changes but caches it otherwise.
    version = hashlib.sha256(data).hexdigest()[:12]
    base = settings.PUBLIC_API_BASE_URL.rstrip("/")
    profile.avatar_url = f"{base}{settings.API_V1_PREFIX}/auth/avatar/{user.id}?v={version}"
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/avatar/{user_id}")
def serve_avatar(user_id: str, db: Session = Depends(get_db)):
    """Public read of a user's avatar bytes. Unauthenticated so <Image> can load
    it directly; user ids are unguessable UUIDs and avatars aren't sensitive."""
    from fastapi import Response

    avatar = db.get(AvatarImage, user_id)
    if avatar is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No avatar.")
    return Response(
        content=avatar.data,
        media_type=avatar.content_type or "image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


def _get_privacy_pref(db: Session, user_id: str) -> PrivacyPreference:
    pref = db.query(PrivacyPreference).filter(PrivacyPreference.user_id == user_id).first()
    if pref:
        return pref
    pref = PrivacyPreference(user_id=user_id, retention_days=90, require_device_unlock=False)
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref


@router.get("/me/privacy", response_model=PrivacyPreferenceOut)
def get_privacy_preferences(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_privacy_pref(db, user.id)


@router.put("/me/privacy", response_model=PrivacyPreferenceOut)
def update_privacy_preferences(
    payload: PrivacyPreferenceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = _get_privacy_pref(db, user.id)
    pref.retention_days = payload.retention_days
    pref.require_device_unlock = payload.require_device_unlock
    pref.updated_at = datetime.now(timezone.utc)
    apply_retention_policy(db, user.id)
    db.commit()
    db.refresh(pref)
    return pref


@router.get("/me/sessions", response_model=list[AuthSessionOut])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(AuthSession)
        .filter(AuthSession.user_id == user.id)
        .order_by(AuthSession.last_used_at.desc())
        .limit(50)
        .all()
    )


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.get(AuthSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    session.is_active = False
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()


@router.get("/me/devices", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Device)
        .filter(Device.user_id == user.id)
        .order_by(Device.last_seen_at.desc().nullslast(), Device.created_at.desc())
        .limit(50)
        .all()
    )


@router.delete("/me/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_device(device_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    device = db.get(Device, device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    device.revoked_at = datetime.now(timezone.utc)
    db.commit()


@router.get("/me/export")
def export_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return a complete, portable export of the caller's user-owned data."""
    scans = (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == user.id)
        .order_by(ScanHistory.created_at.desc())
        .all()
    )
    scan_ids = [scan.id for scan in scans]
    incidents = (
        db.query(Incident)
        .filter(Incident.user_id == user.id)
        .order_by(Incident.created_at.desc())
        .all()
    )
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    community_reports = (
        db.query(CommunityReport)
        .filter(CommunityReport.user_id == user.id)
        .order_by(CommunityReport.created_at.desc())
        .all()
    )
    identity_alerts = (
        db.query(IdentityAlert)
        .filter(IdentityAlert.user_id == user.id)
        .order_by(IdentityAlert.created_at.desc())
        .all()
    )
    devices = (
        db.query(Device)
        .filter(Device.user_id == user.id)
        .order_by(Device.created_at.desc())
        .all()
    )
    sessions = (
        db.query(AuthSession)
        .filter(AuthSession.user_id == user.id)
        .order_by(AuthSession.last_used_at.desc())
        .all()
    )
    feedback_details = (
        db.query(ScanFeedbackDetail)
        .filter(ScanFeedbackDetail.user_id == user.id)
        .order_by(ScanFeedbackDetail.created_at.desc())
        .all()
    )

    def owned(model):
        return db.query(model).filter(model.user_id == user.id).all()

    def for_scans(model):
        return db.query(model).filter(model.scan_id.in_(scan_ids)).all() if scan_ids else []

    incident_ids = [incident.id for incident in incidents]
    avatar = db.get(AvatarImage, user.id)
    avatar_export = None
    if avatar:
        avatar_export = {
            "content_type": avatar.content_type,
            "updated_at": avatar.updated_at,
            "sha256": hashlib.sha256(avatar.data).hexdigest(),
            "data_base64": base64.b64encode(avatar.data).decode("ascii"),
        }

    # Credential verifiers and one-time-code hashes are deliberately omitted:
    # they are authentication material, not portable account content.
    session_metadata = [
        {
            "id": row.id,
            "user_agent": row.user_agent,
            "ip_address": row.ip_address,
            "is_active": row.is_active,
            "created_at": row.created_at,
            "last_used_at": row.last_used_at,
            "expires_at": row.expires_at,
            "revoked_at": row.revoked_at,
        }
        for row in sessions
    ]
    api_keys = [
        {
            "id": row.id,
            "name": row.name,
            "key_prefix": row.key_prefix,
            "scopes": row.scopes,
            "is_active": row.is_active,
            "created_at": row.created_at,
            "last_used_at": row.last_used_at,
        }
        for row in owned(ApiKey)
    ]

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": _user_out(user),
        "privacy_preferences": _get_privacy_pref(db, user.id),
        "notification_preferences": db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).first(),
        "avatar": avatar_export,
        "devices": devices,
        "push_receipts": owned(PushReceipt),
        "sessions": session_metadata,
        "social_identities": owned(SocialIdentity),
        "scans": scans,
        "risk_reports": for_scans(RiskReport),
        "link_scans": for_scans(LinkScan),
        "image_scans": for_scans(ImageScan),
        "qr_scans": for_scans(QRScan),
        "message_scans": for_scans(MessageScan),
        "email_scans": for_scans(EmailScan),
        "phone_scans": for_scans(PhoneScan),
        "marketplace_scans": for_scans(MarketplaceScan),
        "social_scans": for_scans(SocialScan),
        "incidents": incidents,
        "incident_evidence": db.query(IncidentEvidence).filter(IncidentEvidence.incident_id.in_(incident_ids)).all() if incident_ids else [],
        "case_pack_shares": [
            {
                "id": row.id,
                "incident_id": row.incident_id,
                "expires_at": row.expires_at,
                "created_at": row.created_at,
                "revoked_at": row.revoked_at,
            }
            for row in owned(CasePackShare)
        ],
        "notifications": notifications,
        "community_reports": community_reports,
        "trusted_contacts": owned(TrustedContact),
        "monitored_identities": owned(MonitoredIdentity),
        "breach_records": owned(BreachRecord),
        "identity_alerts": identity_alerts,
        "broker_opt_outs": owned(BrokerOptOut),
        "browser_telemetry": owned(BrowserTelemetryEvent),
        "extension_telemetry": owned(ExtensionTelemetryEvent),
        "education_progress": owned(EducationProgress),
        "api_usage": owned(ApiUsage),
        "api_keys": api_keys,
        "personal_blocked_numbers": owned(PersonalBlockedNumber),
        "audit_log": owned(AuditLog),
        "billing_events": owned(BillingWebhookEvent),
        "scan_feedback_details": feedback_details,
    }


@router.delete("/me/scan-history")
def purge_scan_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    deleted = _delete_user_scans(db, user.id)
    db.add(AuditLog(user_id=user.id, action="purge_scan_history", detail={"deleted_scans": deleted}))
    db.commit()
    return {"deleted_scans": deleted}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    delete_user_account(db, user)
    db.commit()
