"""Loads the bundled phishing-domain snapshot into seeded_scam_domains.

The snapshot (app/data/scam_domain_seed.json) is generated offline by
scripts/generate_domain_seed.py from OpenPhish + URLhaus and committed to the
repo, so every deploy ships a working Safari blocklist with no runtime
dependency on the feeds. The runtime refresh loop calls reconcile_domains
directly with freshly fetched data. Reconciliation is idempotent: new domains
are inserted, feed-sourced domains that dropped out are deactivated (phishing
hosts get cleaned up or reclaimed), domains still present are left untouched
so an admin deactivation sticks.
"""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.models import SeededScamDomain

_SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "scam_domain_seed.json"
FEED_SOURCE = "phishing_feeds"


def reconcile_domains(db: Session, domains: list[str]) -> int:
    """Sync the table with a fetched domain list. Returns how many rows were
    added."""
    wanted = {d.strip().lower() for d in domains if d and d.strip()}
    if not wanted:
        return 0

    existing = {d for (d,) in db.query(SeededScamDomain.domain).all()}

    added = 0
    for domain in sorted(wanted - existing):
        db.add(SeededScamDomain(domain=domain, source=FEED_SOURCE))
        added += 1

    retired = (
        db.query(SeededScamDomain)
        .filter(
            SeededScamDomain.source == FEED_SOURCE,
            SeededScamDomain.is_active.is_(True),
            SeededScamDomain.domain.notin_(wanted),
        )
        .update({"is_active": False}, synchronize_session=False)
    )

    if added or retired:
        db.commit()
    return added


def seed_scam_domains(db: Session) -> int:
    """Reconcile the table with the bundled snapshot. Returns how many rows
    were added."""
    if not _SEED_PATH.exists():
        return 0
    snapshot = json.loads(_SEED_PATH.read_text())
    return reconcile_domains(db, snapshot.get("domains", []))
