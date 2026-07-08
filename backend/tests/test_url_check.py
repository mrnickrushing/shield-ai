"""Live Safe Browser url-check tests — run with: pytest (uses SQLite in-memory)."""
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"
os.environ["REDIS_URL"] = "redis://127.0.0.1:1/0"  # unreachable -> in-process cache only

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.models import User
from app.services import url_check as url_check_service

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
    # Swap in this module's DB and restore whatever was there before, so we
    # don't clobber other test modules' overrides (see test_verticals.py).
    prev = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _override_db
    yield
    if prev is not None:
        app.dependency_overrides[get_db] = prev
    else:
        app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def _auth_headers(premium: bool = True) -> dict:
    email = f"browser-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "Web"},
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


def _check(url: str, headers: dict) -> dict:
    res = client.get("/api/v1/scans/url-check", params={"url": url}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_requires_auth():
    res = client.get("/api/v1/scans/url-check", params={"url": "https://example.com"})
    assert res.status_code == 401


def test_requires_premium():
    headers = _auth_headers(premium=False)
    res = client.get("/api/v1/scans/url-check", params={"url": "https://example.com"}, headers=headers)
    assert res.status_code == 402, res.text


def test_trusted_domain_is_safe_without_reputation_call():
    headers = _auth_headers()
    out = _check("https://www.google.com/search?q=hello", headers)
    assert out["verdict"] == "safe"
    assert out["score"] == 0


def test_ip_host_is_suspicious():
    headers = _auth_headers()
    out = _check("http://93.184.216.34/login", headers)
    assert out["verdict"] in ("suspicious", "high")
    assert out["score"] >= 40


def test_typosquat_brand_is_high():
    headers = _auth_headers()
    out = _check("https://paypal-secure-login.example-verify.com", headers)
    assert out["verdict"] in ("high", "critical")
    assert "paypal" in out["reason"].lower()


def test_homograph_is_high():
    headers = _auth_headers()
    out = _check("https://xn--pple-43d.com", headers)
    assert out["verdict"] in ("high", "critical")


def test_shortener_is_low():
    headers = _auth_headers()
    out = _check("https://bit.ly/3abcxyz", headers)
    assert out["verdict"] == "low"


def test_second_lookup_is_cached():
    headers = _auth_headers()
    url = "https://some-neutral-site-for-cache-test.org/page"
    first = _check(url, headers)
    assert first["cached"] is False
    second = _check(url, headers)
    assert second["cached"] is True
    assert second["verdict"] == first["verdict"]


def test_does_not_write_scan_history():
    headers = _auth_headers()
    _check("https://no-history-please.org", headers)
    scans = client.get("/api/v1/scans", headers=headers)
    assert scans.status_code == 200
    assert scans.json() == []


def test_repeated_checks_do_not_block_other_scans():
    """url-check (premium-gated, no scan history) must not interfere with /scans/link."""
    headers = _auth_headers()
    for i in range(30):
        _check(f"https://neutral-{i}.org", headers)
    res = client.post("/api/v1/scans/link", json={"url": "https://example.org"}, headers=headers)
    assert res.status_code == 201, res.text


def test_verdict_thresholds():
    assert url_check_service._verdict(0) == "safe"
    assert url_check_service._verdict(30) == "low"
    assert url_check_service._verdict(50) == "suspicious"
    assert url_check_service._verdict(70) == "high"
    assert url_check_service._verdict(95) == "critical"
