"""Scam recovery wizard steps and incident summary generator."""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.models import Incident, IncidentEvidence

WIZARD_STEPS: dict[str, list[dict]] = {
    "bank_transfer": [
        {"id": "contact_bank", "title": "Contact Your Bank Immediately", "body": "Call the fraud number on the back of your card or visit a branch. Report an unauthorised transfer and ask them to issue a recall or freeze the destination account.", "urgency": "critical", "contacts": [{"label": "US Wire Fraud (FDIC)", "value": "1-877-275-3342"}]},
        {"id": "file_ic3", "title": "File a Report with the FBI IC3", "body": "Go to ic3.gov and submit an Internet Crime Complaint. Include all transaction details, dates, and any communications from the scammer.", "urgency": "high", "contacts": [{"label": "IC3", "value": "https://ic3.gov"}]},
        {"id": "report_ftc", "title": "Report to the FTC", "body": "File at ReportFraud.ftc.gov. The FTC shares reports with law enforcement nationwide.", "urgency": "high", "contacts": [{"label": "FTC Report Fraud", "value": "https://reportfraud.ftc.gov"}]},
        {"id": "preserve_evidence", "title": "Preserve All Evidence", "body": "Screenshot every communication, save all emails, and record transaction IDs, dates, and amounts. Do not delete anything.", "urgency": "medium"},
        {"id": "local_police", "title": "File a Local Police Report", "body": "Go to your local police station and file a report. Get the case number — banks and credit agencies may require it.", "urgency": "medium"},
    ],
    "gift_card": [
        {"id": "contact_issuer", "title": "Contact the Gift Card Issuer", "body": "Call the number on the back of the card immediately. Report fraud and request a balance hold or refund.", "urgency": "critical"},
        {"id": "report_ftc", "title": "Report to the FTC", "body": "File at ReportFraud.ftc.gov. Select Gift Card Scam.", "urgency": "high", "contacts": [{"label": "FTC Report Fraud", "value": "https://reportfraud.ftc.gov"}]},
        {"id": "preserve_cards", "title": "Keep All Cards and Receipts", "body": "Do not throw away physical cards or receipts. Note the card number and PIN.", "urgency": "high"},
        {"id": "report_ic3", "title": "File with IC3", "body": "Go to ic3.gov and submit an Internet Crime Complaint with all gift card details.", "urgency": "medium", "contacts": [{"label": "IC3", "value": "https://ic3.gov"}]},
    ],
    "crypto": [
        {"id": "stop_sending", "title": "Stop All Transfers Immediately", "body": "Do not send any more cryptocurrency. Scammers claim more payment is needed to release funds — this is always false.", "urgency": "critical"},
        {"id": "report_ic3", "title": "File with the FBI IC3", "body": "Go to ic3.gov. Include all wallet addresses, transaction hashes, and platform URLs.", "urgency": "high", "contacts": [{"label": "IC3", "value": "https://ic3.gov"}]},
        {"id": "report_cftc", "title": "Report to the CFTC", "body": "File at cftc.gov/complaint. The CFTC pursues cryptocurrency investment fraud cases.", "urgency": "high", "contacts": [{"label": "CFTC", "value": "https://www.cftc.gov/complaint"}]},
        {"id": "preserve_wallet", "title": "Preserve Wallet and Transaction Records", "body": "Export transaction history from your exchange and screenshot all communications.", "urgency": "medium"},
        {"id": "contact_exchange", "title": "Alert Your Exchange", "body": "Report the scam to the exchange fraud team. They may flag the destination wallet.", "urgency": "medium"},
    ],
    "marketplace": [
        {"id": "report_platform", "title": "Report on the Platform", "body": "Use the marketplace's Report button with all order details and evidence.", "urgency": "critical"},
        {"id": "chargeback", "title": "Dispute the Charge", "body": "Contact your card issuer or PayPal to initiate a dispute. You typically have 60–120 days.", "urgency": "high"},
        {"id": "preserve_evidence", "title": "Preserve Listings and Messages", "body": "Screenshot the listing, all messages, and payment confirmation before they are removed.", "urgency": "high"},
        {"id": "report_ftc", "title": "Report to the FTC", "body": "File at ReportFraud.ftc.gov under Online Shopping.", "urgency": "medium", "contacts": [{"label": "FTC Report Fraud", "value": "https://reportfraud.ftc.gov"}]},
    ],
    "account_takeover": [
        {"id": "change_passwords", "title": "Change All Passwords Immediately", "body": "Start with your email — it controls password resets for everything else.", "urgency": "critical"},
        {"id": "enable_2fa", "title": "Enable Two-Factor Authentication", "body": "Turn on 2FA for email, bank, and social accounts. Use an authenticator app rather than SMS.", "urgency": "critical"},
        {"id": "revoke_sessions", "title": "Sign Out All Devices", "body": "Use your account's security page to sign out all other sessions and remove unknown authorized apps.", "urgency": "high"},
        {"id": "alert_contacts", "title": "Warn Your Contacts", "body": "If the attacker sent messages from your account, let your contacts know.", "urgency": "high"},
        {"id": "credit_freeze", "title": "Consider a Credit Freeze", "body": "Place a credit freeze with Equifax, Experian, and TransUnion. It is free.", "urgency": "medium"},
    ],
    "romance": [
        {"id": "stop_contact", "title": "Stop All Contact and Money Transfers", "body": "Do not send any more money, gift cards, or cryptocurrency. Cut off all contact.", "urgency": "critical"},
        {"id": "report_ftc", "title": "Report to the FTC", "body": "File at ReportFraud.ftc.gov under Romance Scam.", "urgency": "high", "contacts": [{"label": "FTC Report Fraud", "value": "https://reportfraud.ftc.gov"}]},
        {"id": "report_ic3", "title": "File with the FBI IC3", "body": "Submit to ic3.gov with all communications, profile links, and payment records.", "urgency": "high"},
        {"id": "talk_someone", "title": "Reach Out to Someone You Trust", "body": "Romance scams are emotionally devastating. Consider talking to a trusted friend or counsellor.", "urgency": "medium"},
    ],
    "investment": [
        {"id": "stop_investing", "title": "Stop All Investment Activity", "body": "Do not invest more funds. More investment will never recover your losses.", "urgency": "critical"},
        {"id": "report_sec", "title": "Report to the SEC", "body": "File at sec.gov/tcr for fake trading platforms and Ponzi schemes.", "urgency": "high", "contacts": [{"label": "SEC Tips", "value": "https://www.sec.gov/tcr"}]},
        {"id": "report_cftc", "title": "Report to the CFTC", "body": "File at cftc.gov/complaint for forex, commodity, or crypto investment scams.", "urgency": "high"},
        {"id": "report_ic3", "title": "File with IC3", "body": "Submit to ic3.gov with all platform URLs, screenshots, and transaction records.", "urgency": "high"},
    ],
    "other": [
        {"id": "report_ftc", "title": "Report to the FTC", "body": "File at ReportFraud.ftc.gov. Select the category that best fits.", "urgency": "high", "contacts": [{"label": "FTC Report Fraud", "value": "https://reportfraud.ftc.gov"}]},
        {"id": "preserve_evidence", "title": "Preserve All Evidence", "body": "Screenshot everything before it can be deleted.", "urgency": "high"},
        {"id": "report_ic3", "title": "File with IC3", "body": "Go to ic3.gov and submit an Internet Crime Complaint.", "urgency": "medium"},
    ],
}


