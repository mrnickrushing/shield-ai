"""Data-broker exposure tests — run with: pytest (uses SQLite in-memory)."""
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
from app.services.broker_catalog import BROKERS

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


def _auth(premium: bool = True) -> dict:
    email = f"broker-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "Jane Doe"},
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


def test_catalog_lists_all_brokers_with_name_substituted():
    headers = _auth()
    res = client.get("/api/v1/identity/brokers", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == len(BROKERS)
    assert body["not_started"] == len(BROKERS)
    assert body["exposure_score"] == 100
    whitepages = next(b for b in body["brokers"] if b["key"] == "whitepages")
    assert "Jane+Doe" in whitepages["search_url"]


def test_status_updates_move_summary():
    headers = _auth()
    res = client.put(
        "/api/v1/identity/brokers/whitepages",
        json={"status": "requested", "notes": "submitted 7/6"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "requested"
    assert res.json()["requested_at"] is not None

    res = client.put("/api/v1/identity/brokers/spokeo", json={"status": "removed"}, headers=headers)
    assert res.status_code == 200

    summary = client.get("/api/v1/identity/brokers", headers=headers).json()
    assert summary["in_progress"] == 1
    assert summary["resolved"] == 1
    assert summary["exposure_score"] < 100


def test_not_listed_counts_as_resolved():
    headers = _auth()
    client.put("/api/v1/identity/brokers/nuwber", json={"status": "not_listed"}, headers=headers)
    summary = client.get("/api/v1/identity/brokers", headers=headers).json()
    assert summary["resolved"] == 1


def test_invalid_broker_and_status_rejected():
    headers = _auth()
    assert client.put("/api/v1/identity/brokers/nope", json={"status": "removed"}, headers=headers).status_code == 404
    assert client.put("/api/v1/identity/brokers/spokeo", json={"status": "banana"}, headers=headers).status_code == 422


def test_progress_is_per_user():
    a, b = _auth(), _auth()
    client.put("/api/v1/identity/brokers/spokeo", json={"status": "removed"}, headers=a)
    assert client.get("/api/v1/identity/brokers", headers=b).json()["resolved"] == 0


def test_brokers_requires_premium():
    headers = _auth(premium=False)
    res = client.get("/api/v1/identity/brokers", headers=headers)
    assert res.status_code == 402, res.text
    res = client.put("/api/v1/identity/brokers/spokeo", json={"status": "removed"}, headers=headers)
    assert res.status_code == 402, res.text
