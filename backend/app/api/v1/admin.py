"""Admin console routes — Phase 5.

All endpoints require is_admin=True.

GET  /api/v1/admin/stats                         — aggregate platform stats
GET  /api/v1/admin/users                         — user list
GET  /api/v1/admin/users/{user_id}               — user operations detail
PATCH /api/v1/admin/users/{user_id}              — set flags (is_premium, is_admin, is_developer)
DELETE /api/v1/admin/users/{user_id}             — permanently delete a user account
POST /api/v1/admin/users/{user_id}/revoke-sessions — revoke all active sessions
POST /api/v1/admin/users/{user_id}/disable-api-keys — disable all active API keys
GET  /api/v1/admin/api-keys                      — API key operations list
PATCH /api/v1/admin/api-keys/{key_id}            — activate/revoke an API key
GET  /api/v1/admin/audit-logs                    — admin and account audit history
GET  /api/v1/admin/notifications/diagnostics     — notification delivery diagnostics
POST /api/v1/admin/notifications/test            — create a test notification for a user
GET  /api/v1/admin/subscriptions/diagnostics     — RevenueCat entitlement diagnostics from local state
GET  /api/v1/admin/reports                       — all community reports (with filter)
PATCH /api/v1/admin/reports/{report_id}          — update status + analyst notes
GET  /api/v1/admin/patterns                      — all scam patterns
POST /api/v1/admin/patterns                      — create a new analyst pattern
PATCH /api/v1/admin/patterns/{pattern_id}        — toggle is_active or update
DELETE /api/v1/admin/patterns/{pattern_id}       — deactivate
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.models import (
    ApiKey,
    AuditLog,
    AuthSession,
    BreachRecord,
    BrowserTelemetryEvent,
    CasePackShare,
    CommunityReport,
    Device,
    ExtensionTelemetryEvent,
    IdentityAlert,
    Incident,
    MonitoredIdentity,
    Notification,
    PrivacyPreference,
    RiskReport,
    ScamPattern,
    ScanFeedbackDetail,
    ScanHistory,
    SeededScamDomain,
    SeededScamNumber,
    User,
)
from app.schemas.schemas import (
    AdminStatsOut,
    AdminUserOut,
    CommunityReportAdminOut,
    ScamPatternCreate,
    ScamPatternOut,
)
from app.services.account_deletion import delete_user_account


class _UserFlagsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_premium: bool | None = None
    is_admin: bool | None = None
    is_developer: bool | None = None
    is_active: bool | None = None


class _ReportReviewPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str | None = None
    analyst_notes: str | None = None


class _PatternPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str | None = None
    is_active: bool | None = None
    risk_score_boost: int | None = None
    category: str | None = None
    pattern_data: dict | None = None
    artifact_types: list[str] | None = None


class _FeedbackReviewPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    review_status: str


class _ApiKeyPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool


class _TestNotificationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str
    title: str = "Shield AI test notification"
    body: str = "This is a support test from the admin console."


router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_user_out(db: Session, user: User) -> AdminUserOut:
    active_api_keys = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == user.id, ApiKey.is_active.is_(True))
        .count()
    )
    total_api_keys = db.query(ApiKey).filter(ApiKey.user_id == user.id).count()
    return AdminUserOut(
        id=user.id,
        email=user.email,
        is_premium=user.is_premium,
        is_admin=user.is_admin,
        is_developer=user.is_developer,
        is_active=user.is_active,
        active_api_keys=active_api_keys,
        total_api_keys=total_api_keys,
        created_at=user.created_at,
    )


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


def _audit(db: Session, admin_id: str, action: str, detail: dict | None = None) -> None:
    db.add(AuditLog(user_id=admin_id, action=action, detail=detail or {}))


def _api_key_out(row: tuple[ApiKey, User | None]) -> dict:
    key, user = row
    return {
        "id": key.id,
        "user_id": key.user_id,
        "user_email": user.email if user else "",
        "name": key.name,
        "key_prefix": key.key_prefix,
        "scopes": key.scopes,
        "is_active": key.is_active,
        "created_at": key.created_at,
        "last_used_at": key.last_used_at,
    }


@router.get("/stats", response_model=AdminStatsOut)
def get_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    high_risk_q = (
        db.query(RiskReport)
        .join(ScanHistory, ScanHistory.id == RiskReport.scan_id)
        .filter(RiskReport.risk_level.in_(["high", "critical"]))
    )
    return AdminStatsOut(
        total_users=db.query(User).count(),
        active_users=db.query(User).filter(User.is_active.is_(True)).count(),
        premium_users=db.query(User).filter(User.is_premium.is_(True)).count(),
        developer_users=db.query(User).filter(User.is_developer.is_(True)).count(),
        total_scans=db.query(ScanHistory).count(),
        scans_today=db.query(ScanHistory).filter(ScanHistory.created_at >= today).count(),
        high_risk_scans=high_risk_q.count(),
        high_risk_scans_today=high_risk_q.filter(ScanHistory.created_at >= today).count(),
        open_community_reports=db.query(CommunityReport).filter(CommunityReport.status == "pending").count(),
        pending_feedback_reviews=db.query(ScanFeedbackDetail).filter(ScanFeedbackDetail.review_status == "pending").count(),
        active_scam_patterns=db.query(ScamPattern).filter(ScamPattern.is_active.is_(True)).count(),
        active_api_keys=db.query(ApiKey).filter(ApiKey.is_active.is_(True)).count(),
        total_api_keys=db.query(ApiKey).count(),
        revoked_api_keys=db.query(ApiKey).filter(ApiKey.is_active.is_(False)).count(),
        unread_notifications=db.query(Notification).filter(Notification.is_read.is_(False)).count(),
        open_incidents=db.query(Incident).filter(Incident.status != "resolved").count(),
        monitored_identities=db.query(MonitoredIdentity).filter(MonitoredIdentity.is_active.is_(True)).count(),
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if limit < 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "limit must be >= 1")
    users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
    return [_admin_user_out(db, user) for user in users]


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    scans = (
        db.query(ScanHistory, RiskReport)
        .outerjoin(RiskReport, RiskReport.scan_id == ScanHistory.id)
        .filter(ScanHistory.user_id == user.id)
        .order_by(ScanHistory.created_at.desc())
        .limit(25)
        .all()
    )
    incidents = db.query(Incident).filter(Incident.user_id == user.id).order_by(Incident.created_at.desc()).limit(20).all()
    notifications = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(20).all()
    sessions = db.query(AuthSession).filter(AuthSession.user_id == user.id).order_by(AuthSession.last_used_at.desc()).limit(20).all()
    devices = db.query(Device).filter(Device.user_id == user.id).order_by(Device.created_at.desc()).limit(20).all()
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc()).limit(20).all()
    identity_alerts = db.query(IdentityAlert).filter(IdentityAlert.user_id == user.id).order_by(IdentityAlert.created_at.desc()).limit(20).all()
    monitored = db.query(MonitoredIdentity).filter(MonitoredIdentity.user_id == user.id).order_by(MonitoredIdentity.created_at.desc()).limit(20).all()
    audit_logs = db.query(AuditLog).filter(AuditLog.user_id == user.id).order_by(AuditLog.created_at.desc()).limit(20).all()
    privacy = db.query(PrivacyPreference).filter(PrivacyPreference.user_id == user.id).first()
    return {
        "user": _admin_user_out(db, user),
        "subscription": {
            "is_premium": user.is_premium,
            "premium_expires_at": user.premium_expires_at,
            "rc_product_id": user.rc_product_id,
            "diagnosis": "Premium flag is active" if user.is_premium else "No active local premium entitlement",
        },
        "privacy": privacy,
        "counts": {
            "scans": db.query(ScanHistory).filter(ScanHistory.user_id == user.id).count(),
            "high_risk_scans": (
                db.query(RiskReport)
                .join(ScanHistory, ScanHistory.id == RiskReport.scan_id)
                .filter(ScanHistory.user_id == user.id, RiskReport.risk_level.in_(["high", "critical"]))
                .count()
            ),
            "incidents": db.query(Incident).filter(Incident.user_id == user.id).count(),
            "unread_notifications": db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).count(),
            "active_sessions": db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.is_active.is_(True)).count(),
            "active_devices": db.query(Device).filter(Device.user_id == user.id, Device.revoked_at.is_(None)).count(),
            "active_api_keys": db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.is_active.is_(True)).count(),
        },
        "sessions": sessions,
        "devices": devices,
        "api_keys": api_keys,
        "scans": [
            {
                "id": scan.id,
                "scan_type": _enum_value(scan.scan_type),
                "status": _enum_value(scan.status),
                "raw_input": scan.raw_input,
                "created_at": scan.created_at,
                "risk_score": report.risk_score if report else None,
                "risk_level": _enum_value(report.risk_level) if report else "",
                "threat_category": report.threat_category if report else "",
            }
            for scan, report in scans
        ],
        "incidents": [
            {
                "id": item.id,
                "incident_type": _enum_value(item.incident_type),
                "status": _enum_value(item.status),
                "title": item.title,
                "amount_lost": item.amount_lost,
                "created_at": item.created_at,
            }
            for item in incidents
        ],
        "notifications": notifications,
        "identity_alerts": identity_alerts,
        "monitored_identities": monitored,
        "audit_logs": audit_logs,
    }


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user_flags(
    user_id: str,
    payload: _UserFlagsPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    patch = payload.model_dump(exclude_unset=True)
    for key, val in patch.items():
        setattr(user, key, val)
    _audit(db, admin.id, "admin_update_user_flags", {"target_user_id": user.id, "patch": patch})
    db.commit()
    db.refresh(user)
    return _admin_user_out(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admins cannot delete their own account from the admin console")
    delete_user_account(
        db,
        user,
        audit_detail={"account_deleted": True, "deleted_by_admin_id": admin.id},
    )
    _audit(db, admin.id, "admin_delete_user", {"target_user_id": user_id})
    db.commit()


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    now = datetime.now(timezone.utc)
    sessions = db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.is_active.is_(True)).all()
    for session in sessions:
        session.is_active = False
        session.revoked_at = now
    _audit(db, admin.id, "admin_revoke_user_sessions", {"target_user_id": user.id, "count": len(sessions)})
    db.commit()
    return {"revoked_sessions": len(sessions)}


@router.post("/users/{user_id}/disable-api-keys")
def disable_user_api_keys(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    keys = db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.is_active.is_(True)).all()
    for key in keys:
        key.is_active = False
    _audit(db, admin.id, "admin_disable_user_api_keys", {"target_user_id": user.id, "count": len(keys)})
    db.commit()
    return {"disabled_api_keys": len(keys)}


@router.get("/api-keys")
def list_api_keys(
    status_filter: str | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if limit < 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "limit must be >= 1")
    q = db.query(ApiKey, User).outerjoin(User, User.id == ApiKey.user_id)
    if status_filter == "active":
        q = q.filter(ApiKey.is_active.is_(True))
    elif status_filter == "revoked":
        q = q.filter(ApiKey.is_active.is_(False))
    rows = q.order_by(ApiKey.created_at.desc()).limit(min(limit, 500)).all()
    return [_api_key_out(row) for row in rows]


@router.patch("/api-keys/{key_id}")
def update_api_key(
    key_id: str,
    payload: _ApiKeyPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    key = db.get(ApiKey, key_id)
    if not key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
    key.is_active = payload.is_active
    _audit(db, admin.id, "admin_update_api_key", {"api_key_id": key.id, "target_user_id": key.user_id, "is_active": key.is_active})
    db.commit()
    return {"ok": True, "is_active": key.is_active}


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 200,
    user_id: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if limit < 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "limit must be >= 1")
    q = db.query(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    rows = q.order_by(AuditLog.created_at.desc()).limit(min(limit, 500)).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": user.email if user else "",
            "action": log.action,
            "detail": log.detail,
            "created_at": log.created_at,
        }
        for log, user in rows
    ]


@router.get("/notifications/diagnostics")
def notification_diagnostics(
    limit: int = 200,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    recent = (
        db.query(Notification, User)
        .outerjoin(User, User.id == Notification.user_id)
        .order_by(Notification.created_at.desc())
        .limit(min(max(limit, 1), 500))
        .all()
    )
    duplicates: dict[str, dict] = {}
    for notification, user in recent:
        key = f"{notification.user_id}:{notification.title}:{notification.body[:80]}"
        item = duplicates.setdefault(
            key,
            {
                "user_id": notification.user_id,
                "user_email": user.email if user else "",
                "title": notification.title,
                "body": notification.body,
                "count": 0,
                "latest_at": notification.created_at,
            },
        )
        item["count"] += 1
        if notification.created_at > item["latest_at"]:
            item["latest_at"] = notification.created_at
    return {
        "total_notifications": db.query(Notification).count(),
        "unread_notifications": db.query(Notification).filter(Notification.is_read.is_(False)).count(),
        "active_devices": db.query(Device).filter(Device.revoked_at.is_(None)).count(),
        "identity_alerts": db.query(IdentityAlert).count(),
        "recent_notifications": [
            {
                "id": notification.id,
                "user_id": notification.user_id,
                "user_email": user.email if user else "",
                "title": notification.title,
                "body": notification.body,
                "is_read": notification.is_read,
                "created_at": notification.created_at,
            }
            for notification, user in recent
        ],
        "possible_duplicates": [item for item in duplicates.values() if item["count"] >= 3][:25],
    }


@router.post("/notifications/test")
def create_test_notification(
    payload: _TestNotificationIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    notification = Notification(user_id=user.id, title=payload.title[:120], body=payload.body[:1000])
    db.add(notification)
    _audit(db, admin.id, "admin_create_test_notification", {"target_user_id": user.id})
    db.commit()
    db.refresh(notification)
    return notification


@router.get("/subscriptions/diagnostics")
def subscription_diagnostics(
    limit: int = 200,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).limit(min(max(limit, 1), 500)).all()
    now = datetime.now(timezone.utc)
    return {
        "premium_users": db.query(User).filter(User.is_premium.is_(True)).count(),
        "with_product_id": db.query(User).filter(User.rc_product_id.isnot(None)).count(),
        "expired_premium": db.query(User).filter(User.is_premium.is_(True), User.premium_expires_at.isnot(None), User.premium_expires_at < now).count(),
        "users": [
            {
                "id": user.id,
                "email": user.email,
                "is_premium": user.is_premium,
                "premium_expires_at": user.premium_expires_at,
                "rc_product_id": user.rc_product_id,
                "status": "expired" if user.premium_expires_at and user.premium_expires_at < now else "premium" if user.is_premium else "free",
            }
            for user in users
        ],
    }


@router.get("/operations")
def operations_overview(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    risk_rows = (
        db.query(RiskReport.risk_level, RiskReport.threat_category)
        .join(ScanHistory, ScanHistory.id == RiskReport.scan_id)
        .filter(ScanHistory.created_at >= today)
        .all()
    )
    by_risk: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for risk_level, category in risk_rows:
        by_risk[str(_enum_value(risk_level))] = by_risk.get(str(_enum_value(risk_level)), 0) + 1
        by_category[category or "unknown"] = by_category.get(category or "unknown", 0) + 1
    return {
        "today": {
            "scans": db.query(ScanHistory).filter(ScanHistory.created_at >= today).count(),
            "new_users": db.query(User).filter(User.created_at >= today).count(),
            "notifications": db.query(Notification).filter(Notification.created_at >= today).count(),
            "reports": db.query(CommunityReport).filter(CommunityReport.created_at >= today).count(),
            "feedback": db.query(ScanFeedbackDetail).filter(ScanFeedbackDetail.created_at >= today).count(),
        },
        "risk_today": by_risk,
        "categories_today": by_category,
        "queues": {
            "community_reports": db.query(CommunityReport).filter(CommunityReport.status == "pending").count(),
            "feedback_reviews": db.query(ScanFeedbackDetail).filter(ScanFeedbackDetail.review_status == "pending").count(),
            "open_incidents": db.query(Incident).filter(Incident.status != "resolved").count(),
            "unread_notifications": db.query(Notification).filter(Notification.is_read.is_(False)).count(),
        },
        "telemetry": {
            "browser_events": db.query(BrowserTelemetryEvent).count(),
            "extension_events": db.query(ExtensionTelemetryEvent).count(),
            "monitored_identities": db.query(MonitoredIdentity).filter(MonitoredIdentity.is_active.is_(True)).count(),
            "breach_records": db.query(BreachRecord).count(),
            "case_pack_shares": db.query(CasePackShare).filter(CasePackShare.revoked_at.is_(None)).count(),
        },
    }


@router.get("/reports", response_model=list[CommunityReportAdminOut])
def list_community_reports(
    status_filter: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if limit < 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "limit must be >= 1")
    q = db.query(CommunityReport)
    if status_filter:
        q = q.filter(CommunityReport.status == status_filter)
    return q.order_by(CommunityReport.created_at.desc()).limit(min(limit, 500)).all()


@router.get("/feedback")
def list_feedback_reviews(
    status_filter: str | None = "pending",
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if limit < 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "limit must be >= 1")
    q = (
        db.query(ScanFeedbackDetail, ScanHistory, RiskReport)
        .join(ScanHistory, ScanHistory.id == ScanFeedbackDetail.scan_id)
        .outerjoin(RiskReport, RiskReport.scan_id == ScanHistory.id)
    )
    if status_filter:
        q = q.filter(ScanFeedbackDetail.review_status == status_filter)
    rows = q.order_by(ScanFeedbackDetail.created_at.desc()).limit(min(limit, 500)).all()
    return [
        {
            "id": feedback.id,
            "user_id": feedback.user_id,
            "scan_id": feedback.scan_id,
            "scan_type": str(scan.scan_type.value if hasattr(scan.scan_type, "value") else scan.scan_type),
            "raw_input": scan.raw_input,
            "feedback": feedback.feedback,
            "reason": feedback.reason,
            "corrected_context": feedback.corrected_context,
            "evidence": feedback.evidence,
            "review_status": feedback.review_status,
            "created_at": feedback.created_at,
            "risk_level": str(report.risk_level.value if report and hasattr(report.risk_level, "value") else report.risk_level if report else ""),
            "threat_category": report.threat_category if report else "",
            "risk_score": report.risk_score if report else None,
        }
        for feedback, scan, report in rows
    ]


@router.patch("/feedback/{feedback_id}")
def update_feedback_review(
    feedback_id: str,
    payload: _FeedbackReviewPatch,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if payload.review_status not in {"pending", "reviewed", "promoted", "rejected"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid review_status")
    feedback = db.get(ScanFeedbackDetail, feedback_id)
    if not feedback:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    feedback.review_status = payload.review_status
    db.commit()
    return {"ok": True, "review_status": feedback.review_status}


@router.post("/feedback/{feedback_id}/pattern", response_model=ScamPatternOut, status_code=status.HTTP_201_CREATED)
def promote_feedback_to_pattern(
    feedback_id: str,
    payload: ScamPatternCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    feedback = db.get(ScanFeedbackDetail, feedback_id)
    if not feedback:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    if db.query(ScamPattern).filter(ScamPattern.name == payload.name).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Pattern '{payload.name}' already exists")
    pattern = ScamPattern(**payload.model_dump())
    db.add(pattern)
    feedback.review_status = "promoted"
    db.commit()
    db.refresh(pattern)
    return pattern


@router.patch("/reports/{report_id}", response_model=CommunityReportAdminOut)
def review_community_report(
    report_id: str,
    payload: _ReportReviewPatch,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    report = db.get(CommunityReport, report_id)
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    patch = payload.model_dump(exclude_unset=True)
    if "status" in patch:
        if patch["status"] not in ("pending", "reviewed", "approved", "rejected"):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status value")
        report.status = patch["status"]
    if "analyst_notes" in patch:
        report.analyst_notes = str(patch["analyst_notes"])[:2000]
    db.commit()
    db.refresh(report)
    return report


@router.get("/patterns", response_model=list[ScamPatternOut])
def list_scam_patterns(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return db.query(ScamPattern).order_by(ScamPattern.created_at.desc()).all()


@router.post("/patterns", response_model=ScamPatternOut, status_code=status.HTTP_201_CREATED)
def create_scam_pattern(
    payload: ScamPatternCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if db.query(ScamPattern).filter(ScamPattern.name == payload.name).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Pattern '{payload.name}' already exists")
    pattern = ScamPattern(**payload.model_dump())
    db.add(pattern)
    db.commit()
    db.refresh(pattern)
    return pattern


@router.patch("/patterns/{pattern_id}", response_model=ScamPatternOut)
def update_scam_pattern(
    pattern_id: str,
    payload: _PatternPatch,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    pattern = db.get(ScamPattern, pattern_id)
    if not pattern:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pattern not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(pattern, key, val)
    db.commit()
    db.refresh(pattern)
    return pattern


@router.delete("/patterns/{pattern_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scam_pattern(
    pattern_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    pattern = db.get(ScamPattern, pattern_id)
    if not pattern:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pattern not found")
    pattern.is_active = False
    db.commit()


class _SeedEntryPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool


@router.patch("/seeded-numbers/{number}")
def update_seeded_number(
    number: str,
    payload: _SeedEntryPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate (or reactivate) a feed-seeded phone number — the escape
    hatch when a legitimate line ends up labeled from complaint data. The
    feed refresh never reactivates a row it finds already present, so a
    deactivation sticks across refreshes."""
    digits = "".join(ch for ch in number if ch.isdigit())
    row = db.query(SeededScamNumber).filter(SeededScamNumber.number == digits).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seeded number not found")
    row.is_active = payload.is_active
    _audit(db, admin.id, "seeded_number_update", {"number": digits, "is_active": payload.is_active})
    db.commit()
    return {"number": row.number, "label": row.label, "is_active": row.is_active}


@router.patch("/seeded-domains/{domain}")
def update_seeded_domain(
    domain: str,
    payload: _SeedEntryPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate (or reactivate) a feed-seeded phishing domain."""
    normalized = domain.strip().lower()
    row = db.query(SeededScamDomain).filter(SeededScamDomain.domain == normalized).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seeded domain not found")
    row.is_active = payload.is_active
    _audit(db, admin.id, "seeded_domain_update", {"domain": normalized, "is_active": payload.is_active})
    db.commit()
    return {"domain": row.domain, "is_active": row.is_active}