def get_wizard_steps(incident_type: str) -> list[dict]:
    return WIZARD_STEPS.get(incident_type, WIZARD_STEPS["other"])


def generate_incident_summary(incident: Incident, evidence_items: list[IncidentEvidence]) -> str:
    lines = [
        "SCAM INCIDENT REPORT",
        "=" * 40,
        f"Date generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"Incident ID:    {incident.id}",
        f"Type:           {str(incident.incident_type).replace('_', ' ').title()}",
        f"Status:         {str(incident.status).replace('_', ' ').title()}",
        "",
    ]
    if incident.title:
        lines.append(f"Title: {incident.title}")
    if incident.amount_lost is not None:
        lines.append(f"Amount lost: {incident.currency} {incident.amount_lost:,.2f}")
    if incident.notes:
        lines += ["", "Notes:", incident.notes]

    steps = get_wizard_steps(str(incident.incident_type))
    completed_ids = set(incident.steps_completed or [])
    lines += ["", "STEPS COMPLETED", "-" * 20]
    for step in steps:
        mark = "✓" if step["id"] in completed_ids else "○"
        lines.append(f"  {mark} {step['title']}")

    if evidence_items:
        lines += ["", "EVIDENCE COLLECTED", "-" * 20]
        for ev in evidence_items:
            lines.append(f"  [{ev.evidence_type.upper()}] {ev.label or 'Untitled'}")
            if ev.content:
                snippet = ev.content[:200] + ("..." if len(ev.content) > 200 else "")
                lines.append(f"    {snippet}")
            lines.append(f"    Collected: {ev.created_at.strftime('%Y-%m-%d %H:%M UTC')}")

    lines += [
        "",
        "=" * 40,
        "Report generated by Shield AI — shieldai.rushingtechnologies.com",
        "Provide this document to your bank, law enforcement, or platform support.",
    ]
    return "\n".join(lines)
