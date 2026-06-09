"""Smoke tests for Phase 1 — run with: pytest (uses SQLite in-memory)."""
import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app

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


def _auth_headers() -> dict:
    import time
    email = f"p2test+{int(time.time()*1000)}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "P2"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_message_scan_full_flow():
    headers = _auth_headers()
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
    headers = _auth_headers()
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
    headers = _auth_headers()
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
    headers = _auth_headers()
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
    headers = _auth_headers()
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
    headers = _auth_headers()
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
