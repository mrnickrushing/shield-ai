"""Loads the bundled scam-number snapshot into seeded_scam_numbers.

The snapshot (app/data/scam_number_seed.json) is generated offline by
scripts/generate_phone_seed.py from FCC consumer-complaint data and committed
to the repo, so every deploy ships a working feed with no runtime dependency
on the FCC API. Seeding is idempotent: new snapshot numbers are inserted,
feed-sourced numbers that dropped out of the snapshot are deactivated (caller
IDs rotate, and a number may turn out to be a spoofed legitimate line), and
numbers still present are left untouched so an admin deactivation sticks.
"""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.models import SeededScamNumber

_SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "scam_number_seed.json"


def seed_scam_numbers(db: Session) -> int:
    """Reconcile the table with the bundled snapshot. Returns how many rows
    were added."""
    if not _SEED_PATH.exists():
        return 0

    snapshot = json.loads(_SEED_PATH.read_text())
    entries = snapshot.get("entries", [])
    if not entries:
        return 0

    snapshot_numbers = {e["number"] for e in entries if e.get("number")}
    existing = {n for (n,) in db.query(SeededScamNumber.number).all()}

    added = 0
    for entry in entries:
        number = entry.get("number", "")
        if not number or number in existing:
            continue
        db.add(
            SeededScamNumber(
                number=number,
                label=entry.get("label", "Spam Risk"),
                source="fcc_complaints",
                report_count=int(entry.get("report_count", 0)),
            )
        )
        added += 1

    retired = (
        db.query(SeededScamNumber)
        .filter(
            SeededScamNumber.source == "fcc_complaints",
            SeededScamNumber.is_active.is_(True),
            SeededScamNumber.number.notin_(snapshot_numbers),
        )
        .update({"is_active": False}, synchronize_session=False)
    )

    if added or retired:
        db.commit()
    return added
