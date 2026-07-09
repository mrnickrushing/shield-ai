"""Data-broker exposure catalog.

People-search sites republish names, addresses, phone numbers, and relatives —
raw material for spear-phishing, SIM swaps, and family-emergency scams. This
catalog powers a guided "find yourself, then opt out" checklist. Entries are
curated: search URLs let the user check their own exposure (we never scrape),
and opt_out_url + instructions walk them through each site's removal flow.

priority: 1 = highest-traffic brokers to remove first.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

BROKERS: list[dict] = [
    {
        "key": "whitepages",
        "name": "Whitepages",
        "priority": 1,
        "search_url": "https://www.whitepages.com/name/{name}",
        "opt_out_url": "https://www.whitepages.com/suppression-requests",
        "instructions": "Search your name, copy your profile URL, then paste it into the suppression request form. Requires a phone call verification.",
        "expected_days": 2,
    },
    {
        "key": "spokeo",
        "name": "Spokeo",
        "priority": 1,
        "search_url": "https://www.spokeo.com/{name}",
        "opt_out_url": "https://www.spokeo.com/optout",
        "instructions": "Find your listing, copy its URL, submit it with an email address. Confirm via the email they send.",
        "expected_days": 3,
    },
    {
        "key": "beenverified",
        "name": "BeenVerified",
        "priority": 1,
        "search_url": "https://www.beenverified.com/app/optout/search",
        "opt_out_url": "https://www.beenverified.com/app/optout/search",
        "instructions": "Use their opt-out search, locate your record, and confirm removal via the email link.",
        "expected_days": 1,
    },
    {
        "key": "truepeoplesearch",
        "name": "TruePeopleSearch",
        "priority": 1,
        "search_url": "https://www.truepeoplesearch.com/results?name={name}",
        "opt_out_url": "https://www.truepeoplesearch.com/removal",
        "instructions": "Find your record, click 'Remove This Record'. No account needed — one of the fastest removals.",
        "expected_days": 1,
    },
    {
        "key": "fastpeoplesearch",
        "name": "FastPeopleSearch",
        "priority": 1,
        "search_url": "https://www.fastpeoplesearch.com/name/{name}",
        "opt_out_url": "https://www.fastpeoplesearch.com/removal",
        "instructions": "Locate your listing and use the removal page. Works without creating an account.",
        "expected_days": 1,
    },
    {
        "key": "radaris",
        "name": "Radaris",
        "priority": 2,
        "search_url": "https://radaris.com/p/{name}",
        "opt_out_url": "https://radaris.com/control/privacy",
        "instructions": "Search your profile, then use the privacy control page. May require a verification code by SMS.",
        "expected_days": 5,
    },
    {
        "key": "intelius",
        "name": "Intelius",
        "priority": 2,
        "search_url": "https://www.intelius.com/optout",
        "opt_out_url": "https://www.intelius.com/optout",
        "instructions": "Use their opt-out portal (also covers Instant Checkmate and TruthFinder listings owned by the same company).",
        "expected_days": 3,
    },
    {
        "key": "truthfinder",
        "name": "TruthFinder",
        "priority": 2,
        "search_url": "https://www.truthfinder.com/opt-out/",
        "opt_out_url": "https://www.truthfinder.com/opt-out/",
        "instructions": "Search on the opt-out page, select your record, confirm via email.",
        "expected_days": 3,
    },
    {
        "key": "instantcheckmate",
        "name": "Instant Checkmate",
        "priority": 2,
        "search_url": "https://www.instantcheckmate.com/opt-out/",
        "opt_out_url": "https://www.instantcheckmate.com/opt-out/",
        "instructions": "Use the opt-out search, pick your record, confirm the removal email.",
        "expected_days": 3,
    },
    {
        "key": "peoplefinders",
        "name": "PeopleFinders",
        "priority": 2,
        "search_url": "https://www.peoplefinders.com/people/{name}",
        "opt_out_url": "https://www.peoplefinders.com/manage",
        "instructions": "Find your listing, then use the 'Manage my listing' flow to request removal.",
        "expected_days": 3,
    },
    {
        "key": "ussearch",
        "name": "USSearch",
        "priority": 3,
        "search_url": "https://www.ussearch.com/opt-out/submit/",
        "opt_out_url": "https://www.ussearch.com/opt-out/submit/",
        "instructions": "Submit the opt-out form with your listing details; confirm via email.",
        "expected_days": 3,
    },
    {
        "key": "mylife",
        "name": "MyLife",
        "priority": 3,
        "search_url": "https://www.mylife.com/pub-multisearch.pubview?searchWhat={name}",
        "opt_out_url": "https://www.mylife.com/ccpa/index.pubview",
        "privacy_email": "privacy@mylife.com",
        "instructions": "Use the CCPA request form, or email privacy@mylife.com with your profile URL and request deletion.",
        "expected_days": 10,
    },
    {
        "key": "peekyou",
        "name": "PeekYou",
        "priority": 3,
        "search_url": "https://www.peekyou.com/{name}",
        "opt_out_url": "https://www.peekyou.com/about/contact/optout/",
        "instructions": "Find your listing's unique ID in its URL and submit it through the opt-out form.",
        "expected_days": 10,
    },
    {
        "key": "clustrmaps",
        "name": "ClustrMaps",
        "priority": 3,
        "search_url": "https://clustrmaps.com/persons/{name}",
        "opt_out_url": "https://clustrmaps.com/bl/opt-out",
        "instructions": "Locate your listing, then submit its URL through the opt-out page and confirm by email.",
        "expected_days": 5,
    },
    {
        "key": "thatsthem",
        "name": "ThatsThem",
        "priority": 3,
        "search_url": "https://thatsthem.com/name/{name}",
        "opt_out_url": "https://thatsthem.com/optout",
        "instructions": "Search your name, then use the opt-out form with the listing URL.",
        "expected_days": 7,
    },
    {
        "key": "nuwber",
        "name": "Nuwber",
        "priority": 3,
        "search_url": "https://nuwber.com/search?name={name}",
        "opt_out_url": "https://nuwber.com/removal/link",
        "instructions": "Find your profile URL and paste it into the removal page; confirm via email.",
        "expected_days": 5,
    },
]

VALID_STATUSES = {"not_started", "not_listed", "found", "requested", "removed"}
# Statuses that count as "handled" for the exposure summary.
RESOLVED_STATUSES = {"not_listed", "removed"}


def catalog_for(display_name: str) -> list[dict]:
    """Render the catalog with the user's name substituted into search URLs."""
    slug = quote_plus((display_name or "").strip()) or "your+name"
    out = []
    for b in sorted(BROKERS, key=lambda b: (b["priority"], b["name"])):
        entry = dict(b)
        entry["search_url"] = b["search_url"].replace("{name}", slug)
        entry.setdefault("privacy_email", "")
        out.append(entry)
    return out


