"""Protection score + trends tests — run with: pytest (uses SQLite in-memory)."""
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


def _auth() -> dict:
    email = f"score-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "S"},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_new_user_scores_low_with_full_fix_list():
    headers = _auth()
    res = client.get("/api/v1/monitoring/protection-score", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["score"] == 0
    assert len(body["fixes"]) == 3  # top 3 only
    assert all(not c["earned"] for c in body["components"])
    # Highest-impact fixes come first
    assert body["fixes"][0]["points"] >= body["fixes"][-1]["points"]


def test_scanning_and_monitoring_raise_score():
    headers = _auth()
    client.post("/api/v1/scans/message", json={"message_text": "hey how are you"}, headers=headers)
    client.post(
        "/api/v1/monitoring/targets",
        json={"target_type": "email", "value": f"w-{uuid.uuid4().hex[:6]}@example.com"},
        headers=headers,
    )
    body = client.get("/api/v1/monitoring/protection-score", headers=headers).json()
    assert body["score"] > 0
    earned = {c["key"] for c in body["components"] if c["earned"]}
    assert "scanned_recently" in earned
    assert "identity_monitored" in earned


def test_trends_reflect_high_risk_scans():
    headers = _auth()
    # Toll smishing scores high/critical deterministically
    client.post(
        "/api/v1/scans/message",
        json={
            "message_text": "E-ZPass final notice: unpaid toll of $6.99. Pay now at "
            "http://ezpass-billing.top or face license suspension. Act now!",
            "platform_hint": "sms",
        },
        headers=headers,
    )
    res = client.get("/api/v1/community/trends", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["window_days"] == 14
    assert len(body["trending"]) >= 1
    assert body["trending"][0]["detections"] >= 1
    assert 0 <= body["trending"][0]["share"] <= 100


def test_trends_requires_auth():
    assert client.get("/api/v1/community/trends").status_code == 401
