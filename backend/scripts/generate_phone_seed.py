"""Regenerate app/data/scam_number_seed.json from FCC consumer-complaint data.

Fetch/filter logic lives in app.services.feed_sources so this snapshot and
the server's runtime refresh stay consistent. See that module for the
labeling rationale and the known-legit exclusion list.

Usage:
    python scripts/generate_phone_seed.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.feed_sources import PHONE_SEED_LABEL, fetch_fcc_complaint_numbers  # noqa: E402


def main() -> int:
    entries = fetch_fcc_complaint_numbers()
    if len(entries) < 20:
        print(f"Refusing to write a suspiciously small feed ({len(entries)} entries)")
        return 1

    out_path = Path(__file__).resolve().parents[1] / "app" / "data" / "scam_number_seed.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "FCC Consumer Complaints Data (opendata.fcc.gov/resource/vakf-fz8e)",
        "label": PHONE_SEED_LABEL,
        "entries": entries,
    }
    out_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {len(entries)} entries to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
