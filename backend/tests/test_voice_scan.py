"""Voice scam analysis tests — run with: pytest (uses SQLite in-memory)."""
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
from app.models.models import User
from app.services.message_analyzer import analyze_voicemail

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

IRS_SCRIPT = (
    "This is the Internal Revenue Service. A warrant has been issued for your arrest "
    "due to unpaid back taxes. Call us back immediately at extension 402 before legal "
    "action is filed against you. Do not disregard this message."
)
GRANDMA_SCRIPT = (
    "Grandma it's me, I've been in an accident and I'm in jail. I need bail money "
    "right away. Please don't tell mom. Send money urgently, I'll explain later."
)
BENIGN_SCRIPT = (
    "Hey, it's Dave from the dentist's office confirming your cleaning on Tuesday "
    "at 2pm. Give us a call if you need to reschedule. Thanks, bye."
)


def _auth(premium: bool = True) -> dict:
    email = f"voice-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "V"},
    )
    assert res.status_code == 201, res.text
    if premium:
        db = TestingSession()
        try:
            user = db.query(User).filter(User.email == email).first()
            user.is_premium = True
            db.commit()
        finally:
            db.close()
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _scan(transcript: str, caller: str = "") -> dict:
    res = client.post(
        "/api/v1/scans/voice",
        json={"transcript": transcript, "caller_number": caller},
        headers=_auth(),
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_analyzer_flags_irs_callback_pressure():
    result = analyze_voicemail(IRS_SCRIPT)
    assert result["signals"].get("voicemail_scam_signals") is True
    assert result["signals"].get("authority_impersonation") is True
    assert result["artifact_type"] == "voice"


def test_analyzer_flags_family_emergency():
    result = analyze_voicemail(GRANDMA_SCRIPT)
    assert result["signals"].get("family_emergency_signals") is True


def test_analyzer_benign_voicemail_is_clean():
    result = analyze_voicemail(BENIGN_SCRIPT)
    assert not result["signals"].get("voicemail_scam_signals")
    assert not result["signals"].get("authority_impersonation")


def test_endpoint_scores_irs_script_high():
    body = _scan(IRS_SCRIPT, caller="+12025550143")
    assert body["scan_type"] == "voice"
    assert body["report"]["risk_level"] in ("high", "critical")


def test_endpoint_benign_stays_low():
    body = _scan(BENIGN_SCRIPT)
    assert body["report"]["risk_level"] in ("safe", "low")


def test_endpoint_rejects_tiny_transcript():
    res = client.post(
        "/api/v1/scans/voice",
        json={"transcript": "hi"},
        headers=_auth(),
    )
    assert res.status_code == 422


def test_voice_scan_lands_in_history():
    headers = _auth()
    res = client.post(
        "/api/v1/scans/voice",
        json={"transcript": GRANDMA_SCRIPT},
        headers=headers,
    )
    assert res.status_code == 201
    scans = client.get("/api/v1/scans", headers=headers).json()
    assert any(s["scan_type"] == "voice" for s in scans)
