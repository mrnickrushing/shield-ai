"""Scan orchestration — ties enrichment, OCR, AI, and scoring together.

Synchronous path is used for fast scans; the same functions are called by the
Celery worker for heavier async jobs.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import (
    ImageScan,
    LinkScan,
    RiskReport,
    ScanHistory,
    ScanStatus,
)
from app.services import ai_analyzer, ocr, risk_engine, url_enrichment


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
    db.commit()
    db.refresh(report)
    return report


def process_link_scan(db: Session, scan: ScanHistory, url: str) -> RiskReport:
    scan.status = ScanStatus.processing
    db.commit()

    evidence = url_enrichment.enrich(url)
    det_score, det_flags = risk_engine.score_url_evidence(evidence)

    llm = ai_analyzer.analyze(f"URL: {evidence['final_url']}", evidence)
    report_data = risk_engine.combine(det_score, det_flags, "unknown", llm)

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
    scan.raw_input = text[:2000]

    # Score the text content.
    text_score, text_flags, category = risk_engine.score_text_evidence(text)

    # If the screenshot contains URLs, enrich the first one too.
    url_evidence: dict = {}
    if ocr_result["extracted_urls"]:
        url_evidence = url_enrichment.enrich(ocr_result["extracted_urls"][0])
        u_score, u_flags = risk_engine.score_url_evidence(url_evidence)
        text_score += u_score
        text_flags += u_flags

    evidence = {
        "ocr": {k: v for k, v in ocr_result.items() if k != "ocr_text"},
        "url": url_evidence,
        "detected_brands": ocr_result["detected_brands"],
    }
    llm = ai_analyzer.analyze(text, {**evidence, "extracted_text": text[:2000]})
    report_data = risk_engine.combine(text_score, text_flags, category, llm)

    db.add(ImageScan(
        scan_id=scan.id,
        storage_key=storage_key,
        ocr_text=text,
        detected_brands=ocr_result["detected_brands"],
        metadata_json={"char_count": ocr_result["char_count"]},
    ))
    return _finalize(db, scan, report_data, evidence)
