"""Account deletion helpers shared by user privacy controls and admin tools."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.models import (
    ApiKey,
    ApiUsage,
    AuditLog,
    AuthSession,
    BreachRecord,
    BrokerOptOut,
    BrowserTelemetryEvent,
    CasePackShare,
    CommunityReport,
    Device,
    EducationProgress,
    ExtensionTelemetryEvent,
    IdentityAlert,
    Incident,
    IncidentEvidence,
    MonitoredIdentity,
    Notification,
    NotificationPreference,
    PrivacyPreference,
    Profile,
    ScanFeedbackDetail,
    SocialIdentity,
    TrustedContact,
    User,
)
from app.services.privacy import purge_user_scans


def delete_user_account(db: Session, user: User, *, audit_detail: dict | None = None) -> None:
    """Remove a user and user-owned data while preserving anonymized public review records."""
    purge_user_scans(db, user.id)

    incident_ids = [row[0] for row in db.query(Incident.id).filter(Incident.user_id == user.id).all()]
    if incident_ids:
        db.query(IncidentEvidence).filter(IncidentEvidence.incident_id.in_(incident_ids)).delete(synchronize_session=False)
        db.query(CasePackShare).filter(CasePackShare.incident_id.in_(incident_ids)).delete(synchronize_session=False)
    db.query(Incident).filter(Incident.user_id == user.id).delete(synchronize_session=False)

    for model in (
        Notification,
        Device,
        AuthSession,
        NotificationPreference,
        PrivacyPreference,
        TrustedContact,
        EducationProgress,
        BreachRecord,
        IdentityAlert,
        BrokerOptOut,
        MonitoredIdentity,
        BrowserTelemetryEvent,
        ExtensionTelemetryEvent,
        ScanFeedbackDetail,
        ApiUsage,
        ApiKey,
        SocialIdentity,
    ):
        db.query(model).filter(model.user_id == user.id).delete(synchronize_session=False)

    db.query(CommunityReport).filter(CommunityReport.user_id == user.id).update(
        {CommunityReport.user_id: None},
        synchronize_session=False,
    )
    db.query(AuditLog).filter(AuditLog.user_id == user.id).update(
        {AuditLog.user_id: None, AuditLog.detail: audit_detail or {"account_deleted": True}},
        synchronize_session=False,
    )
    db.query(Profile).filter(Profile.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
