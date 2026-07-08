"""Regenerate app/data/scam_domain_seed.json from OpenPhish + URLhaus.

Fetch/filter logic lives in app.services.feed_sources so this snapshot and
the server's runtime refresh stay consistent.

Usage:
    python scripts/generate_domain_seed.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.feed_sources import fetch_phishing_domains  # noqa: E402


def main() -> int:
    domains = fetch_phishing_domains()
    if len(domains) < 100:
        print(f"Refusing to write a suspiciously small feed ({len(domains)} domains)")
        return 1

    out_path = Path(__file__).resolve().parents[1] / "app" / "data" / "scam_domain_seed.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "OpenPhish (openphish.com) + URLhaus (urlhaus.abuse.ch)",
        "domains": domains,
    }
    out_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {len(domains)} domains to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
