"""External threat-feed fetchers shared by the offline snapshot generators
(backend/scripts/generate_*_seed.py) and the runtime refresh loop.

Both callers need identical filtering, so it lives here:

- FCC Consumer Complaints (opendata.fcc.gov, dataset vakf-fz8e): unwanted-call
  complaints aggregated by caller ID. Complaint-reported, not verified — so
  entries get the soft "Spam Risk" label, and well-known legitimate lines that
  only accumulate complaints through spoofing are excluded.
- OpenPhish (openphish.com/feed.txt) and URLhaus (urlhaus.abuse.ch hostfile):
  live phishing/malware hosts for the Safari extension blocklist. Bare shared
  platforms (URL shorteners, big hosting providers) are excluded — the Safari
  handler matches parent domains, so flagging "vercel.app" would block every
  site on it, while flagging "evil-site.vercel.app" only blocks that host.
"""
from __future__ import annotations

import ipaddress
import re
from datetime import datetime, timedelta, timezone

import httpx

FCC_DATASET_URL = "https://opendata.fcc.gov/resource/vakf-fz8e.json"
FCC_LOOKBACK_DAYS = 913  # ~30 months
FCC_MIN_COMPLAINTS = 2  # at least two independent complaints corroborate a number
FCC_MAX_ENTRIES = 10_000
PHONE_SEED_LABEL = "Spam Risk"

OPENPHISH_FEED_URL = "https://openphish.com/feed.txt"
URLHAUS_HOSTFILE_URL = "https://urlhaus.abuse.ch/downloads/hostfile/"
DOMAIN_MAX_ENTRIES = 5_000

# Legitimate consumer-facing lines that accumulate complaints because scammers
# spoof them. Labeling the real line would suppress genuine calls (e.g. a
# bank's actual fraud department), so they never get seeded.
KNOWN_LEGIT_NUMBERS = {
    "8007332767",  # American Red Cross donations
    "8882255322",  # FCC consumer center
    "8008693557",  # Wells Fargo customer service
    "8009220204",  # Verizon customer service
    "8002662278",  # Comcast/Xfinity
    "8882662278",  # Comcast/Xfinity
    "8773824357",  # FTC Consumer Response Center (1-877-FTC-HELP)
    "8883821222",  # FTC Do Not Call Registry
    "8008291040",  # IRS individual help line
    "8007721213",  # Social Security Administration
    "8006334227",  # 1-800-MEDICARE
}

# Shared platforms and URL shorteners whose bare domain must never be flagged
# (subdomains that host a specific phishing page are still fair game).
SHARED_PLATFORMS = {
    "google.com", "docs.google.com", "drive.google.com", "sites.google.com",
    "forms.gle", "goo.gl", "github.com", "github.io", "gitlab.com",
    "bitbucket.org", "dropbox.com", "onedrive.live.com", "sharepoint.com",
    "office.com", "microsoft.com", "apple.com", "icloud.com", "amazon.com",
    "amazonaws.com", "s3.amazonaws.com", "cloudfront.net", "azurewebsites.net",
    "windows.net", "firebaseapp.com", "web.app", "appspot.com",
    "herokuapp.com", "netlify.app", "vercel.app", "pages.dev", "workers.dev",
    "weebly.com", "wixsite.com", "wordpress.com", "blogspot.com",
    "tumblr.com", "notion.site", "glitch.me", "repl.co", "replit.app",
    "surge.sh", "webflow.io", "godaddysites.com", "square.site",
    "shopify.com", "myshopify.com", "t.co", "bit.ly", "tinyurl.com",
    "is.gd", "lnk.ink", "linktr.ee", "t.me", "telegram.org", "discord.com",
    "discord.gg", "facebook.com", "instagram.com", "twitter.com", "x.com",
    "youtube.com", "ipfs.io", "duckdns.org",
}


def _valid_nanp(digits: str) -> bool:
    if len(digits) != 10:
        return False
    if digits[0] in "01" or digits[3] in "01":
        return False
    if len(set(digits)) == 1:  # 555-555-5555 style placeholders
        return False
    return True


def fetch_fcc_complaint_numbers() -> list[dict]:
    """Aggregated unwanted-call complaint counts by caller ID, filtered and
    normalized to E.164 digits (no '+'). Sorted by complaint count, capped."""
    since = (datetime.now(timezone.utc) - timedelta(days=FCC_LOOKBACK_DAYS)).strftime(
        "%Y-%m-%dT00:00:00.000"
    )
    params = {
        "$select": "caller_id_number, count(1) as cnt",
        "$where": (
            f"issue_date > '{since}' AND issue = 'Unwanted Calls'"
            " AND caller_id_number IS NOT NULL"
        ),
        "$group": "caller_id_number",
        "$having": f"count(1) >= {FCC_MIN_COMPLAINTS}",
        "$order": "cnt DESC",
        "$limit": str(FCC_MAX_ENTRIES * 3),  # headroom for rows filtered below
    }
    resp = httpx.get(FCC_DATASET_URL, params=params, timeout=60)
    resp.raise_for_status()

    entries: list[dict] = []
    for row in resp.json():
        digits = re.sub(r"\D", "", row.get("caller_id_number") or "")
        if len(digits) == 11 and digits.startswith("1"):
            digits = digits[1:]
        if not _valid_nanp(digits) or digits in KNOWN_LEGIT_NUMBERS:
            continue
        entries.append(
            {"number": "1" + digits, "label": PHONE_SEED_LABEL, "report_count": int(row["cnt"])}
        )
    return entries[:FCC_MAX_ENTRIES]


def _valid_flag_host(host: str) -> bool:
    host = host.strip().lower().rstrip(".")
    if not host or "." not in host or len(host) > 253:
        return False
    try:
        ipaddress.ip_address(host)
        return False  # bare IPs aren't useful to the domain matcher
    except ValueError:
        pass
    bare = host[4:] if host.startswith("www.") else host
    if bare in SHARED_PLATFORMS:
        return False
    return bool(re.fullmatch(r"[a-z0-9.-]+", host))


def fetch_phishing_domains() -> list[str]:
    """Hostnames from OpenPhish and URLhaus, deduped and filtered. OpenPhish
    (live phishing) gets priority under the cap; URLhaus fills the rest."""
    openphish: set[str] = set()
    resp = httpx.get(OPENPHISH_FEED_URL, timeout=60, follow_redirects=True)
    resp.raise_for_status()
    for line in resp.text.splitlines():
        line = line.strip()
        if not line or "://" not in line:
            continue
        host = line.split("://", 1)[1].split("/", 1)[0].split("?", 1)[0]
        host = host.split("@")[-1].split(":")[0].lower().rstrip(".")
        if _valid_flag_host(host):
            openphish.add(host)

    urlhaus: set[str] = set()
    resp = httpx.get(URLHAUS_HOSTFILE_URL, timeout=60, follow_redirects=True)
    resp.raise_for_status()
    for line in resp.text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        host = (parts[-1].lower().rstrip(".")) if parts else ""
        if _valid_flag_host(host):
            urlhaus.add(host)

    combined = sorted(openphish) + sorted(urlhaus - openphish)
    return combined[:DOMAIN_MAX_ENTRIES]
