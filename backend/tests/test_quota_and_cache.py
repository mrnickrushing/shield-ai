"""Fair-use scan cap + LLM dedupe cache."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "development")

import uuid

from app.core.config import settings
from app.models.models import ScanHistory, ScanStatus, ScanType, User

from tests.test_smoke import TestingSession, client
from tests.test_smoke import _auth_headers  # premium-capable helper


def _premium_user_headers():
    email = f"quota+{uuid.uuid4().hex}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "Quota"},
    )
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    db = TestingSession()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.is_premium = True
        db.commit()
        return headers, user.id
    finally:
        db.close()


def test_scan_blocked_after_daily_limit(monkeypatch):
    monkeypatch.setattr(settings, "PREMIUM_DAILY_SCAN_LIMIT", 3)
    headers, user_id = _premium_user_headers()

    # Pre-seed the user at the cap with completed scans.
    db = TestingSession()
    try:
        for _ in range(3):
            db.add(ScanHistory(user_id=user_id, scan_type=ScanType.message, status=ScanStatus.completed))
        db.commit()
    finally:
        db.close()

    r = client.post(
        "/api/v1/scans/message",
        json={"message_text": "hello there", "platform_hint": "sms"},
        headers=headers,
    )
    assert r.status_code == 429, r.text
    assert "limit" in r.json()["detail"].lower()


def test_scan_allowed_under_limit(monkeypatch):
    monkeypatch.setattr(settings, "PREMIUM_DAILY_SCAN_LIMIT", 50)
    headers, _ = _premium_user_headers()
    r = client.post(
        "/api/v1/scans/message",
        json={"message_text": "is this a scam?", "platform_hint": "sms"},
        headers=headers,
    )
    assert r.status_code == 201, r.text


def test_llm_cache_reuses_identical_request(monkeypatch):
    monkeypatch.setattr(settings, "LLM_CACHE_TTL_SECONDS", 3600)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key")

    from app.services import ai_analyzer

    calls = {"n": 0}

    class _FakeResp:
        content = [type("C", (), {"text": '{"risk_score": 55, "risk_level": "suspicious", "red_flags": [], "category": "unknown", "explanation": "x", "recommended_actions": []}'})()]

    class _FakeMessages:
        def create(self, **kwargs):
            calls["n"] += 1
            return _FakeResp()

    class _FakeClient:
        def __init__(self, *a, **k):
            self.messages = _FakeMessages()

    monkeypatch.setattr(ai_analyzer, "llm_cache", ai_analyzer.llm_cache)
    import anthropic

    monkeypatch.setattr(anthropic, "Anthropic", _FakeClient)

    evidence = {"final_url": "http://evil.example/login"}
    first = ai_analyzer.analyze("URL: http://evil.example/login", evidence, artifact_type="link")
    second = ai_analyzer.analyze("URL: http://evil.example/login", evidence, artifact_type="link")

    assert first == second
    assert calls["n"] == 1  # second call served from cache, no repeat LLM hit
