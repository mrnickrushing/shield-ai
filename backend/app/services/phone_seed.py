"""Loads the bundled scam-number snapshot into seeded_scam_numbers.

The snapshot (app/data/scam_number_seed.json) is generated offline by
scripts/generate_phone_seed.py from FCC consumer-complaint data and committed
to the repo, so every deploy ships a working feed with no runtime dependency
on the FCC API. The runtime refresh loop calls reconcile_numbers directly
with freshly fetched data. Reconciliation is idempotent: new numbers are
inserted, feed-sourced numbers that dropped out are deactivated (caller IDs
rotate, and a number may turn out to be a spoofed legitimate line), and
numbers still present are left untouched so an admin deactivation sticks.
"""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.models import SeededScamNumber

_SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "scam_number_seed.json"
FEED_SOURCE = "fcc_complaints"


def reconcile_numbers(db: Session, entries: list[dict]) -> int:
    """Sync the table with a fetched entry list ({number, label,
    report_count} dicts). Returns how many rows were added."""
    wanted = {e["number"]: e for e in entries if e.get("number")}
    if not wanted:
        return 0

    existing = {n for (n,) in db.query(SeededScamNumber.number).all()}

    added = 0
    for number in sorted(set(wanted) - existing):
        entry = wanted[number]
        db.add(
            SeededScamNumber(
                number=number,
                label=entry.get("label", "Spam Risk"),
                source=FEED_SOURCE,
                report_count=int(entry.get("report_count", 0)),
            )
        )
        added += 1

    retired = (
        db.query(SeededScamNumber)
        .filter(
            SeededScamNumber.source == FEED_SOURCE,
            SeededScamNumber.is_active.is_(True),
            SeededScamNumber.number.notin_(set(wanted)),
        )
        .update({"is_active": False}, synchronize_session=False)
    )

    if added or retired:
        db.commit()
    return added


def seed_scam_numbers(db: Session) -> int:
    """Reconcile the table with the bundled snapshot. Returns how many rows
    were added."""
    if not _SEED_PATH.exists():
        return 0
    snapshot = json.loads(_SEED_PATH.read_text())
    return reconcile_numbers(db, snapshot.get("entries", []))
