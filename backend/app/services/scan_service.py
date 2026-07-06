"""Scan orchestration — ties enrichment, OCR, AI, and scoring together.

Synchronous path is used for fast scans; the same functions are called by the
Celery worker for heavier async jobs.
"""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.models import (
    Device,
    EmailScan,
    ImageScan,
    LinkScan,
    MarketplaceScan,
    MessageScan,
    Notification,
    NotificationPreference,
    PhoneScan,
    QRScan,
    RiskReport,
    ScanHistory,
    ScanStatus,
    SocialScan,
)
from app.services import (
    ai_analyzer,
    email_analyzer,
    marketplace_analyzer,
    message_analyzer,
    ocr,
    phone_lookup,
    risk_engine,
    social_analyzer,
    threat_intel,
    url_enrichment,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SEVERITY_RANK = {"safe": 0, "low": 1, "suspicious": 2, "high": 3, "critical": 4}

def _finalize(db: Session, scan: ScanHistory, report_data: dict, evidence: dict) -> RiskReport:
    report = RiskReport(
        scan_id=scan.id,
        risk_score=report_data["risk_score"],
        risk_level=report_data["risk_level"],
        threat_category=report_data["threat_category"],
        confidence=report_data["confidence"],
        explanation=report_data["explanation"],
        red_flags=report_data["red_flags"],
        recommended_actions=report_data["recommended_actions"],
        evidence=evidence,
    )
    db.add(report)
    scan.status = ScanStatus.completed
    scan.completed_at = datetime.now(timezone.utc)

    # Create in-app notification record
    notif = Notification(
        user_id=scan.user_id,
        title=f"Scan complete — {report_data['risk_level'].title()} risk",
        body=report_data["explanation"][:160],
        scan_id=scan.id,
    )
    db.add(notif)
    db.commit()
    db.refresh(report)

    # Best-effort push to registered devices — never let this fail the scan
    try:
        _push_to_devices(db, scan.user_id, notif.title, notif.body, scan.id)
    except Exception:
        pass

    return report


def _push_to_devices(db: Session, user_id: str, title: str, body: str, scan_id: str) -> None:
    """Send Expo push notifications to all registered devices for the user."""
    from app.core.config import settings

    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if pref and not pref.push_enabled:
        return
    scan = db.get(ScanHistory, scan_id)
    risk_level = str(scan.report.risk_level.value if scan and scan.report and hasattr(scan.report.risk_level, "value") else scan.report.risk_level if scan and scan.report else "")
    minimum = pref.minimum_severity if pref else "all"
    if minimum != "all" and SEVERITY_RANK.get(risk_level, 0) < SEVERITY_RANK.get(minimum, 0):
        return

    tokens = [
        d.push_token
        for d in db.query(Device).filter(Device.user_id == user_id, Device.revoked_at.is_(None)).all()
        if d.push_token
    ]
    if not tokens:
        return

    try:
        import httpx

        messages = [
            {"to": t, "title": title, "body": body, "data": {"scan_id": scan_id}, "sound": "default"}
            for t in tokens
        ]
        headers = {"Content-Type": "application/json"}
        if settings.EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"

        httpx.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers=headers,
            timeout=5.0,
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Phase 1 scan processors
# ---------------------------------------------------------------------------

def process_link_scan(db: Session, scan: ScanHistory, url: str) -> RiskReport:
    scan.status = ScanStatus.processing
    db.commit()

    evidence = url_enrichment.enrich(url)
    det_score, det_flags = risk_engine.score_url_evidence(evidence)

    ti_boost, ti_flags = threat_intel.check_patterns(db, url, "link")
    det_score = min(det_score + ti_boost, 100)
    det_flags = list(dict.fromkeys(det_flags + ti_flags))

    llm = ai_analyzer.analyze(f"URL: {evidence['final_url']}", evidence, artifact_type="link")
    report_data = risk_engine.combine(det_score, det_flags, "unknown", llm, artifact_type="link")

    db.add(LinkScan(
        scan_id=scan.id,
        original_url=url,
        final_url=evidence.get("final_url", ""),
        domain=evidence.get("domain", ""),
        domain_age_days=evidence.get("domain_age_days"),
        redirect_count=evidence.get("redirect_count", 0),
        safe_browsing_hit=evidence.get("safe_browsing_hit", False),
        enrichment=evidence,
    ))
    return _finalize(db, scan, report_data, evidence)


def process_image_scan(db: Session, scan: ScanHistory, image_bytes: bytes, storage_key: str = "") -> RiskReport:
    scan.status = ScanStatus.processing
    db.commit()

    ocr_result = ocr.analyze_screenshot(image_bytes)
    text = ocr_result["ocr_text"]
    ocr_failed = not ocr_result.get("ocr_available", True)
    scan.raw_input = text[:2000]

    text_score, text_flags, category = risk_engine.score_text_evidence(text)

    # Brand impersonation: brand name + account-action language → deterministic signal
    brand_score, brand_flags = risk_engine.score_brand_impersonation(
        text, ocr_result["detected_brands"]
    )
    text_score = min(text_score + brand_score, 100)
    text_flags = list(dict.fromkeys(text_flags + brand_flags))
    if brand_score > 0 and category == "unknown":
        category = "impersonation"

    ti_boost, ti_flags = threat_intel.check_patterns(db, text, "image")
    text_score = min(text_score + ti_boost, 100)
    text_flags = list(dict.fromkeys(text_flags + ti_flags))

    url_evidence: dict = {}
    if ocr_result["extracted_urls"]:
        url_evidence = url_enrichment.enrich(ocr_result["extracted_urls"][0])
        u_score, u_flags = risk_engine.score_url_evidence(url_evidence)
        text_score = min(text_score + u_score, 100)
        text_flags = list(dict.fromkeys(text_flags + u_flags))

    evidence = {
        "ocr": {k: v for k, v in ocr_result.items() if k != "ocr_text"},
        "url": url_evidence,
        "detected_brands": ocr_result["detected_brands"],
    }

    # Try vision API first (Claude sees the actual screenshot — most accurate).
    # Fall back to text-based analysis if vision is unavailable.
    llm = ai_analyzer.analyze_image_with_vision(image_bytes, evidence)
    if llm is None:
        llm = ai_analyzer.analyze(text, {**evidence, "extracted_text": text[:2000]}, artifact_type="image")

    report_data = risk_engine.combine(
        text_score, text_flags, category, llm,
        artifact_type="image", ocr_failed=ocr_failed,
    )

    db.add(ImageScan(
        scan_id=scan.id,
        storage_key=storage_key,
        ocr_text=text,
        detected_brands=ocr_result["detected_brands"],
        metadata_json={"char_count": ocr_result["char_count"], "ocr_available": not ocr_failed},
    ))
    return _finalize(db, scan, report_data, evidence)


# ---------------------------------------------------------------------------
# Phase 2 scan processors
# ---------------------------------------------------------------------------

def process_qr_scan(db: Session, scan: ScanHistory, qr_content: str) -> RiskReport:
    """Analyze QR code content. Most QR codes encode URLs; run full URL enrichment if so."""
    scan.status = ScanStatus.processing
    scan.raw_input = qr_content[:500]
    db.commit()

    parsed = urlparse(qr_content)
    is_url = parsed.scheme in ("http", "https") or qr_content.lower().startswith("www.")
    qr_type = "url" if is_url else "text"
    evidence: dict

    if is_url:
        evidence = url_enrichment.enrich(qr_content)
        det_score, det_flags = risk_engine.score_url_evidence(evidence)
        # QR codes can obscure destinations; add a small baseline signal
        det_score = min(det_score + 5, 100)
        det_flags.append(
            "Destination was hidden inside a QR code — always preview the URL before opening."
        )
        category = "unknown"
    else:
        text_score, text_flags, category = risk_engine.score_text_evidence(qr_content)
        det_score, det_flags = text_score, text_flags
        evidence = {"qr_content": qr_content, "is_url": False}

    ti_boost, ti_flags = threat_intel.check_patterns(db, qr_content, "qr")
    det_score = min(det_score + ti_boost, 100)
    det_flags = list(dict.fromkeys(det_flags + ti_flags))

    llm = ai_analyzer.analyze(f"QR code content: {qr_content}", evidence, artifact_type="qr")
    report_data = risk_engine.combine(det_score, det_flags, category, llm, artifact_type="qr")

    db.add(QRScan(
        scan_id=scan.id,
        qr_content=qr_content,
        qr_type=qr_type,
        decoded_url=qr_content if is_url else "",
    ))
    return _finalize(db, scan, report_data, evidence)


def process_message_scan(db: Session, scan: ScanHistory, message_text: str, platform_hint: str = "") -> RiskReport:
    """Analyze a pasted SMS, chat message, or marketplace thread."""
    scan.status = ScanStatus.processing
    scan.raw_input = message_text[:2000]
    db.commit()

    msg_ev = message_analyzer.analyze_message(message_text, platform_hint)
    text_score, text_flags, text_category = risk_engine.score_text_evidence(message_text)
    # Weight the message-level scam signals (urgency, smishing, impersonation,
    # delivery/prize/job/romance patterns) so they actually move the score.
    sig_score, sig_flags = risk_engine.score_message_signals(msg_ev["signals"])

    det_flags = list(dict.fromkeys(text_flags + sig_flags + msg_ev["flags"]))
    det_score = min(text_score + sig_score, 100)
    category = msg_ev["category"] if msg_ev["category"] != "unknown" else text_category

    url_evidence: dict = {}
    if msg_ev["extracted_urls"]:
        url_evidence = url_enrichment.enrich(msg_ev["extracted_urls"][0])
        u_score, u_flags = risk_engine.score_url_evidence(url_evidence)
        det_score = min(det_score + u_score, 100)
        det_flags = list(dict.fromkeys(det_flags + u_flags))

    ti_boost, ti_flags = threat_intel.check_patterns(db, message_text, "message")
    det_score = min(det_score + ti_boost, 100)
    det_flags = list(dict.fromkeys(det_flags + ti_flags))

    full_evidence = {**msg_ev, "url": url_evidence}
    llm = ai_analyzer.analyze(message_text[:4000], full_evidence, artifact_type="message")
    report_data = risk_engine.combine(det_score, det_flags, category, llm, artifact_type="message")

    db.add(MessageScan(
        scan_id=scan.id,
        message_text=message_text[:10000],
        platform_hint=platform_hint,
        detected_entities=msg_ev.get("signals", {}),
        extracted_urls=msg_ev.get("extracted_urls", []),
    ))
    return _finalize(db, scan, report_data, full_evidence)


def process_email_scan(
    db: Session,
    scan: ScanHistory,
    raw_email: str | None = None,
    sender_email: str | None = None,
    sender_display_name: str | None = None,
    reply_to_email: str | None = None,
    subject: str | None = None,
    body_text: str | None = None,
) -> RiskReport:
    """Analyze an email for spoofing, reply-to hijacking, and embedded threats."""
    scan.status = ScanStatus.processing
    scan.raw_input = f"From: {sender_email or ''} | Subject: {subject or ''}"[:500]
    db.commit()

    email_ev = email_analyzer.analyze_email(
        raw_email=raw_email,
        sender_email=sender_email,
        sender_display_name=sender_display_name,
        reply_to_email=reply_to_email,
        subject=subject,
        body_text=body_text,
    )

    det_score = 0
    det_flags = list(email_ev["flags"])
    category = email_ev["category"]

    if email_ev["signals"].get("sender_display_mismatch"):
        det_score += 40
    if email_ev["signals"].get("reply_to_mismatch"):
        det_score += 25
    if email_ev["signals"].get("urgent_subject"):
        det_score += 15

    # Score the body text as well
    body = body_text or email_ev.get("body_preview", "")
    if body:
        t_score, t_flags, t_cat = risk_engine.score_text_evidence(body)
        det_score = min(det_score + t_score, 100)
        det_flags = list(dict.fromkeys(det_flags + t_flags))
        if category == "unknown":
            category = t_cat

    url_evidence: dict = {}
    if email_ev.get("extracted_urls"):
        url_evidence = url_enrichment.enrich(email_ev["extracted_urls"][0])
        u_score, u_flags = risk_engine.score_url_evidence(url_evidence)
        det_score = min(det_score + u_score, 100)
        det_flags = list(dict.fromkeys(det_flags + u_flags))

    email_text = f"{subject or ''} {sender_email or ''} {body}"
    ti_boost, ti_flags = threat_intel.check_patterns(db, email_text, "email")
    det_score = min(det_score + ti_boost, 100)
    det_flags = list(dict.fromkeys(det_flags + ti_flags))

    full_evidence = {**email_ev, "url": url_evidence}
    content_for_llm = (
        f"Subject: {subject or ''}\nFrom: {sender_email or ''}\n"
        f"Reply-To: {reply_to_email or ''}\nBody:\n{body[:3000]}"
    )
    llm = ai_analyzer.analyze(content_for_llm, full_evidence, artifact_type="email")
    report_data = risk_engine.combine(det_score, det_flags, category, llm, artifact_type="email")

    # Re-read parsed fields from email_ev signals in case raw_email was parsed
    sig = email_ev.get("signals", {})
    db.add(EmailScan(
        scan_id=scan.id,
        sender_email=sig.get("sender_email", sender_email or ""),
        sender_display_name=sig.get("sender_display_name", sender_display_name or ""),
        reply_to_email=sig.get("reply_to_email", reply_to_email or ""),
        subject=sig.get("subject", subject or ""),
        body_text=(body or "")[:10000],
        extracted_urls=email_ev.get("extracted_urls", []),
        header_flags=sig,
    ))
    return _finalize(db, scan, report_data, full_evidence)


def process_phone_scan(db: Session, scan: ScanHistory, phone_number: str) -> RiskReport:
    """Analyze a phone number for scam/spam reputation."""
    scan.status = ScanStatus.processing
    scan.raw_input = phone_number
    db.commit()

    phone_ev = phone_lookup.analyze_phone(phone_number)
    sig = phone_ev.get("signals", {})

    det_score = 0
    det_flags = list(phone_ev["flags"])
    category = phone_ev["category"]

    if sig.get("known_scam_area_code"):
        det_score += 35
    if sig.get("premium_rate"):
        det_score += 50
    if sig.get("suspicious_pattern"):
        det_score += 15
    if sig.get("is_short_code"):
        det_score += 10
    if int(sig.get("spam_score", 0)) > 70:
        det_score += 45

    ti_boost, ti_flags = threat_intel.check_patterns(db, phone_number, "phone")
    det_score = min(det_score + ti_boost, 100)
    det_flags = list(dict.fromkeys(det_flags + ti_flags))

    llm = ai_analyzer.analyze(f"Phone number: {phone_number}", phone_ev, artifact_type="phone")
    report_data = risk_engine.combine(det_score, det_flags, category, llm, artifact_type="phone")

    db.add(PhoneScan(
        scan_id=scan.id,
        phone_number=phone_number,
        normalized_number=phone_ev.get("normalized_number", ""),
        country_code=sig.get("country_code", ""),
        carrier=sig.get("carrier", ""),
        line_type=sig.get("line_type", ""),
    ))
    return _finalize(db, scan, report_data, phone_ev)


# ---------------------------------------------------------------------------
# Phase 3 scan processors
# ---------------------------------------------------------------------------

def process_marketplace_scan(db: Session, scan: ScanHistory, content_text: str, platform_hint: str = "") -> RiskReport:
    """Analyze marketplace listing/conversation for buyer-seller scam patterns."""
    scan.status = ScanStatus.processing
    scan.raw_input = content_text[:500]
    db.commit()

    mkt_ev = marketplace_analyzer.analyze_marketplace(content_text, platform_hint)
    text_score, text_flags, text_category = risk_engine.score_text_evidence(content_text)

    det_flags = list(dict.fromkeys(mkt_ev["flags"] + text_flags))
    det_score = text_score
    category = mkt_ev["category"] if mkt_ev["category"] != "unknown" else text_category

    # Marketplace-specific score boosts
    sig = mkt_ev["signals"]
    if sig.get("overpayment_scam"):
        det_score = min(det_score + 45, 100)
    if sig.get("payment_bypass"):
        det_score = min(det_score + 35, 100)
    if sig.get("fake_escrow"):
        det_score = min(det_score + 50, 100)
    if sig.get("rental_scam"):
        det_score = min(det_score + 40, 100)
    if sig.get("shipping_scam"):
        det_score = min(det_score + 30, 100)
    if sig.get("ticket_scam"):
        det_score = min(det_score + 35, 100)

    url_evidence: dict = {}
    if mkt_ev["extracted_urls"]:
        url_evidence = url_enrichment.enrich(mkt_ev["extracted_urls"][0])
        u_score, u_flags = risk_engine.score_url_evidence(url_evidence)
        det_score = min(det_score + u_score, 100)
        det_flags = list(dict.fromkeys(det_flags + u_flags))

    ti_boost, ti_flags = threat_intel.check_patterns(db, content_text, "marketplace")
    det_score = min(det_score + ti_boost, 100)
    det_flags = list(dict.fromkeys(det_flags + ti_flags))

    full_evidence = {**mkt_ev, "url": url_evidence}
    llm = ai_analyzer.analyze(
        f"Marketplace listing/message ({mkt_ev['platform']}):\n{content_text[:4000]}",
        full_evidence,
        artifact_type="marketplace",
    )
    report_data = risk_engine.combine(det_score, det_flags, category, llm, artifact_type="marketplace")

    db.add(MarketplaceScan(
        scan_id=scan.id,
        content_text=content_text[:10000],
        platform=mkt_ev["platform"],
        detected_signals=sig,
        extracted_urls=mkt_ev.get("extracted_urls", []),
    ))
    return _finalize(db, scan, report_data, full_evidence)


def process_social_scan(db: Session, scan: ScanHistory, content_text: str, platform: str = "") -> RiskReport:
    """Analyze social media post/DM for giveaway scams, impersonation, and phishing."""
    scan.status = ScanStatus.processing
    scan.raw_input = content_text[:500]
    db.commit()

    soc_ev = social_analyzer.analyze_social(content_text, platform)
    text_score, text_flags, text_category = risk_engine.score_text_evidence(content_text)

    det_flags = list(dict.fromkeys(soc_ev["flags"] + text_flags))
    det_score = text_score
    category = soc_ev["category"] if soc_ev["category"] != "unknown" else text_category

    sig = soc_ev["signals"]
    if sig.get("fake_giveaway"):
        det_score = min(det_score + 35, 100)
    if sig.get("crypto_investment_lure"):
        det_score = min(det_score + 45, 100)
    if sig.get("impersonation"):
        det_score = min(det_score + 40, 100)
    if sig.get("account_takeover_attempt"):
        det_score = min(det_score + 50, 100)
    if sig.get("phishing_dm"):
        det_score = min(det_score + 45, 100)
    if sig.get("pig_butchering"):
        det_score = min(det_score + 50, 100)

    url_evidence: dict = {}
    if soc_ev["extracted_urls"]:
        url_evidence = url_enrichment.enrich(soc_ev["extracted_urls"][0])
        u_score, u_flags = risk_engine.score_url_evidence(url_evidence)
        det_score = min(det_score + u_score, 100)
        det_flags = list(dict.fromkeys(det_flags + u_flags))

    ti_boost, ti_flags = threat_intel.check_patterns(db, content_text, "social")
    det_score = min(det_score + ti_boost, 100)
    det_flags = list(dict.fromkeys(det_flags + ti_flags))

    full_evidence = {**soc_ev, "url": url_evidence}
    llm = ai_analyzer.analyze(
        f"Social media content ({soc_ev['platform']}):\n{content_text[:4000]}",
        full_evidence,
        artifact_type="social",
    )
    report_data = risk_engine.combine(det_score, det_flags, category, llm, artifact_type="social")

    db.add(SocialScan(
        scan_id=scan.id,
        content_text=content_text[:10000],
        platform=soc_ev["platform"],
        detected_signals=sig,
        extracted_urls=soc_ev.get("extracted_urls", []),
    ))
    return _finalize(db, scan, report_data, full_evidence)
