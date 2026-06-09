"""Admin console routes — Phase 5.

All endpoints require is_admin=True.

GET  /api/v1/admin/stats                         — aggregate platform stats
GET  /api/v1/admin/users                         — user list
PATCH /api/v1/admin/users/{user_id}              — set flags (is_premium, is_admin, is_developer)
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
from app.db.session import get_db
from app.models.models import ApiKey, CommunityReport, ScamPattern, ScanHistory, User
from app.schemas.schemas import (
    AdminStatsOut,
    AdminUserOut,
    CommunityReportAdminOut,
    ScamPatternCreate,
    ScamPatternOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])


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
        active_scam_patterns=db.query(ScamPattern).filter(ScamPattern.is_active.is_(True)).count(),
        active_api_keys=db.query(ApiKey).filter(ApiKey.is_active.is_(True)).count(),
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if limit < 1:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "limit must be >= 1")
    return (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )


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
    return user


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
