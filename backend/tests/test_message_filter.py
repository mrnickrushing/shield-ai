"""ILMessageFilter endpoint tests — run with: pytest (uses SQLite in-memory)."""
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
ENDPOINT = "/api/v1/message-filter"


def _query(text: str, sender: str = "+15551234567") -> dict:
    return {"_version": 1, "query": {"sender": sender, "message": {"text": text}}}


def _action(text: str, sender: str = "+15551234567") -> str:
    res = client.post(ENDPOINT, json=_query(text, sender))
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"action", "subAction"}
    return body["action"]


def test_no_auth_required():
    res = client.post(ENDPOINT, json=_query("hello"))
    assert res.status_code == 200


def test_benign_text_passes():
    assert _action("Hey, are we still on for dinner tonight?") == "none"


def test_otp_text_passes():
    assert _action("Your verification code is 482913. It expires in 10 minutes.") == "none"


def test_delivery_scam_is_junk():
    assert (
        _action(
            "USPS: your package is on hold due to unpaid customs fee of $1.99. "
            "Pay now to release delivery: http://usps-redelivery.xyz/pay"
        )
        == "junk"
    )


def test_toll_scam_is_junk():
    assert (
        _action(
            "E-ZPass final notice: you have an unpaid toll of $6.99. Failure to pay "
            "will result in late fees and license suspension. Pay at http://ezpass-billing.top"
        )
        == "junk"
    )


def test_prize_scam_is_junk():
    assert (
        _action(
            "CONGRATULATIONS! You have been selected as our $1000 Walmart gift card "
            "winner!! Claim your prize now before it expires: http://claim-reward.win/now act fast"
        )
        == "junk"
    )


def test_malformed_body_fails_open():
    res = client.post(ENDPOINT, content=b"not json", headers={"Content-Type": "application/json"})
    assert res.status_code == 200
    assert res.json()["action"] == "none"


def test_empty_query_fails_open():
    res = client.post(ENDPOINT, json={"_version": 1, "query": {}})
    assert res.status_code == 200
    assert res.json()["action"] == "none"


def test_aasa_served():
    res = client.get("/.well-known/apple-app-site-association")
    assert res.status_code == 200
    apps = res.json()["messagefilter"]["apps"]
    assert "PH4AKDQ4Q7.com.shieldai.app.messagefilter" in apps
