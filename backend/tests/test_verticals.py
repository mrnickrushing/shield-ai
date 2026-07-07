"""Vertical apps — scaffold tests (unit + endpoint).

Verifies the shared Verdict Engine runs each vertical end-to-end without an LLM
key (deterministic fallback), and that the public catalog + protected scan
endpoints are wired.
"""
import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"

import base64
import uuid

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
def _use_db():
    """Point the app at this module's in-memory DB only for these tests."""
    prev = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _override_db
    yield
    if prev is not None:
        app.dependency_overrides[get_db] = prev
    else:
        app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def _auth_headers() -> dict:
    email = f"vtest+{uuid.uuid4().hex}@example.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "display_name": "V"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Unit tests — analyzers + engine (no network, no LLM key)
# ---------------------------------------------------------------------------

def test_registry_has_all_six_verticals():
    from app.verticals import list_verticals

    keys = {s.key for s in list_verticals()}
    assert keys == {"medbill", "contract", "job", "call", "family", "recovery"}


def test_run_vertical_medbill_flags_duplicate_charge():
    from app.verticals import get_vertical, run_vertical

    spec = get_vertical("medbill")
    report = run_vertical(spec, "Office visit $250.00\nLab panel $80.00\nOffice visit $250.00", {})
    assert report["vertical"] == "medbill"
    assert report["risk_score"] >= 30
    assert report["output_artifact"]  # a draft dispute letter
    assert any("duplicate" in f.lower() for f in report["red_flags"])


def test_run_vertical_job_flags_fake_check():
    from app.verticals import get_vertical, run_vertical

    spec = get_vertical("job")
    report = run_vertical(
        spec,
        "Congrats, you're hired! We'll mail a cashier's check — deposit it and wire back the difference.",
        {},
    )
    assert report["risk_score"] >= 35
    assert report["recommended_actions"]


def test_run_vertical_contract_flags_auto_renewal():
    from app.verticals import get_vertical, run_vertical

    spec = get_vertical("contract")
    report = run_vertical(spec, "This subscription will automatically renew each year unless cancelled.", {})
    assert "auto_renewal" in report["evidence"]["clauses_found"]


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------

def test_catalog_is_public():
    r = client.get("/api/v1/verticals")
    assert r.status_code == 200, r.text
    assert len(r.json()) == 6


def test_catalog_lists_six(_=None):
    r = client.get("/api/v1/verticals")
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data) == 6
    assert {d["key"] for d in data} == {"medbill", "contract", "job", "call", "family", "recovery"}
    assert all(d["name"] and d["tagline"] and d["icon"] for d in data)


def test_vertical_scan_requires_auth():
    r = client.post("/api/v1/verticals/medbill/scan", json={"input": "test"})
    assert r.status_code in (401, 403)


def test_unknown_vertical_returns_404():
    r = client.post(
        "/api/v1/verticals/nope/scan",
        json={"input": "anything"},
        headers=_auth_headers(),
    )
    assert r.status_code == 404


