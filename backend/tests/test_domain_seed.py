"""Seeded phishing domains — Safari blocklist sync behavior."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "development")

import uuid

from app.models.models import SeededScamDomain
from app.services.domain_seed import reconcile_domains, seed_scam_domains

from tests.test_smoke import TestingSession, client


def _auth_headers() -> dict:
    email = f"domainseed+{uuid.uuid4().hex}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "DomainSeed"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_seed_loader_is_idempotent_and_domains_reach_sync():
    db = TestingSession()
    try:
        added_first = seed_scam_domains(db)
        assert added_first > 0
        assert seed_scam_domains(db) == 0  # second run inserts nothing
    finally:
        db.close()

    r = client.get("/api/v1/url-reputation/sync", headers=_auth_headers())
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["domains"]) >= added_first
    assert body["version"] != "0"


def test_reconcile_retires_domains_missing_from_feed():
    db = TestingSession()
    try:
        stale = SeededScamDomain(domain="stale-phish.example")
        keep = SeededScamDomain(domain="keep-phish.example")
        db.add_all([stale, keep])
        db.commit()

        reconcile_domains(db, ["keep-phish.example", "brand-new-phish.example"])
        db.refresh(stale)
        db.refresh(keep)
        assert stale.is_active is False
        assert keep.is_active is True
        assert (
            db.query(SeededScamDomain).filter_by(domain="brand-new-phish.example").first()
            is not None
        )
    finally:
        db.close()


def test_deactivated_domain_left_alone_by_reconcile():
    # An admin deactivation must survive the feed re-listing the domain.
    db = TestingSession()
    try:
        row = SeededScamDomain(domain="disputed.example", is_active=False)
        db.add(row)
        db.commit()

        reconcile_domains(db, ["disputed.example"])
        db.refresh(row)
        assert row.is_active is False
    finally:
        db.close()


def _admin_headers() -> dict:
    email = f"seedadmin+{uuid.uuid4().hex}@example.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "SeedAdmin"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]

    from app.models.models import User as UserModel

    db = TestingSession()
    try:
        db.get(UserModel, user_id).is_admin = True
        db.commit()
    finally:
        db.close()
    return headers


def test_admin_can_deactivate_seeded_entries():
    from app.models.models import SeededScamNumber

    db = TestingSession()
    try:
        db.add(SeededScamDomain(domain="admin-target.example"))
        if not db.query(SeededScamNumber).filter_by(number="19995550100").first():
            db.add(SeededScamNumber(number="19995550100"))
        db.commit()
    finally:
        db.close()

    headers = _admin_headers()
    r = client.patch(
        "/api/v1/admin/seeded-domains/admin-target.example",
        json={"is_active": False},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False

    # Number lookups normalize formatting before matching.
    r = client.patch(
        "/api/v1/admin/seeded-numbers/1 (999) 555-0100",
        json={"is_active": False},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False

    # Deactivated entries drop out of the sync feeds.
    user_headers = _auth_headers()
    r = client.get("/api/v1/url-reputation/sync", headers=user_headers)
    assert "admin-target.example" not in r.json()["domains"]
    r = client.get("/api/v1/phone-reputation/sync", headers=user_headers)
    assert "19995550100" not in {e["number"] for e in r.json()["entries"]}
