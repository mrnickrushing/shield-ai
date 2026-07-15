"""Smoke tests for Phase 1 — run with: pytest (uses SQLite in-memory)."""
import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"

import base64
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.models import User

# Shared in-memory SQLite for the test session.
engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def _override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_db
client = TestClient(app)


def _fake_apple_token(subject: str, email: str | None = None) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = {"sub": subject}
    if email is not None:
        payload["email"] = email
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{header}.{body}.signature"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_login_flow():
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "supersecret1", "display_name": "Test"},
    )
    assert r.status_code == 201, r.text
    tokens = r.json()
    assert "access_token" in tokens

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "test@example.com"


def test_register_normalizes_email():
    # Use a distinct local-part so this doesn't collide with the address
    # registered in test_register_login_flow (shared in-memory DB).
    r = client.post(
        "/api/v1/auth/register",
        json={"email": " NORMALIZE@Example.com ", "password": "supersecret1", "display_name": "Test"},
    )
    assert r.status_code == 201, r.text
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {r.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "normalize@example.com"


def test_cors_default_does_not_allow_wildcard_with_credentials():
    from app.core.config import settings

    assert "*" not in settings.CORS_ORIGINS


def test_apple_social_auth_reuses_identity_without_email(monkeypatch):
    from app.api.v1 import auth as auth_routes

    raw_nonce = "raw-apple-nonce-for-test"
    claims_by_token = {
        "verified-apple-token-1": {"sub": "apple-user-123", "email": "apple-user@example.com"},
        "verified-apple-token-2": {"sub": "apple-user-123"},
    }

    def verify_apple_token(token: str, nonce: str):
        assert nonce == raw_nonce
        return claims_by_token[token]

    monkeypatch.setattr(
        auth_routes,
        "_verify_apple_identity_token",
        verify_apple_token,
    )

    token1 = "verified-apple-token-1"
    r1 = client.post(
        "/api/v1/auth/social",
        json={"provider": "apple", "token": token1, "nonce": raw_nonce, "display_name": "Apple User"},
    )
    assert r1.status_code == 200, r1.text

    token2 = "verified-apple-token-2"
    r2 = client.post(
        "/api/v1/auth/social",
        json={"provider": "apple", "token": token2, "nonce": raw_nonce},
    )
    assert r2.status_code == 200, r2.text

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {r2.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "apple-user@example.com"


def test_apple_social_auth_rejects_unsigned_forged_token():
    token1 = _fake_apple_token("apple-user-123", "apple-user@example.com")
    r1 = client.post(
        "/api/v1/auth/social",
        json={
            "provider": "apple",
            "token": token1,
            "nonce": "raw-apple-nonce-for-test",
            "display_name": "Apple User",
        },
    )
    assert r1.status_code == 400, r1.text


def test_apple_social_auth_requires_nonce(monkeypatch):
    from app.api.v1 import auth as auth_routes

    def fail_if_called(_token: str, _nonce: str):
        raise AssertionError("Apple verifier should not run without a nonce")

    monkeypatch.setattr(auth_routes, "_verify_apple_identity_token", fail_if_called)
    r = client.post(
        "/api/v1/auth/social",
        json={"provider": "apple", "token": "verified-apple-token"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "Apple nonce is required"


def test_update_profile():
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "prof@example.com", "password": "supersecret1", "display_name": "Old"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    r = client.patch("/api/v1/auth/me", json={"display_name": "New Name"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["display_name"] == "New Name"
    # Profiles expose an avatar_url, empty until one is uploaded.
    assert r.json()["avatar_url"] == ""


def _avatar_headers() -> dict:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": f"avatar_{uuid.uuid4().hex}@example.com", "password": "supersecret1", "display_name": "Pic"},
    )
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


def test_avatar_upload_unconfigured_returns_503():
    # Without R2 credentials the endpoint must fail cleanly, not 500.
    headers = _avatar_headers()
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )
    r = client.post(
        "/api/v1/auth/me/avatar",
        files={"file": ("a.png", png, "image/png")},
        headers=headers,
    )
    assert r.status_code == 503, r.text


def test_avatar_upload_rejects_non_image(monkeypatch):
    from app.services import object_storage

    monkeypatch.setattr(object_storage, "storage_configured", lambda: True)
    headers = _avatar_headers()
    r = client.post(
        "/api/v1/auth/me/avatar",
        files={"file": ("a.jpg", b"this is not an image", "image/jpeg")},
        headers=headers,
    )
    assert r.status_code == 400, r.text


def test_account_export_purge_and_delete_controls():
    headers = _auth_headers(premium=True)
    privacy = client.put(
        "/api/v1/auth/me/privacy",
        json={"retention_days": 30, "require_device_unlock": True},
        headers=headers,
    )
    assert privacy.status_code == 200, privacy.text
    assert privacy.json()["require_device_unlock"] is True

    sessions = client.get("/api/v1/auth/me/sessions", headers=headers)
    assert sessions.status_code == 200, sessions.text
    assert len(sessions.json()) >= 1

    device = client.post(
        "/api/v1/notifications/devices",
        json={"push_token": "ExponentPushToken[privacy]", "platform": "ios", "label": "Test iPhone"},
        headers=headers,
    )
    assert device.status_code == 204, device.text
    devices = client.get("/api/v1/auth/me/devices", headers=headers)
    assert devices.status_code == 200, devices.text
    assert devices.json()[0]["label"] == "Test iPhone"
    revoke_device = client.delete(f"/api/v1/auth/me/devices/{devices.json()[0]['id']}", headers=headers)
    assert revoke_device.status_code == 204, revoke_device.text

    scan = client.post(
        "/api/v1/scans/message",
        json={"message_text": "You won a prize. Click now.", "platform_hint": "sms"},
        headers=headers,
    )
    assert scan.status_code == 201, scan.text
    scan_id = scan.json()["id"]
    incident = client.post(
        "/api/v1/recovery/incidents",
        json={"incident_type": "gift_card", "linked_scan_id": scan_id, "title": "Gift card scam"},
        headers=headers,
    )
    assert incident.status_code == 201, incident.text
    report = client.post(
        "/api/v1/community/reports",
        json={"scan_id": scan_id, "report_type": "missed_scam", "artifact_text": "Correction details"},
        headers=headers,
    )
    assert report.status_code == 201, report.text
    feedback = client.post(
        f"/api/v1/scans/{scan_id}/feedback-detail",
        json={"feedback": "missed_scam", "reason": "Missed this", "corrected_context": "Corrected", "evidence": "Evidence"},
        headers=headers,
    )
    assert feedback.status_code == 201, feedback.text
    assert feedback.json()["review_status"] == "pending"

    case_pack = client.get(f"/api/v1/recovery/incidents/{incident.json()['id']}/case-pack?format=json", headers=headers)
    assert case_pack.status_code == 200, case_pack.text
    assert case_pack.json()["case"]["id"] == incident.json()["id"]
    case_pack_pdf = client.get(f"/api/v1/recovery/incidents/{incident.json()['id']}/case-pack?format=pdf", headers=headers)
    assert case_pack_pdf.status_code == 200, case_pack_pdf.text
    assert case_pack_pdf.headers["content-type"] == "application/pdf"
    assert case_pack_pdf.content.startswith(b"%PDF")
    share = client.post(f"/api/v1/recovery/incidents/{incident.json()['id']}/share", headers=headers)
    assert share.status_code == 200, share.text
    shared = client.get(share.json()["url"])
    assert shared.status_code == 200, shared.text
    assert "Shield AI Recovery Case Pack" in shared.text

    export = client.get("/api/v1/auth/me/export", headers=headers)
    assert export.status_code == 200, export.text
    exported = export.json()
    assert exported["user"]["email"]
    assert exported["privacy_preferences"]["retention_days"] == 30
    assert len(exported["sessions"]) >= 1
    assert any(item["id"] == scan_id for item in exported["scans"])
    assert len(exported["incidents"]) >= 1
    assert len(exported["community_reports"]) >= 1
    assert len(exported["scan_feedback_details"]) >= 1

    purge = client.delete("/api/v1/auth/me/scan-history", headers=headers)
    assert purge.status_code == 200, purge.text
    assert purge.json()["deleted_scans"] >= 1
    scans = client.get("/api/v1/scans", headers=headers)
    assert scans.status_code == 200
    assert scans.json() == []
    incidents = client.get("/api/v1/recovery/incidents", headers=headers)
    assert incidents.status_code == 200
    assert incidents.json()[0]["linked_scan_id"] is None

    delete = client.delete("/api/v1/auth/me", headers=headers)
    assert delete.status_code == 204, delete.text
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 401


def test_notification_preferences_round_trip():
    headers = _auth_headers()
    current = client.get("/api/v1/notifications/preferences", headers=headers)
    assert current.status_code == 200, current.text
    payload = current.json()
    payload["push_enabled"] = False
    payload["minimum_severity"] = "high"
    payload["topics"]["community"] = True
    updated = client.put("/api/v1/notifications/preferences", json=payload, headers=headers)
    assert updated.status_code == 200, updated.text
    assert updated.json()["push_enabled"] is False
    assert updated.json()["minimum_severity"] == "high"
    assert updated.json()["topics"]["community"] is True


def test_realtime_monitoring_targets_and_telemetry():
    headers = _auth_headers(premium=True)
    target = client.post(
        "/api/v1/monitoring/targets",
        json={"target_type": "email", "value": "monitor@example.com", "label": "Primary"},
        headers=headers,
    )
    assert target.status_code == 201, target.text
    assert target.json()["last_checked_at"] is not None
    assert target.json()["last_status"] != "pending"
    listed = client.get("/api/v1/monitoring/targets", headers=headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()[0]["value"] == "monitor@example.com"

    browser = client.post(
        "/api/v1/monitoring/browser-events",
        json={"url": "https://bad.example/login", "domain": "bad.example", "verdict": "critical", "action": "blocked", "reason": "test"},
        headers=headers,
    )
    assert browser.status_code == 201, browser.text
    notifications = client.get("/api/v1/notifications", headers=headers).json()
    assert any(n["title"] == "Safe Browser risk detected" for n in notifications)

    extension = client.post(
        "/api/v1/monitoring/extension-events",
        json={"extension_type": "call_directory", "event_type": "blocked", "counts": {"blocked": 1}},
        headers=headers,
    )
    assert extension.status_code == 201, extension.text
    summary = client.get("/api/v1/monitoring/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()["monitored_targets"] >= 1

    removed = client.delete(f"/api/v1/monitoring/targets/{target.json()['id']}", headers=headers)
    assert removed.status_code == 204, removed.text


def test_monitoring_target_requires_premium():
    headers = _auth_headers()
    first = client.post(
        "/api/v1/monitoring/targets",
        json={"target_type": "email", "value": "free-monitor@example.com"},
        headers=headers,
    )
    assert first.status_code == 402, first.text


def test_family_contact_requires_premium():
    headers = _auth_headers()
    r = client.post(
        "/api/v1/family/contacts",
        json={"name": "Mom", "phone": "+15551234567"},
        headers=headers,
    )
    assert r.status_code == 402, r.text


def test_family_contact_premium_allows_add():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/family/contacts",
        json={"name": "Mom", "phone": "+15551234567"},
        headers=headers,
    )
    assert r.status_code == 201, r.text


def test_link_scan_requires_auth():
    r = client.post("/api/v1/scans/link", json={"url": "http://example.com"})
    assert r.status_code in (401, 403)


def test_risk_engine_flags_typosquat():
    from app.services import risk_engine

    ev = {
        "uses_https": False,
        "typosquat_brand": "paypal",
        "suspicious_tld": True,
        "tld": "xyz",
        "redirect_count": 0,
        "safe_browsing_hit": False,
    }
    score, flags = risk_engine.score_url_evidence(ev)
    assert score > 0
    assert any("paypal" in f.lower() for f in flags)


# ---------------------------------------------------------------------------
# Phase 2 — service unit tests
# ---------------------------------------------------------------------------

def test_message_analyzer_detects_prize_scam():
    from app.services import message_analyzer

    text = "Congratulations! You won a prize. Click here to claim your reward now!"
    result = message_analyzer.analyze_message(text)
    assert result["signals"].get("prize_scam_signals")
    assert result["category"] == "social_engineering"
    assert len(result["flags"]) > 0


def test_message_analyzer_detects_delivery_scam():
    from app.services import message_analyzer

    text = "Your USPS parcel is on hold. Confirm your address to avoid return."
    result = message_analyzer.analyze_message(text, platform_hint="sms")
    assert result["signals"].get("delivery_scam_signals")
    assert result["signals"].get("sms_with_link") is None  # no URL in text


def test_message_analyzer_extracts_urls():
    from app.services import message_analyzer

    text = "Check this link: https://suspicious-site.xyz/claim and act fast!"
    result = message_analyzer.analyze_message(text)
    assert "https://suspicious-site.xyz/claim" in result["extracted_urls"]


def test_email_analyzer_detects_sender_mismatch():
    from app.services import email_analyzer

    result = email_analyzer.analyze_email(
        sender_email="support@totally-not-paypal.ru",
        sender_display_name="PayPal Support",
        subject="Action Required: Verify your account",
    )
    assert result["signals"]["sender_display_mismatch"] is True
    assert result["signals"]["urgent_subject"] is True
    assert result["category"] == "impersonation"


def test_email_analyzer_detects_reply_to_hijack():
    from app.services import email_analyzer

    result = email_analyzer.analyze_email(
        sender_email="noreply@apple.com",
        sender_display_name="Apple",
        reply_to_email="harvest@attacker.net",
        subject="Your account",
    )
    assert result["signals"]["reply_to_mismatch"] is True


def test_phone_analyzer_flags_scam_area_code():
    from app.services import phone_lookup

    result = phone_lookup.analyze_phone("+1 (876) 555-0100")
    assert result["signals"].get("known_scam_area_code") is True
    assert result["category"] == "social_engineering"


def test_phone_analyzer_flags_premium_rate():
    from app.services import phone_lookup

    result = phone_lookup.analyze_phone("1-900-555-0100")
    assert result["signals"].get("premium_rate") is True


def test_qr_scan_endpoint_requires_auth():
    r = client.post("/api/v1/scans/qr", json={"qr_content": "https://example.com"})
    assert r.status_code in (401, 403)


def test_message_scan_endpoint_requires_auth():
    r = client.post("/api/v1/scans/message", json={"message_text": "Hello"})
    assert r.status_code in (401, 403)


def test_email_scan_endpoint_requires_auth():
    r = client.post("/api/v1/scans/email", json={"subject": "Test", "body_text": "Body"})
    assert r.status_code in (401, 403)


def test_phone_scan_endpoint_requires_auth():
    r = client.post("/api/v1/scans/phone", json={"phone_number": "+15551234567"})
    assert r.status_code in (401, 403)


def _auth_headers(premium: bool = False) -> dict:
    email = f"p2test+{uuid.uuid4().hex}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "P2"},
    )
    if premium:
        db = TestingSession()
        try:
            user = db.query(User).filter(User.email == email).first()
            user.is_premium = True
            db.commit()
        finally:
            db.close()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_message_scan_full_flow():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/scans/message",
        json={"message_text": "Congratulations! You won a prize. Click now!", "platform_hint": "sms"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["scan_type"] == "message"
    assert data["status"] == "completed"
    assert data["report"] is not None
    assert data["report"]["risk_score"] >= 0


def test_email_scan_full_flow():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/scans/email",
        json={
            "sender_email": "support@paypal-secure.xyz",
            "sender_display_name": "PayPal",
            "subject": "Action Required: Verify your account immediately",
            "body_text": "Click here to verify: http://paypal-secure.xyz/login",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["scan_type"] == "email"
    assert data["report"]["risk_score"] > 30


def test_phone_scan_full_flow():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/scans/phone",
        json={"phone_number": "+1-876-555-0100"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["scan_type"] == "phone"
    assert data["status"] == "completed"


def test_qr_scan_full_flow():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/scans/qr",
        json={"qr_content": "https://paypal-login.xyz/secure"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["scan_type"] == "qr"
    assert data["report"] is not None


def test_notifications_list():
    headers = _auth_headers(premium=True)
    # trigger a scan to create a notification
    client.post(
        "/api/v1/scans/message",
        json={"message_text": "You won a prize!"},
        headers=headers,
    )
    r = client.get("/api/v1/notifications", headers=headers)
    assert r.status_code == 200
    notifs = r.json()
    assert len(notifs) >= 1
    assert "title" in notifs[0]


def test_notifications_mark_read():
    headers = _auth_headers(premium=True)
    client.post(
        "/api/v1/scans/message",
        json={"message_text": "You won a prize!"},
        headers=headers,
    )
    notifs = client.get("/api/v1/notifications", headers=headers).json()
    notif_id = notifs[0]["id"]
    r = client.post(f"/api/v1/notifications/{notif_id}/read", headers=headers)
    assert r.status_code == 204


def test_device_registration():
    headers = _auth_headers()
    r = client.post(
        "/api/v1/notifications/devices",
        json={"push_token": "ExponentPushToken[test123]", "platform": "ios"},
        headers=headers,
    )
    assert r.status_code == 204


def test_email_scan_requires_at_least_one_field():
    headers = _auth_headers()
    r = client.post("/api/v1/scans/email", json={}, headers=headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Phase 3 — service unit tests
# ---------------------------------------------------------------------------

def test_marketplace_analyzer_detects_overpayment():
    from app.services import marketplace_analyzer

    text = "I'll send you a check for $500 over the price. Just wire me back the difference."
    result = marketplace_analyzer.analyze_marketplace(text)
    assert result["signals"].get("overpayment_scam") is True
    assert result["category"] == "payment_fraud"
    assert len(result["flags"]) > 0


def test_marketplace_analyzer_detects_payment_bypass():
    from app.services import marketplace_analyzer

    text = "Don't use the app payment. Send via Zelle or Venmo directly to avoid fees."
    result = marketplace_analyzer.analyze_marketplace(text)
    assert result["signals"].get("payment_bypass") is True


def test_marketplace_analyzer_detects_fake_escrow():
    from app.services import marketplace_analyzer

    text = "Use our secure escrow service to hold funds. Click here to set it up."
    result = marketplace_analyzer.analyze_marketplace(text)
    assert result["signals"].get("fake_escrow") is True


def test_social_analyzer_detects_fake_giveaway():
    from app.services import social_analyzer

    text = "Like, share and win! DM to claim your prize today. 100 winner selected randomly!"
    result = social_analyzer.analyze_social(text)
    assert result["signals"].get("fake_giveaway") is True
    assert result["category"] == "social_engineering"


def test_social_analyzer_detects_crypto_lure():
    from app.services import social_analyzer

    text = "Double your bitcoin now! Guaranteed returns. Send BTC receive back double!"
    result = social_analyzer.analyze_social(text)
    assert result["signals"].get("crypto_investment_lure") is True
    assert result["category"] == "payment_fraud"


def test_social_analyzer_detects_account_takeover():
    from app.services import social_analyzer

    text = "Your account will be suspended in 24 hours. Violating community standards. Appeal click here."
    result = social_analyzer.analyze_social(text)
    assert result["signals"].get("account_takeover_attempt") is True
    assert result["category"] == "credential_theft"


def test_breach_check_no_api_key():
    from app.services import breach_check

    # With no HIBP key configured, should return empty breach list gracefully
    result = breach_check.check_breaches("nobody@example.com")
    assert result["breach_count"] == 0
    assert result["severity"] == "none"
    assert result["data_available"] is False
    assert "disclaimer" in result


def test_breach_severity_logic():
    from app.services import breach_check

    assert breach_check._severity([]) == "none"
    assert breach_check._severity([{"data_classes": ["Usernames"]}]) == "low"
    assert (
        breach_check._severity([
            {"data_classes": ["Usernames"]},
            {"data_classes": ["Email addresses"]},
        ]) == "medium"
    )
    assert (
        breach_check._severity([
            {"data_classes": ["Passwords"]},
        ]) == "high"
    )


def test_marketplace_scan_endpoint_requires_auth():
    r = client.post("/api/v1/scans/marketplace", json={"content_text": "Test listing"})
    assert r.status_code in (401, 403)


def test_social_scan_endpoint_requires_auth():
    r = client.post("/api/v1/scans/social", json={"content_text": "Test post"})
    assert r.status_code in (401, 403)


def test_identity_breach_check_requires_auth():
    r = client.post("/api/v1/identity/breach-check", json={"email": "test@example.com"})
    assert r.status_code in (401, 403)


def test_identity_alerts_requires_auth():
    r = client.get("/api/v1/identity/alerts")
    assert r.status_code in (401, 403)


def test_marketplace_scan_full_flow():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/scans/marketplace",
        json={
            "content_text": (
                "I'll overpay with a check. Send me back the difference via Zelle. "
                "Use our secure escrow: http://fake-escrow.xyz/hold"
            ),
            "platform_hint": "facebook",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["scan_type"] == "marketplace"
    assert data["status"] == "completed"
    assert data["report"]["risk_score"] > 40


def test_social_scan_full_flow():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/scans/social",
        json={
            "content_text": "Like and share to win! DM to claim your iPhone prize now!",
            "platform": "instagram",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["scan_type"] == "social"
    assert data["status"] == "completed"
    assert data["report"] is not None


def test_identity_breach_check_no_hibp_key():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/identity/breach-check",
        json={"email": "nobody@example.com"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "nobody@example.com"
    assert data["breach_count"] == 0
    assert data["data_available"] is False
    assert "disclaimer" in data


def test_identity_alerts_list():
    headers = _auth_headers()
    r = client.get("/api/v1/identity/alerts", headers=headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_password_check_clean():
    headers = _auth_headers(premium=True)
    r = client.post(
        "/api/v1/identity/password-check",
        json={"password": "some-password-to-check"},
        headers=headers,
    )
    # Returns 200 with result if HIBP is reachable, or 503 when network is unavailable.
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        data = r.json()
        assert "pwned_count" in data
        assert "is_compromised" in data
        assert "recommendation" in data


def test_password_check_requires_password_field():
    headers = _auth_headers(premium=True)
    r = client.post("/api/v1/identity/password-check", json={}, headers=headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Phase 5 — moat + B2B service unit tests
# ---------------------------------------------------------------------------

def test_model_router_returns_config_per_type():
    from app.services import model_router

    for artifact_type in ["link", "image", "qr", "message", "email", "phone", "marketplace", "social"]:
        cfg = model_router.get_config(artifact_type)
        assert cfg.model
        assert 0 <= cfg.temperature <= 1
        assert cfg.max_tokens > 0
        assert cfg.system_hint


def test_model_router_unknown_type_returns_default():
    from app.services import model_router

    cfg = model_router.get_config("unknown_type")
    assert cfg.model == "claude-haiku-4-5-20251001"


def test_threat_intel_matches_regex_pattern():
    from app.models.models import ScamPattern
    from app.services import threat_intel

    # Test db=None guard
    boost, flags = threat_intel.check_patterns(
        db=None,  # type: ignore[arg-type]
        text="any text",
        artifact_type="message",
    )
    assert boost == 0
    assert flags == []

    # Test real regex match using in-memory test DB
    db = TestingSession()
    try:
        pattern = ScamPattern(
            name="test_regex",
            description="test",
            pattern_type="regex",
            artifact_types=["message"],
            pattern_data={"regex": "irs.*arrest", "flags": "i"},
            risk_score_boost=55,
            category="government_impersonation",
            source="analyst",
        )
        db.add(pattern)
        db.commit()
        boost, flags = threat_intel.check_patterns(db, "irs arrest warrant call now", "message")
        assert boost == 55
        assert len(flags) == 1
        assert "test_regex" in flags[0]
    finally:
        db.delete(pattern)
        db.commit()
        db.close()


def test_community_report_endpoint_requires_auth():
    r = client.post("/api/v1/community/reports", json={"report_type": "new_pattern"})
    assert r.status_code in (401, 403)


def test_admin_stats_requires_auth():
    r = client.get("/api/v1/admin/stats")
    assert r.status_code in (401, 403)


def test_developer_keys_require_auth():
    r = client.get("/api/v1/developer/keys")
    assert r.status_code in (401, 403)


def test_community_report_full_flow():
    headers = _auth_headers()
    r = client.post(
        "/api/v1/community/reports",
        json={
            "report_type": "new_pattern",
            "artifact_text": "You won a prize! Click here to claim it.",
            "category": "social_engineering",
            "platform_hint": "sms",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["report_type"] == "new_pattern"
    assert data["status"] == "pending"


def test_community_reports_list():
    headers = _auth_headers()
    client.post(
        "/api/v1/community/reports",
        json={"report_type": "false_positive", "artifact_text": "test"},
        headers=headers,
    )
    r = client.get("/api/v1/community/reports", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_community_patterns_list():
    # Public endpoint — no auth required
    r = client.get("/api/v1/community/patterns")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def _make_developer_headers() -> dict:
    """Register a user and promote them to developer via DB; return JWT headers."""
    from app.models.models import User as UserModel

    email = f"devuser+{uuid.uuid4().hex}@example.com"
    reg = client.post("/api/v1/auth/register", json={"email": email, "password": "supersecret1", "display_name": "Dev"})
    token = reg.json()["access_token"]
    user_id = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["id"]

    db = TestingSession()
    try:
        user = db.get(UserModel, user_id)
        user.is_developer = True
        user.is_premium = True
        db.commit()
    finally:
        db.close()

    return {"Authorization": f"Bearer {token}"}


def test_developer_key_requires_developer_flag():
    headers = _auth_headers()
    r = client.post(
        "/api/v1/developer/keys",
        json={"name": "Should Fail"},
        headers=headers,
    )
    assert r.status_code == 403


def test_developer_key_create_and_list():
    headers = _make_developer_headers()
    r = client.post(
        "/api/v1/developer/keys",
        json={"name": "Test Key", "scopes": ["scan:read"]},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["name"] == "Test Key"
    assert "raw_key" in data
    assert data["raw_key"].startswith("shld_")
    assert data["key_prefix"] == data["raw_key"][:12]

    list_r = client.get("/api/v1/developer/keys", headers=headers)
    assert list_r.status_code == 200
    keys = list_r.json()
    assert any(k["id"] == data["id"] for k in keys)


def test_developer_key_revoke():
    headers = _make_developer_headers()
    created = client.post(
        "/api/v1/developer/keys",
        json={"name": "Revoke Me"},
        headers=headers,
    ).json()
    r = client.delete(f"/api/v1/developer/keys/{created['id']}", headers=headers)
    assert r.status_code == 204

    keys = client.get("/api/v1/developer/keys", headers=headers).json()
    assert not any(k["id"] == created["id"] for k in keys)


def test_api_key_scope_enforcement():
    """A read-only API key must be rejected for write (scan creation) operations."""
    headers = _make_developer_headers()
    read_only_key = client.post(
        "/api/v1/developer/keys",
        json={"name": "Read Only", "scopes": ["scan:read"]},
        headers=headers,
    ).json()["raw_key"]

    r = client.post("/api/v1/scans/link", json={"url": "http://example.com"}, headers={"X-API-Key": read_only_key})
    assert r.status_code == 403


def test_api_key_auth_on_scan_endpoint():
    """A key with scan:write scope can create scans via X-API-Key header."""
    headers = _make_developer_headers()
    key_data = client.post(
        "/api/v1/developer/keys",
        json={"name": "Scan Key"},
        headers=headers,
    ).json()
    raw_key = key_data["raw_key"]

    # Use API key (with default scan:read + scan:write scopes) for a scan
    r = client.post("/api/v1/scans/link", json={"url": "http://example.com"}, headers={"X-API-Key": raw_key})
    assert r.status_code == 201, r.text
    assert r.json()["scan_type"] == "link"


def test_admin_requires_is_admin_flag():
    headers = _auth_headers()
    # Regular user should get 403 from admin endpoint
    r = client.get("/api/v1/admin/stats", headers=headers)
    assert r.status_code == 403


def test_education_catalog_public_and_completion_protected():
    lessons_r = client.get("/api/v1/education/lessons")
    assert lessons_r.status_code == 200, lessons_r.text
    lessons = lessons_r.json()
    assert len(lessons) >= 15
    assert any(lesson["slug"] == "bank-impersonation" for lesson in lessons)
    assert all(lesson["completed"] is False for lesson in lessons)

    phishing_r = client.get("/api/v1/education/lessons", params={"threat_category": "phishing"})
    assert phishing_r.status_code == 200, phishing_r.text
    assert phishing_r.json()
    assert all(lesson["threat_category"] == "phishing" for lesson in phishing_r.json())

    detail_r = client.get(f"/api/v1/education/lessons/{lessons[0]['slug']}")
    assert detail_r.status_code == 200, detail_r.text
    assert detail_r.json()["slug"] == lessons[0]["slug"]

    complete_r = client.post(f"/api/v1/education/lessons/{lessons[0]['id']}/complete", json={"answers": []})
    assert complete_r.status_code in (401, 403)


def test_scam_pattern_crud_admin():
    # Create an admin user by directly setting the flag via DB
    email = f"admin+{uuid.uuid4().hex}@example.com"
    reg = client.post("/api/v1/auth/register", json={"email": email, "password": "supersecret1", "display_name": "Admin"})
    token = reg.json()["access_token"]
    user_id = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["id"]

    # Promote via DB override
    from app.models.models import ApiKey, User as UserModel
    db = TestingSession()
    try:
        user = db.get(UserModel, user_id)
        user.is_admin = True
        key_user = UserModel(
            email=f"admin-key-owner-{uuid.uuid4().hex}@example.com",
            hashed_password="x",
            is_developer=True,
        )
        db.add(key_user)
        db.flush()
        db.add(ApiKey(user_id=key_user.id, name="Active", key_hash=f"h-{uuid.uuid4().hex}", key_prefix="shld_active", scopes=["scan:read"]))
        db.add(ApiKey(user_id=key_user.id, name="Revoked", key_hash=f"h-{uuid.uuid4().hex}", key_prefix="shld_revoked", scopes=["scan:read"], is_active=False))
        key_user_id = key_user.id
        db.commit()
    finally:
        db.close()

    admin_headers = {"Authorization": f"Bearer {token}"}

    # Stats should now work
    stats_r = client.get("/api/v1/admin/stats", headers=admin_headers)
    assert stats_r.status_code == 200
    stats = stats_r.json()
    assert "total_users" in stats
    assert "total_scans" in stats
    assert stats["active_api_keys"] >= 1
    assert stats["total_api_keys"] >= 2
    assert stats["revoked_api_keys"] >= 1

    users_r = client.get("/api/v1/admin/users", headers=admin_headers)
    assert users_r.status_code == 200, users_r.text
    key_owner = next(u for u in users_r.json() if u["id"] == key_user_id)
    assert key_owner["active_api_keys"] == 1
    assert key_owner["total_api_keys"] == 2
    assert key_owner["is_active"] is True

    operations_r = client.get("/api/v1/admin/operations", headers=admin_headers)
    assert operations_r.status_code == 200, operations_r.text
    assert "queues" in operations_r.json()

    detail_r = client.get(f"/api/v1/admin/users/{key_user_id}", headers=admin_headers)
    assert detail_r.status_code == 200, detail_r.text
    assert detail_r.json()["user"]["id"] == key_user_id

    api_keys_r = client.get("/api/v1/admin/api-keys", headers=admin_headers)
    assert api_keys_r.status_code == 200, api_keys_r.text
    active_key = next(k for k in api_keys_r.json() if k["user_id"] == key_user_id and k["is_active"])
    revoke_key = client.patch(f"/api/v1/admin/api-keys/{active_key['id']}", json={"is_active": False}, headers=admin_headers)
    assert revoke_key.status_code == 200, revoke_key.text

    disable_keys = client.post(f"/api/v1/admin/users/{key_user_id}/disable-api-keys", headers=admin_headers)
    assert disable_keys.status_code == 200, disable_keys.text

    test_notification = client.post(
        "/api/v1/admin/notifications/test",
        json={"user_id": key_user_id, "title": "Admin smoke", "body": "Notification diagnostics"},
        headers=admin_headers,
    )
    assert test_notification.status_code == 200, test_notification.text
    notifications_r = client.get("/api/v1/admin/notifications/diagnostics", headers=admin_headers)
    assert notifications_r.status_code == 200, notifications_r.text
    assert notifications_r.json()["total_notifications"] >= 1

    subscriptions_r = client.get("/api/v1/admin/subscriptions/diagnostics", headers=admin_headers)
    assert subscriptions_r.status_code == 200, subscriptions_r.text
    assert "premium_users" in subscriptions_r.json()

    audit_r = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert audit_r.status_code == 200, audit_r.text
    assert any(log["action"].startswith("admin_") for log in audit_r.json())

    delete_self = client.delete(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
    assert delete_self.status_code == 400

    delete_user = client.delete(f"/api/v1/admin/users/{key_user_id}", headers=admin_headers)
    assert delete_user.status_code == 204, delete_user.text
    assert not any(u["id"] == key_user_id for u in client.get("/api/v1/admin/users", headers=admin_headers).json())

    # Create a scam pattern
    pat_r = client.post(
        "/api/v1/admin/patterns",
        json={
            "name": f"test_pattern_{uuid.uuid4().hex}",
            "description": "Test pattern",
            "pattern_type": "regex",
            "artifact_types": ["message"],
            "pattern_data": {"regex": "test.*scam", "flags": "i"},
            "risk_score_boost": 30,
            "category": "social_engineering",
        },
        headers=admin_headers,
    )
    assert pat_r.status_code == 201, pat_r.text
    pat = pat_r.json()
    assert pat["risk_score_boost"] == 30

    # List patterns
    list_r = client.get("/api/v1/admin/patterns", headers=admin_headers)
    assert list_r.status_code == 200
    assert any(p["id"] == pat["id"] for p in list_r.json())

    # Disable the pattern
    del_r = client.delete(f"/api/v1/admin/patterns/{pat['id']}", headers=admin_headers)
    assert del_r.status_code == 204


def test_admin_feedback_review_queue_and_promotion():
    headers = _auth_headers(premium=True)
    scan = client.post(
        "/api/v1/scans/message",
        json={"message_text": "Suspicious correction seed.", "platform_hint": "sms"},
        headers=headers,
    )
    assert scan.status_code == 201, scan.text
    feedback = client.post(
        f"/api/v1/scans/{scan.json()['id']}/feedback-detail",
        json={
            "feedback": "missed_scam",
            "reason": "Analyst should review this.",
            "corrected_context": "wire money to release prize",
            "evidence": "sample evidence",
        },
        headers=headers,
    )
    assert feedback.status_code == 201, feedback.text

    email = f"admin-feedback+{uuid.uuid4().hex}@example.com"
    reg = client.post("/api/v1/auth/register", json={"email": email, "password": "supersecret1", "display_name": "Admin"})
    token = reg.json()["access_token"]
    user_id = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["id"]
    db = TestingSession()
    try:
        admin = db.get(User, user_id)
        admin.is_admin = True
        db.commit()
    finally:
        db.close()
    admin_headers = {"Authorization": f"Bearer {token}"}

    queue = client.get("/api/v1/admin/feedback", headers=admin_headers)
    assert queue.status_code == 200, queue.text
    assert any(item["id"] == feedback.json()["id"] for item in queue.json())

    reviewed = client.patch(
        f"/api/v1/admin/feedback/{feedback.json()['id']}",
        json={"review_status": "reviewed"},
        headers=admin_headers,
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["review_status"] == "reviewed"

    promoted = client.post(
        f"/api/v1/admin/feedback/{feedback.json()['id']}/pattern",
        json={
            "name": f"feedback_test_{uuid.uuid4().hex}",
            "description": "Promoted test feedback",
            "pattern_type": "keyword",
            "artifact_types": ["message"],
            "pattern_data": {"keywords": ["release prize"]},
            "risk_score_boost": 25,
            "category": "payment_fraud",
            "source": "feedback",
        },
        headers=admin_headers,
    )
    assert promoted.status_code == 201, promoted.text
    assert promoted.json()["source"] == "feedback"
