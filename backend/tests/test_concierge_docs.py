"""Recovery concierge document tests — run with: pytest (uses SQLite in-memory)."""
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
    email = f"doc-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "Sam Victim"},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _incident(headers: dict) -> str:
    res = client.post(
        "/api/v1/recovery/incidents",
        json={
            "incident_type": "gift_card",
            "title": "Apple gift card scam",
            "amount_lost": 500.0,
            "currency": "USD",
            "notes": "Caller claimed to be Apple support and demanded gift card codes.",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_bank_dispute_contains_incident_facts():
    headers = _auth()
    iid = _incident(headers)
    res = client.get(f"/api/v1/recovery/incidents/{iid}/documents/bank_dispute", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["doc_type"] == "bank_dispute"
    assert "USD 500.00" in body["body"]
    assert "Sam Victim" in body["body"]
    # No LLM key in tests -> deterministic template
    assert body["personalized"] is False


def test_ftc_and_police_docs_generate():
    headers = _auth()
    iid = _incident(headers)
    for doc in ("ftc_complaint", "police_report"):
        res = client.get(f"/api/v1/recovery/incidents/{iid}/documents/{doc}", headers=headers)
        assert res.status_code == 200, res.text
        assert "gift card" in res.json()["body"].lower()


def test_police_report_includes_evidence():
    headers = _auth()
    iid = _incident(headers)
    client.post(
        f"/api/v1/recovery/incidents/{iid}/evidence",
        json={"evidence_type": "message", "label": "Scam text", "content": "Buy 5 Apple cards and read the codes"},
        headers=headers,
    )
    res = client.get(f"/api/v1/recovery/incidents/{iid}/documents/police_report", headers=headers)
    assert "Scam text" in res.json()["body"]


def test_unknown_doc_type_404():
    headers = _auth()
    iid = _incident(headers)
    res = client.get(f"/api/v1/recovery/incidents/{iid}/documents/nonsense", headers=headers)
    assert res.status_code == 404


def test_cannot_access_other_users_incident():
    a, b = _auth(), _auth()
    iid = _incident(a)
    res = client.get(f"/api/v1/recovery/incidents/{iid}/documents/bank_dispute", headers=b)
    assert res.status_code == 404
