"""Community reporting routes — Phase 5.

POST /api/v1/community/reports       — submit a scam pattern report
GET  /api/v1/community/reports       — list your own reports
GET  /api/v1/community/patterns      — browse approved scam patterns (public)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import CommunityReport, ScamPattern, ScanHistory, User
from app.schemas.schemas import CommunityReportCreate, CommunityReportOut, ScamPatternOut

router = APIRouter(prefix="/community", tags=["community"])


@router.post("/reports", response_model=CommunityReportOut, status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: CommunityReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Report a false positive, a missed scam, or a new pattern for analyst review."""
    if payload.scan_id:
        scan = db.get(ScanHistory, payload.scan_id)
        if not scan or scan.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid scan_id or report payload")
    db.refresh(report)
    return report


@router.get("/reports", response_model=list[CommunityReportOut])
def list_my_reports(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(CommunityReport)
        .filter(CommunityReport.user_id == user.id)
        .order_by(CommunityReport.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/patterns", response_model=list[ScamPatternOut])
def list_patterns(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Browse analyst-approved scam patterns (public, read-only, for transparency)."""
    return (
        db.query(ScamPattern)
        .filter(ScamPattern.is_active.is_(True), ScamPattern.source == "analyst")
        .order_by(ScamPattern.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/trends")
def scam_trends(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """What scammers are running THIS week, from live community data.

    Aggregates the last 14 days of high/critical scan verdicts by threat
    category across all users (counts only — no scan content leaves the
    aggregate), plus fresh community reports.
    """
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import func

    from app.models.models import RiskLevel, RiskReport

    since = datetime.now(timezone.utc) - timedelta(days=14)

    category_rows = (
        db.query(RiskReport.threat_category, func.count(RiskReport.id))
        .filter(
            RiskReport.created_at >= since,
            RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
            RiskReport.threat_category != "unknown",
        )
        .group_by(RiskReport.threat_category)
        .order_by(func.count(RiskReport.id).desc())
        .limit(6)
        .all()
    )

    report_rows = (
        db.query(CommunityReport.category, func.count(CommunityReport.id))
        .filter(CommunityReport.created_at >= since, CommunityReport.category != "")
        .group_by(CommunityReport.category)
        .order_by(func.count(CommunityReport.id).desc())
        .limit(6)
        .all()
    )

    total = sum(count for _, count in category_rows) or 1
    return {
        "window_days": 14,
        "trending": [
            {
                "category": category,
                "detections": count,
                "share": round(100 * count / total),
            }
            for category, count in category_rows
        ],
        "community_reports": [
            {"category": category, "reports": count} for category, count in report_rows
        ],
    }
