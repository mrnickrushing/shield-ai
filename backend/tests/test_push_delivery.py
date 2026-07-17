"""Expo ticket and receipt handling regressions."""
from datetime import datetime, timedelta, timezone
import uuid

import pytest

from app.models.models import Device, PushReceipt, User
from app.services.notification_delivery import check_pending_push_receipts, send_push_to_devices
from tests.test_smoke import TestingSession


class _Response:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def _user_and_device():
    db = TestingSession()
    user = User(email=f"push-{uuid.uuid4().hex}@example.com", hashed_password="unused")
    db.add(user)
    db.flush()
    device = Device(user_id=user.id, platform="ios", push_token=f"ExponentPushToken[{uuid.uuid4()}]")
    db.add(device)
    db.commit()
    return db, user.id, device.id


def test_accepted_ticket_is_persisted_for_receipt_check(monkeypatch):
    db, user_id, _ = _user_and_device()
    try:
        monkeypatch.setattr(
            "httpx.post",
            lambda *args, **kwargs: _Response({"data": [{"status": "ok", "id": "expo-ticket-1"}]}),
        )
        accepted = send_push_to_devices(db, user_id, "Threat found", "Review this alert")
        assert accepted == 1
        row = db.query(PushReceipt).filter(PushReceipt.ticket_id == "expo-ticket-1").one()
        assert row.status == "pending"
    finally:
        db.close()


def test_invalid_token_receipt_revokes_device(monkeypatch):
    db, user_id, device_id = _user_and_device()
    try:
        receipt = PushReceipt(
            user_id=user_id,
            device_id=device_id,
            ticket_id="expo-ticket-invalid",
            created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        db.add(receipt)
        db.commit()
        monkeypatch.setattr(
            "httpx.post",
            lambda *args, **kwargs: _Response({
                "data": {
                    "expo-ticket-invalid": {
                        "status": "error",
                        "message": "Device is no longer registered",
                        "details": {"error": "DeviceNotRegistered"},
                    }
                }
            }),
        )

        result = check_pending_push_receipts(db)
        db.refresh(receipt)
        device = db.get(Device, device_id)
        assert result["failed"] == 1
        assert receipt.status == "failed"
        assert device is not None and device.revoked_at is not None
    finally:
        db.close()


def test_logout_revokes_device_without_deleting_receipt():
    from app.core.security import create_access_token
    from tests.test_smoke import client

    db, user_id, device_id = _user_and_device()
    try:
        device = db.get(Device, device_id)
        receipt = PushReceipt(
            user_id=user_id,
            device_id=device_id,
            ticket_id=f"expo-ticket-{uuid.uuid4().hex}",
        )
        db.add(receipt)
        db.commit()
        push_token = device.push_token
    finally:
        db.close()

    response = client.delete(
        "/api/v1/notifications/devices/current",
        params={"push_token": push_token},
        headers={"Authorization": f"Bearer {create_access_token(user_id)}"},
    )
    assert response.status_code == 204, response.text

    db = TestingSession()
    try:
        retained = db.get(Device, device_id)
        assert retained is not None and retained.revoked_at is not None
        assert db.query(PushReceipt).filter(PushReceipt.device_id == device_id).count() == 1
    finally:
        db.close()


def test_incident_amount_uses_exact_decimal_schema():
    from decimal import Decimal

    from app.schemas.schemas import IncidentCreate

    payload = IncidentCreate(incident_type="other", amount_lost="1234567890.12")
    assert payload.amount_lost == Decimal("1234567890.12")

    with pytest.raises(ValueError):
        IncidentCreate(incident_type="other", amount_lost="1.001")


def test_weekly_report_retry_does_not_duplicate_alert():
    from app.models.models import Notification, ScanHistory, ScanStatus, ScanType
    from app.services.protection_report import run_weekly_reports

    db = TestingSession()
    try:
        user = User(
            email=f"weekly-{uuid.uuid4().hex}@example.com",
            hashed_password="unused",
            is_premium=True,
            premium_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db.add(user)
        db.flush()
        db.add(ScanHistory(user_id=user.id, scan_type=ScanType.message, status=ScanStatus.completed))
        db.commit()

        # The smoke-test database is intentionally shared across modules, so
        # other premium users may also receive their first report here. The
        # invariant under test is that this user's retry remains idempotent.
        run_weekly_reports(db)
        run_weekly_reports(db)
        assert (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.title == "Your Weekly Protection Report",
            )
            .count()
            == 1
        )
    finally:
        db.close()
