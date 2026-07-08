"""URL reputation snapshot for the Safari Web Extension.

Mirrors phone_reputation.py: the main app periodically fetches this and
writes it into the shared App Group container; the Safari extension's native
handler answers domain-check queries against it entirely offline. Domains
qualify when link scans across the community repeatedly verdict them
high/critical — the extension never phones home per page view.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import LinkScan, RiskLevel, RiskReport, ScanHistory, SeededScamDomain, User

router = APIRouter(prefix="/url-reputation", tags=["url-reputation"])

# One corroborating scan is enough for a domain: unlike phone numbers, a
# high/critical URL verdict already folds in Google Web Risk + heuristics.
MIN_DETECTIONS = 1
MAX_ENTRIES = 5000


@router.get("/sync")
def sync_url_reputation(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(
            LinkScan.domain,
            func.count(RiskReport.id).label("detections"),
            func.max(RiskReport.created_at).label("last_seen"),
        )
        .join(ScanHistory, LinkScan.scan_id == ScanHistory.id)
        .join(RiskReport, RiskReport.scan_id == ScanHistory.id)
        .filter(
            LinkScan.domain != "",
            RiskReport.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
        )
        .group_by(LinkScan.domain)
        .having(func.count(RiskReport.id) >= MIN_DETECTIONS)
        .order_by(func.max(RiskReport.created_at).desc())
        .limit(MAX_ENTRIES)
        .all()
    )

    # Externally-seeded phishing domains (OpenPhish/URLhaus) fill the list
    # before community link scans accumulate.
    seeds = (
        db.query(SeededScamDomain)
        .filter(SeededScamDomain.is_active.is_(True))
        .all()
    )
    domains = [seed.domain for seed in seeds]
    latest = max((seed.created_at for seed in seeds), default=None)

    for domain, _detections, last_seen in rows:
        domains.append(domain.lower())
        if latest is None or (last_seen and last_seen > latest):
            latest = last_seen

    return {
        "version": latest.isoformat() if latest else "0",
        "domains": sorted(set(domains)),
    }
