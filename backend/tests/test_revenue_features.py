"""Breach-reveal preview, broker opt-out letters/deadlines, coach gating,
and the blocklist-growth push."""
import uuid
from datetime import datetime, timedelta, timezone

from app.models.models import BrokerOptOut, SeededScamNumber, User

from tests.test_smoke import TestingSession, client


def _auth(premium: bool = False) -> tuple[str, dict]:
    email = f"rev-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "Rev Tester"},
    )
    assert res.status_code == 201, res.text
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    uid = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    if premium:
        db = TestingSession()
        try:
            db.get(User, uid).is_premium = True
            db.commit()
        finally:
            db.close()
    return uid, headers


# --- breach preview -----------------------------------------------------

def test_breach_preview_works_without_subscription():
    _, headers = _auth(premium=False)
    r = client.post(
        "/api/v1/identity/breach-preview",
        json={"email": "reveal@example.com"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # No HIBP key in tests: shape is right, data_available is false.
    assert set(body) == {"email", "breach_count", "severity", "top_breaches", "data_available"}
    assert body["data_available"] is False


def test_breach_preview_rate_limited():
    _, headers = _auth(premium=False)
    for _ in range(5):
        r = client.post(
            "/api/v1/identity/breach-preview",
            json={"email": "reveal@example.com"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
    r = client.post(
        "/api/v1/identity/breach-preview",
        json={"email": "reveal@example.com"},
        headers=headers,
    )
    assert r.status_code == 429, r.text


def test_breach_preview_rejects_bad_email():
    _, headers = _auth(premium=False)
    r = client.post(
        "/api/v1/identity/breach-preview",
        json={"email": "not-an-email"},
        headers=headers,
    )
    assert r.status_code == 422


# --- broker opt-out letters + deadlines ---------------------------------

def test_opt_out_letter_prefills_user_and_listing():
    uid, headers = _auth(premium=True)
    r = client.put(
        "/api/v1/identity/brokers/whitepages",
        json={"status": "found", "listing_url": "https://www.whitepages.com/name/rev-tester/x1"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["listing_url"].endswith("/x1")

    r = client.get("/api/v1/identity/brokers/whitepages/opt-out-letter", headers=headers)
    assert r.status_code == 200, r.text
    letter = r.json()
    assert letter["broker_name"] == "Whitepages"
    assert "Rev Tester" in letter["body"]
    assert "https://www.whitepages.com/name/rev-tester/x1" in letter["body"]
    assert "CCPA" in letter["body"]


def test_opt_out_letter_requires_premium():
    _, headers = _auth(premium=False)
    r = client.get("/api/v1/identity/brokers/whitepages/opt-out-letter", headers=headers)
    assert r.status_code == 402


def test_requested_broker_reports_deadline_and_overdue():
    uid, headers = _auth(premium=True)
    r = client.put(
        "/api/v1/identity/brokers/spokeo",
        json={"status": "requested"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["check_back_on"] is not None
    assert body["overdue"] is False

    # Age the request past the promised window; the summary flags it overdue.
    db = TestingSession()
    try:
        row = (
            db.query(BrokerOptOut)
            .filter(BrokerOptOut.user_id == uid, BrokerOptOut.broker_key == "spokeo")
            .one()
        )
        row.requested_at = datetime.now(timezone.utc) - timedelta(days=30)
        db.commit()
    finally:
        db.close()

    summary = client.get("/api/v1/identity/brokers", headers=headers).json()
    spokeo = next(b for b in summary["brokers"] if b["key"] == "spokeo")
    assert spokeo["overdue"] is True


def test_broker_recheck_task_alerts_on_overdue_and_removed():
    from app.services.monitoring import run_broker_rechecks

    uid, headers = _auth(premium=True)
    db = TestingSession()
    try:
        now = datetime.now(timezone.utc)
        db.add(BrokerOptOut(
            user_id=uid, broker_key="spokeo", status="requested",
            requested_at=now - timedelta(days=30), updated_at=now - timedelta(days=30),
        ))
        db.add(BrokerOptOut(
            user_id=uid, broker_key="whitepages", status="removed",
            updated_at=now - timedelta(days=45),
        ))
        db.commit()

        created = run_broker_rechecks(db)
        db.commit()
        assert created == 2

        # Re-running inside the throttle window creates nothing new.
        assert run_broker_rechecks(db) == 0
    finally:
        db.close()


# --- coach ----------------------------------------------------------------

def test_coach_requires_premium():
    _, headers = _auth(premium=False)
    r = client.post(
        "/api/v1/coach/chat",
        json={"messages": [{"role": "user", "content": "Is this text a scam?"}]},
        headers=headers,
    )
    assert r.status_code == 402


def test_coach_unavailable_without_api_key():
    # No ANTHROPIC_API_KEY in tests: premium callers get a clean 503, not a 500.
    _, headers = _auth(premium=True)
    r = client.post(
        "/api/v1/coach/chat",
        json={"messages": [{"role": "user", "content": "Is this text a scam?"}]},
        headers=headers,
    )
    assert r.status_code == 503


def test_coach_rejects_assistant_final_message():
    _, headers = _auth(premium=True)
    r = client.post(
        "/api/v1/coach/chat",
        json={"messages": [{"role": "assistant", "content": "Hello"}]},
        headers=headers,
    )
    assert r.status_code == 422


# --- blocklist growth push -------------------------------------------------

def test_blocklist_growth_push_targets_premium_users():
    from app.models.models import Notification
    from app.services.monitoring import run_blocklist_growth_push

    premium_uid, _ = _auth(premium=True)
    free_uid, _ = _auth(premium=False)

    db = TestingSession()
    try:
        for i in range(12):
            db.add(SeededScamNumber(number=f"1999555{i:04d}", label="Spam Risk"))
        db.commit()

        sent = run_blocklist_growth_push(db)
        db.commit()
        assert sent >= 1

        premium_notes = (
            db.query(Notification)
            .filter(Notification.user_id == premium_uid, Notification.title.contains("call shield"))
            .count()
        )
        free_notes = (
            db.query(Notification)
            .filter(Notification.user_id == free_uid, Notification.title.contains("call shield"))
            .count()
        )
        assert premium_notes == 1
        assert free_notes == 0
    finally:
        db.close()


# --- client error reporting -------------------------------------------------

def test_client_error_report_stored_without_premium():
    from app.models.models import AuditLog

    uid, headers = _auth(premium=False)
    r = client.post(
        "/api/v1/monitoring/client-errors",
        json={"message": "TypeError: undefined is not a function", "stack": "at Paywall", "is_fatal": True, "app_version": "1.2.0 (79)"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["stored"] is True

    db = TestingSession()
    try:
        row = (
            db.query(AuditLog)
            .filter(AuditLog.user_id == uid, AuditLog.action == "mobile_js_error")
            .one()
        )
        assert row.detail["message"].startswith("TypeError")
    finally:
        db.close()


def test_client_error_report_crash_loop_capped():
    uid, headers = _auth(premium=False)
    for _ in range(20):
        r = client.post(
            "/api/v1/monitoring/client-errors",
            json={"message": "boom"},
            headers=headers,
        )
        assert r.json()["stored"] is True
    r = client.post("/api/v1/monitoring/client-errors", json={"message": "boom"}, headers=headers)
    assert r.json()["stored"] is False