def test_medbill_scan_endpoint_full_flow():
    r = client.post(
        "/api/v1/verticals/medbill/scan",
        json={"input": "Office visit $250.00\nLab $80.00\nOffice visit $250.00\nout-of-network"},
        headers=_auth_headers(),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["vertical"] == "medbill"
    assert data["vertical_name"] == "MedBill Shield"
    assert data["risk_score"] >= 30
    assert data["output_title"] == "Draft dispute letter"
    assert data["output_artifact"]


def test_recovery_scan_endpoint_returns_action_pack():
    r = client.post(
        "/api/v1/verticals/recovery/scan",
        json={"input": "I sent $800 in gift cards to someone claiming to be the IRS", "context": {"amount": 800}},
        headers=_auth_headers(),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["vertical"] == "recovery"
    assert "ACTION PACK" in data["output_artifact"]
    assert any("gift" in f.lower() for f in data["red_flags"])


def test_empty_input_rejected():
    r = client.post(
        "/api/v1/verticals/job/scan",
        json={"input": ""},
        headers=_auth_headers(),
    )
    assert r.status_code == 422


def _user_id(headers: dict) -> str:
    return client.get("/api/v1/auth/me", headers=headers).json()["id"]


def test_vertical_scan_enforces_free_quota():
    from app.core.config import settings
    from app.models.models import ScanHistory, ScanType

    headers = _auth_headers()
    uid = _user_id(headers)
    # Pre-fill today's scans up to the shared free limit.
    db = TestingSession()
    try:
        for _ in range(settings.FREE_TIER_DAILY_SCANS):
            db.add(ScanHistory(user_id=uid, scan_type=ScanType.vertical))
        db.commit()
    finally:
        db.close()

    r = client.post("/api/v1/verticals/job/scan", json={"input": "hello"}, headers=headers)
    assert r.status_code == 429


def test_vertical_scan_premium_bypasses_quota():
    from app.core.config import settings
    from app.models.models import ScanHistory, ScanType, User

    headers = _auth_headers()
    uid = _user_id(headers)
    db = TestingSession()
    try:
        db.get(User, uid).is_premium = True
        for _ in range(settings.FREE_TIER_DAILY_SCANS + 2):
            db.add(ScanHistory(user_id=uid, scan_type=ScanType.vertical))
        db.commit()
    finally:
        db.close()

    r = client.post("/api/v1/verticals/job/scan", json={"input": "hello"}, headers=headers)
    assert r.status_code == 200


def test_vertical_scan_persisted_to_history():
    headers = _auth_headers()
    r = client.post(
        "/api/v1/verticals/medbill/scan",
        json={"input": "Office visit 99213 $250.00\nOffice visit 99213 $250.00"},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    scans = client.get("/api/v1/scans", headers=headers).json()
    vertical_scans = [s for s in scans if s["scan_type"] == "vertical"]
    assert len(vertical_scans) == 1
    s = vertical_scans[0]
    assert s["vertical_key"] == "medbill"
    assert s["status"] == "completed"
    assert s["report"] is not None
    assert s["report"]["risk_score"] >= 30
    # The vertical extras (e.g. the dispute letter) survive in the persisted evidence.
    assert s["report"]["evidence"]["_vertical"]["output_artifact"]


# ---------------------------------------------------------------------------
# File ingestion (photo / PDF)
# ---------------------------------------------------------------------------

def _make_pdf(text: str) -> bytes:
    """Build a minimal one-page PDF whose content stream prints `text`."""
    stream = b"BT /F1 12 Tf 72 720 Td (" + text.encode("latin-1") + b") Tj ET"
    objs = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R"
        b"/Resources<</Font<</F1 5 0 R>>>>>>",
        b"<</Length " + str(len(stream)).encode() + b">>stream\n" + stream + b"\nendstream",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(pdf))
        pdf += str(i).encode() + b" 0 obj\n" + body + b"\nendobj\n"
    xref_pos = len(pdf)
    pdf += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n0000000000 65535 f \n"
    for off in offsets:
        pdf += ("%010d 00000 n \n" % off).encode()
    pdf += b"trailer\n<</Size " + str(len(objs) + 1).encode() + b"/Root 1 0 R>>\n"
    pdf += b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF"
    return pdf


def test_document_extracts_pdf_text():
    from app.services import document

    out = document.extract_text(_make_pdf("Office visit 99213 $250.00 out-of-network"))
    assert out["kind"] == "pdf"
    assert out["ok"] is True
    assert "99213" in out["text"]


def test_catalog_exposes_accepts_files():
    by_key = {d["key"]: d for d in client.get("/api/v1/verticals", headers=_auth_headers()).json()}
    assert by_key["medbill"]["accepts_files"] is True
    assert by_key["contract"]["accepts_files"] is True
    assert by_key["recovery"]["accepts_files"] is False


def test_medbill_scan_accepts_pdf_upload():
    pdf_b64 = base64.b64encode(_make_pdf("Office visit 99213 $250.00 out-of-network")).decode()
    r = client.post(
        "/api/v1/verticals/medbill/scan",
        json={"file_base64": pdf_b64},
        headers=_auth_headers(),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["vertical"] == "medbill"
    # The text extracted from the PDF reached the analyzer.
    assert any("out-of-network" in f.lower() for f in data["red_flags"])


def test_file_upload_rejected_for_non_file_vertical():
    pdf_b64 = base64.b64encode(_make_pdf("anything")).decode()
    r = client.post(
        "/api/v1/verticals/recovery/scan",
        json={"file_base64": pdf_b64},
        headers=_auth_headers(),
    )
    assert r.status_code == 400


def test_scan_requires_input_or_file():
    r = client.post("/api/v1/verticals/medbill/scan", json={}, headers=_auth_headers())
    assert r.status_code == 422
