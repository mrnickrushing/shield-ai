"""Regenerate app/data/scam_number_seed.json from FCC consumer-complaint data.

Pulls the FCC "Consumer Complaints Data" set (opendata.fcc.gov, dataset
vakf-fz8e — public Socrata API, no key required), aggregates Unwanted Calls
complaints by caller ID, and keeps numbers with enough independent complaints
in the lookback window.

These are complaint-reported numbers, not verified scams — scammers routinely
spoof legitimate caller IDs and those spoofed IDs accumulate complaints too.
So seeded entries get the softer "Spam Risk" label (community-corroborated
Shield AI reports keep "Scam Likely"), and well-known legitimate consumer
lines that show up purely through spoofing are excluded outright.

Usage:
    python scripts/generate_phone_seed.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

DATASET_URL = "https://opendata.fcc.gov/resource/vakf-fz8e.json"
LOOKBACK_DAYS = 548  # ~18 months: stale caller IDs rotate out of use quickly
MIN_COMPLAINTS = 5
MAX_ENTRIES = 300
LABEL = "Spam Risk"

# Legitimate consumer-facing lines that accumulate complaints because scammers
# spoof them. Labeling the real line would suppress genuine calls (e.g. a
# bank's actual fraud department), so they never get seeded.
KNOWN_LEGIT = {
    "8007332767",  # American Red Cross donations
    "8882255322",  # FCC consumer center
    "8008693557",  # Wells Fargo customer service
    "8009220204",  # Verizon customer service
    "8002662278",  # Comcast/Xfinity
    "8882662278",  # Comcast/Xfinity
}


def _valid_nanp(digits: str) -> bool:
    if len(digits) != 10:
        return False
    if digits[0] in "01" or digits[3] in "01":
        return False
    if len(set(digits)) == 1:  # 555-555-5555 style placeholders
        return False
    return True


def fetch_complaint_counts() -> list[tuple[str, int]]:
    since = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime(
        "%Y-%m-%dT00:00:00.000"
    )
    params = {
        "$select": "caller_id_number, count(1) as cnt",
        "$where": (
            f"issue_date > '{since}' AND issue = 'Unwanted Calls'"
            " AND caller_id_number IS NOT NULL"
        ),
        "$group": "caller_id_number",
        "$having": f"count(1) >= {MIN_COMPLAINTS}",
        "$order": "cnt DESC",
        "$limit": str(MAX_ENTRIES * 3),  # headroom for rows filtered below
    }
    resp = httpx.get(DATASET_URL, params=params, timeout=60)
    resp.raise_for_status()
    rows = resp.json()

    counts: list[tuple[str, int]] = []
    for row in rows:
        digits = re.sub(r"\D", "", row.get("caller_id_number") or "")
        if len(digits) == 11 and digits.startswith("1"):
            digits = digits[1:]
        if not _valid_nanp(digits) or digits in KNOWN_LEGIT:
            continue
        counts.append(("1" + digits, int(row["cnt"])))
    return counts[:MAX_ENTRIES]


def main() -> int:
    counts = fetch_complaint_counts()
    if len(counts) < 20:
        print(f"Refusing to write a suspiciously small feed ({len(counts)} entries)")
        return 1

    out_path = Path(__file__).resolve().parents[1] / "app" / "data" / "scam_number_seed.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "FCC Consumer Complaints Data (opendata.fcc.gov/resource/vakf-fz8e)",
        "label": LABEL,
        "entries": [
            {"number": number, "label": LABEL, "report_count": cnt}
            for number, cnt in counts
        ],
    }
    out_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {len(counts)} entries to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
