"""Email analysis service — Phase 2.

Detects sender display-name spoofing, reply-to hijacking, urgent subjects,
and embedded links. Accepts either a raw RFC-2822 email string or individual
fields (whichever the user provides).
"""
from __future__ import annotations

import re
from email import message_from_string
from email.header import decode_header
from email.utils import parseaddr

# Brands whose display name should match their sending domain.
_BRAND_DOMAINS: dict[str, list[str]] = {
    "paypal": ["paypal.com"],
    "apple": ["apple.com", "icloud.com"],
    "amazon": ["amazon.com"],
    "microsoft": ["microsoft.com", "outlook.com", "hotmail.com"],
    "google": ["google.com", "gmail.com", "googlemail.com"],
    "irs": ["irs.gov"],
    "chase": ["chase.com", "jpmorgan.com"],
    "wellsfargo": ["wellsfargo.com"],
    "bankofamerica": ["bankofamerica.com"],
    "netflix": ["netflix.com"],
    "coinbase": ["coinbase.com"],
    "facebook": ["facebook.com", "fb.com", "meta.com"],
    "instagram": ["instagram.com"],
    "usps": ["usps.com", "usps.gov"],
    "fedex": ["fedex.com"],
    "ups": ["ups.com"],
    "mcafee": ["mcafee.com"],
    "norton": ["norton.com", "nortonlifelock.com", "gen.com"],
    "lifelock": ["lifelock.com", "nortonlifelock.com"],
    "webroot": ["webroot.com"],
    "malwarebytes": ["malwarebytes.com"],
}

_URL_RE = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+')
_URGENT_SUBJECT_RE = re.compile(
    r"urgent|action required|verify|suspend|final notice|security alert|"
    r"your account|unusual sign.in|confirm your|limited time",
    re.I,
)


def _decode_header_value(value: str) -> str:
    parts = []
    for raw, charset in decode_header(value or ""):
        if isinstance(raw, bytes):
            parts.append(raw.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(str(raw))
    return "".join(parts)


def _sender_mismatch(display_name: str, from_email: str) -> str | None:
    """Return the impersonated brand name if display ≠ actual domain, else None."""
    display_low = display_name.lower()
    domain = from_email.split("@")[-1].lower() if "@" in from_email else ""
    for brand, legit_domains in _BRAND_DOMAINS.items():
        if brand in display_low:
            if not any(domain == d or domain.endswith("." + d) for d in legit_domains):
                return brand
    return None


def analyze_email(
    raw_email: str | None = None,
    sender_email: str | None = None,
    sender_display_name: str | None = None,
    reply_to_email: str | None = None,
    subject: str | None = None,
    body_text: str | None = None,
) -> dict:
    """Parse an email (raw or structured) and return a deterministic evidence dict."""
    signals: dict = {}
    flags: list[str] = []
    category = "unknown"
    extracted_urls: list[str] = []

    # --- parse raw email if provided ---
    if raw_email:
        msg = message_from_string(raw_email)
        raw_from = msg.get("From", "")
        parsed_display, parsed_addr = parseaddr(raw_from)
        sender_display_name = sender_display_name or _decode_header_value(parsed_display)
        sender_email = sender_email or parsed_addr
        reply_to_email = reply_to_email or msg.get("Reply-To", "")
        subject = subject or _decode_header_value(msg.get("Subject", ""))

        if not body_text:
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        payload = part.get_payload(decode=True)
                        body_text = payload.decode("utf-8", errors="replace") if payload else ""
                        break
            else:
                payload = msg.get_payload(decode=True)
                body_text = payload.decode("utf-8", errors="replace") if isinstance(payload, bytes) else (payload or "")

        signals["has_dkim"] = bool(msg.get("DKIM-Signature"))
        auth_results = str(msg.get("Authentication-Results", "")).lower()
        signals["spf_pass"] = "spf=pass" in auth_results
        signals["dkim_pass"] = "dkim=pass" in auth_results
        signals["received_hop_count"] = len(msg.get_all("Received", []))

    # --- sender display-name mismatch ---
    if sender_email and sender_display_name:
        impersonated = _sender_mismatch(sender_display_name, sender_email)
        signals["sender_display_mismatch"] = bool(impersonated)
        if impersonated:
            flags.append(
                f"Sender display name claims to be '{impersonated.title()}' but the "
                f"actual address is '{sender_email}' — a hallmark of phishing."
            )
            category = "impersonation"
    else:
        signals["sender_display_mismatch"] = False

    # --- reply-to hijacking ---
    if reply_to_email and sender_email:
        reply_domain = reply_to_email.split("@")[-1].lower() if "@" in reply_to_email else ""
        from_domain = sender_email.split("@")[-1].lower() if "@" in sender_email else ""
        mismatch = bool(reply_domain and from_domain and reply_domain != from_domain)
        signals["reply_to_mismatch"] = mismatch
        if mismatch:
            flags.append(
                f"Reply-to address '{reply_to_email}' belongs to a different domain than "
                "the sender — replies go to an attacker-controlled inbox."
            )
            if category == "unknown":
                category = "impersonation"
    else:
        signals["reply_to_mismatch"] = False

    # --- urgent subject line ---
    if subject:
        urgent = bool(_URGENT_SUBJECT_RE.search(subject))
        signals["urgent_subject"] = urgent
        if urgent:
            flags.append("Subject line uses urgency language to prompt immediate action.")
    else:
        signals["urgent_subject"] = False

    # --- links in body ---
    if body_text:
        extracted_urls = _URL_RE.findall(body_text)
        signals["link_count"] = len(extracted_urls)
        if extracted_urls:
            flags.append(f"Email body contains {len(extracted_urls)} link(s) — verify each before clicking.")

    signals["sender_email"] = sender_email or ""
    signals["sender_display_name"] = sender_display_name or ""
    signals["reply_to_email"] = reply_to_email or ""
    signals["subject"] = subject or ""

    return {
        "artifact_type": "email",
        "signals": signals,
        "flags": flags,
        "category": category,
        "extracted_urls": extracted_urls,
        "body_preview": (body_text or "")[:500],
    }
