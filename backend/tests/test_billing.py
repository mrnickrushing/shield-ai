"""RevenueCat webhook tests — run with: pytest (uses SQLite in-memory)."""
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"
os.environ["REVENUECAT_WEBHOOK_SECRET"] = "test-webhook-secret"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app

settings.REVENUECAT_WEBHOOK_SECRET = "test-webhook-secret"

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

AUTH = {"Authorization": "test-webhook-secret"}
WEBHOOK = "/api/v1/billing/revenuecat-webhook"


def _register_user() -> str:
    email = f"billing-{uuid.uuid4().hex[:10]}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "Bill"},
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    return me.json()["id"], token


def _event(event_type: str, app_user_id: str, **extra) -> dict:
    return {"event": {"type": event_type, "app_user_id": app_user_id, "product_id": "shieldai_premium_monthly", **extra}}


def _me_is_premium(token: str) -> bool:
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    return res.json()["is_premium"]


def test_rejects_missing_or_wrong_secret():
    user_id, _ = _register_user()
    res = client.post(WEBHOOK, json=_event("INITIAL_PURCHASE", user_id))
    assert res.status_code == 401
    res = client.post(WEBHOOK, json=_event("INITIAL_PURCHASE", user_id), headers={"Authorization": "nope"})
    assert res.status_code == 401


def test_initial_purchase_grants_premium():
    user_id, token = _register_user()
    assert _me_is_premium(token) is False
    res = client.post(WEBHOOK, json=_event("INITIAL_PURCHASE", user_id, expiration_at_ms=4102444800000), headers=AUTH)
    assert res.status_code == 200 and res.json()["handled"] is True
    assert _me_is_premium(token) is True


def test_expiration_revokes_premium():
    user_id, token = _register_user()
    client.post(WEBHOOK, json=_event("RENEWAL", user_id), headers=AUTH)
    assert _me_is_premium(token) is True
    res = client.post(WEBHOOK, json=_event("EXPIRATION", user_id), headers=AUTH)
    assert res.status_code == 200 and res.json()["handled"] is True
    assert _me_is_premium(token) is False


def test_cancellation_keeps_access_until_expiration():
    user_id, token = _register_user()
    client.post(WEBHOOK, json=_event("INITIAL_PURCHASE", user_id), headers=AUTH)
    res = client.post(WEBHOOK, json=_event("CANCELLATION", user_id), headers=AUTH)
    assert res.status_code == 200 and res.json()["handled"] is False
    assert _me_is_premium(token) is True


def test_anonymous_purchase_matched_via_alias():
    user_id, token = _register_user()
    payload = _event("INITIAL_PURCHASE", "$RCAnonymousID:abc123", aliases=["$RCAnonymousID:abc123", user_id])
    res = client.post(WEBHOOK, json=payload, headers=AUTH)
    assert res.status_code == 200 and res.json()["handled"] is True
    assert _me_is_premium(token) is True


def test_unknown_user_is_acknowledged_not_retried():
    res = client.post(WEBHOOK, json=_event("INITIAL_PURCHASE", "no-such-user"), headers=AUTH)
    assert res.status_code == 200
    assert res.json()["handled"] is False
