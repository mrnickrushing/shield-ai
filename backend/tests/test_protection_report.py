"""Weekly Protection Report tests — run with: pytest (uses SQLite in-memory)."""
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.models import (
    BrowserTelemetryEvent,
    ExtensionTelemetryEvent,
    Notification,
    RiskLevel,
    RiskReport,
    ScanHistory,
    ScanType,
    User,
)
from app.services.protection_report import build_report, run_weekly_reports, summarize

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


@pytest.fixture(autouse=True)
def _use_this_module_db():
    prev = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _override_db
    yield
    if prev is not None:
        app.dependency_overrides[get_db] = prev
    else:
        app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def _register(premium: bool = False) -> tuple[str, dict]:
    email = f"report-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "Rep"},
    )
    assert res.status_code == 201, res.text
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    uid = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    if premium:
        db = TestingSession()
        try:
            user = db.get(User, uid)
            user.is_premium = True
            db.commit()
        finally:
            db.close()
    return uid, headers


def _seed_activity(db, user_id: str) -> None:
    scan = ScanHistory(user_id=user_id, scan_type=ScanType.link, raw_input="http://bad.example")
    db.add(scan)
    db.flush()
    db.add(RiskReport(scan_id=scan.id, risk_score=90, risk_level=RiskLevel.critical))
    db.add(BrowserTelemetryEvent(user_id=user_id, url="http://bad.example", domain="bad.example", verdict="critical", action="blocked"))
    db.add(BrowserTelemetryEvent(user_id=user_id, url="http://meh.example", domain="meh.example", verdict="suspicious", action="warned"))
    db.add(ExtensionTelemetryEvent(user_id=user_id, extension_type="call_directory", event_type="sync", counts={"numbers_labeled": 42}))
    db.add(ExtensionTelemetryEvent(user_id=user_id, extension_type="message_filter", event_type="sync", counts={"texts_junked": 3}))
    db.commit()


def test_build_report_counts_everything():
    uid, _ = _register()
    db = TestingSession()
    try:
        _seed_activity(db, uid)
        report = build_report(db, uid)
    finally:
        db.close()
    assert report["scans_total"] == 1
    assert report["threats_caught"] == 1
    assert report["sites_blocked"] == 1
    assert report["sites_warned"] == 1
    assert report["calls_labeled"] == 42
    assert report["texts_junked"] == 3


def test_summary_mentions_top_items():
    uid, _ = _register()
    db = TestingSession()
    try:
        _seed_activity(db, uid)
        text = summarize(build_report(db, uid))
    finally:
        db.close()
    assert "blocked" in text or "caught" in text


def test_quiet_week_summary():
    text = summarize({
        "scans_total": 0, "threats_caught": 0, "sites_blocked": 0,
        "sites_warned": 0, "calls_labeled": 0, "texts_junked": 0,
        "new_breach_alerts": 0,
    })
    assert "quiet" in text.lower()


def test_endpoint_returns_report():
    uid, headers = _register(premium=True)
    db = TestingSession()
    try:
        _seed_activity(db, uid)
    finally:
        db.close()
    res = client.get("/api/v1/monitoring/report/weekly", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["threats_caught"] == 1
    assert "summary" in body


def test_endpoint_requires_premium():
    _, headers = _register()
    res = client.get("/api/v1/monitoring/report/weekly", headers=headers)
    assert res.status_code == 402, res.text


def test_run_weekly_reports_creates_notification_and_skips_dormant():
    active_uid, _ = _register(premium=True)
    _dormant_uid, _ = _register(premium=True)
    db = TestingSession()
    try:
        _seed_activity(db, active_uid)
        before = db.query(Notification).count()
        sent = run_weekly_reports(db)
        after_notes = db.query(Notification).filter(Notification.title == "Your Weekly Protection Report").all()
    finally:
        db.close()
    assert sent >= 1
    assert any(n.user_id == active_uid for n in after_notes)
    assert not any(n.user_id == _dormant_uid for n in after_notes)
    assert len(after_notes) >= before - before  # sanity