def deadline_for(
    status: str, requested_at: datetime | None, expected_days: int
) -> tuple[datetime | None, bool]:
    """(check_back_on, overdue) for a broker row.

    Only 'requested' rows have a deadline: the broker's own promised removal
    window, counted from when the user submitted the request.
    """
    if status != "requested" or requested_at is None:
        return None, False
    if requested_at.tzinfo is None:
        requested_at = requested_at.replace(tzinfo=timezone.utc)
    check_back_on = requested_at + timedelta(days=expected_days)
    return check_back_on, datetime.now(timezone.utc) > check_back_on


def build_opt_out_letter(
    entry: dict, *, display_name: str, email: str, listing_url: str
) -> dict:
    """Deterministic CCPA/state-privacy removal request for one broker."""
    subject = f"Data deletion / opt-out request — {display_name}"
    body = (
        f"To the privacy team at {entry['name']},\n"
        "\n"
        "I am requesting the removal of my personal information from your site and "
        "the suppression of future listings, under the California Consumer Privacy "
        "Act (CCPA/CPRA) and equivalent state privacy laws, including my right to "
        "deletion and my right to opt out of the sale or sharing of my personal "
        "information.\n"
        "\n"
        f"Name: {display_name}\n"
        f"Listing URL: {listing_url}\n"
        f"Contact email for this request: {email}\n"
        "\n"
        "Please:\n"
        "1. Delete the listing above and any other records you hold about me.\n"
        "2. Suppress my information from re-publication in future data refreshes.\n"
        "3. Confirm completion to the contact email above.\n"
        "\n"
        f"Your published removal process states this takes about {entry['expected_days']} "
        f"day{'s' if entry['expected_days'] != 1 else ''}. If you need additional "
        "verification, contact me at the email above — do not use this request to "
        "enrich or re-publish my data.\n"
        "\n"
        f"Thank you,\n{display_name}"
    )
    return {"subject": subject, "body": body}
