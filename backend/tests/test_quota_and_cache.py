"""Fair-use scan cap + LLM dedupe cache."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "development")

import uuid
from datetime import datetime, timedelta, timezone

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


def test_daily_cap_uses_durable_rolling_history_even_with_redis(monkeypatch):
    # Quota truth comes from durable scan history, not a resettable Redis UTC
    # counter. Only records inside the rolling 24-hour window count.
    from app.services import quota

    import app.services.llm_cache as llm_cache

    monkeypatch.setattr(llm_cache, "get_redis", lambda: (_ for _ in ()).throw(AssertionError("Redis must not be used")))

    db = TestingSession()
    try:
        user_id = f"quota-window-{uuid.uuid4()}"
        db.add(ScanHistory(user_id=user_id, scan_type=ScanType.message, status=ScanStatus.completed))
        db.add(ScanHistory(
            user_id=user_id,
            scan_type=ScanType.message,
            status=ScanStatus.completed,
            created_at=datetime.now(timezone.utc) - timedelta(hours=25),
        ))
        db.commit()
        assert quota._daily_scan_count(db, user_id) == 1
    finally:
        db.close()


def test_llm_cache_reuses_identical_request(monkeypatch):
    monkeypatch.setattr(settings, "LLM_CACHE_TTL_SECONDS", 3600)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key")

    from app.services import ai_analyzer, llm_cache

    llm_cache._MEM_CACHE.clear()  # isolate from any prior cache state
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
