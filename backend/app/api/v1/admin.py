"""Admin console routes — Phase 5.

All endpoints require is_admin=True.

GET  /api/v1/admin/stats                         — aggregate platform stats
GET  /api/v1/admin/users                         — user list
PATCH /api/v1/admin/users/{user_id}              — set flags (is_premium, is_admin, is_developer)
DELETE /api/v1/admin/users/{user_id}             — permanently delete a user account
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
from app.models.models import ApiKey, CommunityReport, RiskReport, ScamPattern, ScanFeedbackDetail, ScanHistory, User
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


@router.get("/stats", response_model=AdminStatsOut)
def get_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return AdminStatsOut(
        total_users=db.query(User).count(),
        total_scans=db.query(ScanHistory).count(),
        scans_today=db.query(ScanHistory).filter(ScanHistory.created_at >= today).count(),
        open_community_reports=db.query(CommunityReport).filter(CommunityReport.status == "pending").count(),
        pending_feedback_reviews=db.query(ScanFeedbackDetail).filter(ScanFeedbackDetail.review_status == "pending").count(),
        active_scam_patterns=db.query(ScamPattern).filter(ScamPattern.is_active.is_(True)).count(),
        active_api_keys=db.query(ApiKey).filter(ApiKey.is_active.is_(True)).count(),
        total_api_keys=db.query(ApiKey).count(),
        revoked_api_keys=db.query(ApiKey).filter(ApiKey.is_active.is_(False)).count(),
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


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user_flags(
    user_id: str,
    payload: _UserFlagsPatch,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, val)
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
    db.commit()


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
