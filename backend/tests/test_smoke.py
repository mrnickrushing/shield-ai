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
