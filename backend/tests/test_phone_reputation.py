"""Phone reputation sync — corroboration threshold behavior."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "development")

import uuid

from app.core.config import settings

from tests.test_smoke import client


def _register_and_scan(phone_number: str) -> dict:
    email = f"phonerep+{uuid.uuid4().hex}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "PhoneRep"},
    )
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = client.post(
        "/api/v1/scans/phone",
        json={"phone_number": phone_number},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return {"headers": headers, "scan": r.json()}


def test_sync_omits_number_below_reporter_threshold():
    # A premium-rate + repeating-digit number scores "high" deterministically
    # (no LLM key in tests), but a single reporter must NOT get it into the
    # shared sync feed on its own.
    number = "900-000-0000"
    result = _register_and_scan(number)
    headers = result["headers"]

    r = client.get("/api/v1/phone-reputation/sync", headers=headers)
    assert r.status_code == 200, r.text
    numbers = {e["number"] for e in r.json()["entries"]}
    assert "19000000000" not in numbers


def test_sync_includes_number_once_reporter_threshold_met():
    number = "900-090-0090"
    last_headers = None
    for _ in range(settings.PHONE_BLOCKLIST_MIN_REPORTERS):
        last_headers = _register_and_scan(number)["headers"]

    r = client.get("/api/v1/phone-reputation/sync", headers=last_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    entries = {e["number"]: e["label"] for e in body["entries"]}
    assert "19000900090" in entries
    assert entries["19000900090"] == "Scam Likely"
    assert body["version"] != "0"


def test_sync_endpoint_requires_auth():
    r = client.get("/api/v1/phone-reputation/sync")
    assert r.status_code in (401, 403)


def test_seed_loader_is_idempotent_and_entries_reach_sync():
    from app.services.phone_seed import seed_scam_numbers

    from tests.test_smoke import TestingSession

    db = TestingSession()
    try:
        added_first = seed_scam_numbers(db)
        assert added_first > 0
        assert seed_scam_numbers(db) == 0  # second run inserts nothing
    finally:
        db.close()

    headers = _register_and_scan("212-555-0199")["headers"]
    r = client.get("/api/v1/phone-reputation/sync", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    labels = {e["label"] for e in body["entries"]}
    assert "Spam Risk" in labels
    assert len(body["entries"]) >= added_first
    assert body["version"] != "0"


def test_community_label_overrides_seed_label():
    from app.models.models import SeededScamNumber

    from tests.test_smoke import TestingSession

    # Seed the same number that community corroboration will flag as high risk.
    number = "900-090-0090"
    db = TestingSession()
    try:
        if not db.query(SeededScamNumber).filter_by(number="19000900090").first():
            db.add(SeededScamNumber(number="19000900090", label="Spam Risk"))
            db.commit()
    finally:
        db.close()

    last_headers = None
    for _ in range(settings.PHONE_BLOCKLIST_MIN_REPORTERS):
        last_headers = _register_and_scan(number)["headers"]

    r = client.get("/api/v1/phone-reputation/sync", headers=last_headers)
    assert r.status_code == 200, r.text
    entries = {e["number"]: e["label"] for e in r.json()["entries"]}
    assert entries["19000900090"] == "Scam Likely"
