"""Domain monitoring — HIBP domain-search breach exposure."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "development")

import uuid

from app.models.models import IdentityAlert, MonitoredIdentity, User
from app.services import monitoring

from tests.test_smoke import TestingSession


def _make_domain_target(db) -> MonitoredIdentity:
    user = User(email=f"domainmon+{uuid.uuid4().hex}@example.com", hashed_password="x")
    db.add(user)
    db.flush()
    target = MonitoredIdentity(user_id=user.id, target_type="domain", value="example-corp.test")
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def test_domain_breach_exposure_alerts_once(monkeypatch):
    monkeypatch.setattr(monitoring, "check_url", lambda url: {"verdict": "safe"})
    monkeypatch.setattr(
        monitoring.breach_check,
        "check_domain_breaches",
        lambda domain: {"nick": ["Adobe"], "info": ["LinkedIn", "Adobe"]},
    )

    db = TestingSession()
    try:
        target = _make_domain_target(db)
        assert monitoring.check_identity_target(db, target) is True
        db.commit()
        assert target.last_status == "breached"

        alert = (
            db.query(IdentityAlert)
            .filter_by(user_id=target.user_id, alert_type="domain_breach_exposure")
            .one()
        )
        assert alert.detail["breached_accounts"] == 2
        assert "Adobe" in alert.detail["breaches"]

        # Re-running must not duplicate the alert.
        assert monitoring.check_identity_target(db, target) is False
        db.commit()
        count = (
            db.query(IdentityAlert)
            .filter_by(user_id=target.user_id, alert_type="domain_breach_exposure")
            .count()
        )
        assert count == 1
    finally:
        db.close()


def test_domain_breach_data_unavailable_is_not_clean(monkeypatch):
    # None (unverified domain / no key) must neither alert nor mark breached.
    monkeypatch.setattr(monitoring, "check_url", lambda url: {"verdict": "safe"})
    monkeypatch.setattr(monitoring.breach_check, "check_domain_breaches", lambda domain: None)

    db = TestingSession()
    try:
        target = _make_domain_target(db)
        assert monitoring.check_identity_target(db, target) is False
        db.commit()
        assert target.last_status == "safe"
        assert (
            db.query(IdentityAlert)
            .filter_by(user_id=target.user_id, alert_type="domain_breach_exposure")
            .count()
            == 0
        )
    finally:
        db.close()
