"""Scam-proof score: one number summarizing how protected a user actually is.

Unlike the old dashboard ring (a cosmetic formula over scan counts), this
scores concrete, fixable protection posture. Each component contributes
points, and everything not yet earned becomes an actionable "fix" the app
can deep-link to — which is the real point: gamifying the setup steps most
users skip (call filter, text filter, monitoring, education).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    BrowserTelemetryEvent,
    EducationProgress,
    ExtensionTelemetryEvent,
    MonitoredIdentity,
    ScanHistory,
    User,
)

# (key, points, title, fix_hint, screen)
COMPONENTS = [
    ("scanned_recently", 15, "Ran a scan in the last 7 days", "Scan anything suspicious to stay sharp.", "scan"),
    ("call_protection", 20, "Call protection synced", "Turn on scam-call labeling in Settings → Phone.", "call-protection"),
    ("text_protection", 15, "Text filtering active", "Enable SMS filtering in Settings → Messages → Unknown & Spam.", "call-protection"),
    ("safe_browser_used", 10, "Used the live Safe Browser", "Open links through the Safe Browser for real-time protection.", "browser"),
    ("identity_monitored", 20, "Identity monitoring set up", "Add your email so we watch for new breaches.", "identity"),
    ("education_started", 10, "Completed a scam-spotting lesson", "Take a 2-minute lesson — trained users spot scams faster.", "education"),
    ("premium_active", 10, "Premium protection active", "Start your subscription to unlock scanning and live protection.", "paywall"),
]

MAX_SCORE = sum(points for _, points, _, _, _ in COMPONENTS)


def compute_protection_score(db: Session, user: User) -> dict:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    def _ext_active(ext_type: str) -> bool:
        return (
            db.query(ExtensionTelemetryEvent.id)
            .filter(
                ExtensionTelemetryEvent.user_id == user.id,
                ExtensionTelemetryEvent.extension_type == ext_type,
                ExtensionTelemetryEvent.created_at >= month_ago,
            )
            .first()
            is not None
        )

    earned = {
        "scanned_recently": (
            db.query(ScanHistory.id)
            .filter(ScanHistory.user_id == user.id, ScanHistory.created_at >= week_ago)
            .first()
            is not None
        ),
        "call_protection": _ext_active("call_directory"),
        "text_protection": _ext_active("message_filter"),
        "safe_browser_used": (
            db.query(BrowserTelemetryEvent.id)
            .filter(BrowserTelemetryEvent.user_id == user.id, BrowserTelemetryEvent.created_at >= month_ago)
            .first()
            is not None
        ),
        "identity_monitored": (
            db.query(MonitoredIdentity.id)
            .filter(MonitoredIdentity.user_id == user.id, MonitoredIdentity.is_active.is_(True))
            .first()
            is not None
        ),
        "education_started": (
            db.query(EducationProgress.id)
            .filter(EducationProgress.user_id == user.id, EducationProgress.completed.is_(True))
            .first()
            is not None
        ),
        "premium_active": bool(user.is_premium),
    }

    score = 0
    components = []
    fixes = []
    for key, points, title, fix_hint, screen in COMPONENTS:
        ok = bool(earned.get(key))
        if ok:
            score += points
        else:
            fixes.append({"key": key, "points": points, "hint": fix_hint, "screen": screen})
        components.append({"key": key, "points": points, "title": title, "earned": ok, "screen": screen})

    return {
        "score": round(100 * score / MAX_SCORE),
        "components": components,
        # Highest-impact things to fix first.
        "fixes": sorted(fixes, key=lambda f: -f["points"])[:3],
        "generated_at": now.isoformat(),
    }
