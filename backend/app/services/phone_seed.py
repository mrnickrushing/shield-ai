"""Loads the bundled scam-number snapshot into seeded_scam_numbers.

The snapshot (app/data/scam_number_seed.json) is generated offline by
scripts/generate_phone_seed.py from FCC consumer-complaint data and committed
to the repo, so every deploy ships a working feed with no runtime dependency
on the FCC API. Seeding is idempotent: numbers already in the table are left
untouched (an admin may have deactivated one), new numbers are inserted.
"""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.models import SeededScamNumber

_SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "scam_number_seed.json"


def seed_scam_numbers(db: Session) -> int:
    """Insert snapshot numbers that aren't in the table yet. Returns how many
    rows were added."""
    if not _SEED_PATH.exists():
        return 0

    snapshot = json.loads(_SEED_PATH.read_text())
    entries = snapshot.get("entries", [])
    if not entries:
        return 0

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
    if added:
        db.commit()
    return added
