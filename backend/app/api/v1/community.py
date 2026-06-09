"""Community reporting routes — Phase 5.

POST /api/v1/community/reports       — submit a scam pattern report
GET  /api/v1/community/reports       — list your own reports
GET  /api/v1/community/patterns      — browse approved scam patterns (public)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import CommunityReport, ScamPattern, User  # User used in POST routes
from app.schemas.schemas import CommunityReportCreate, CommunityReportOut, ScamPatternOut

router = APIRouter(prefix="/community", tags=["community"])


@router.post("/reports", response_model=CommunityReportOut, status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: CommunityReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Report a false positive, a missed scam, or a new pattern for analyst review."""
    report = CommunityReport(
        user_id=user.id,
        scan_id=payload.scan_id,
        report_type=payload.report_type,
        artifact_text=payload.artifact_text[:2000],
        category=payload.category,
        platform_hint=payload.platform_hint,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports", response_model=list[CommunityReportOut])
def list_my_reports(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(CommunityReport)
        .filter(CommunityReport.user_id == user.id)
        .order_by(CommunityReport.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )


@router.get("/patterns", response_model=list[ScamPatternOut])
def list_patterns(
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Browse analyst-approved scam patterns (public, read-only, for transparency)."""
    return (
        db.query(ScamPattern)
        .filter(ScamPattern.is_active.is_(True), ScamPattern.source == "analyst")
        .order_by(ScamPattern.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
