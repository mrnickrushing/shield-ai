"""Phase 2 — message risk scoring regression tests.

These lock in two behaviors:
  1. Deterministic message signals (urgency, smishing, impersonation, scam
     patterns) actually move the score so smishing isn't a false negative.
  2. A legitimately-delivered 2FA/OTP code is NOT flagged (false-positive guard).
"""
from app.services import message_analyzer, risk_engine


def _deterministic_score(text: str, hint: str = "sms") -> tuple[int, str]:
    mev = message_analyzer.analyze_message(text, hint)
    text_score, _, _ = risk_engine.score_text_evidence(text)
    sig_score, _ = risk_engine.score_message_signals(mev["signals"])
    combined = min(text_score + sig_score, 100)
    return combined, risk_engine.level_for_score(combined).value


def test_smishing_bank_escalates():
    score, level = _deterministic_score(
        "URGENT: Your bank account is locked. Verify now at "
        "http://secure-bank-login.tk or lose access in 24h"
    )
    assert score >= 60
    assert level in ("high", "critical")


def test_irs_impersonation_is_critical():
    score, level = _deterministic_score(
        "IRS final notice: your social security number has been suspended. "
        "Call immediately to avoid arrest."
    )
    assert score >= 80
    assert level == "critical"


def test_delivery_scam_is_at_least_suspicious():
    score, level = _deterministic_score(
        "USPS: your parcel is on hold pending a small customs fee. "
        "Confirm address: http://usps-redeliver.xyz"
    )
    assert level in ("suspicious", "high", "critical")


def test_legit_2fa_code_not_flagged():
    score, level = _deterministic_score(
        "Your verification code is 558213. It expires in 10 minutes."
    )
    assert score < 35
    assert level in ("safe", "low")


def test_benign_message_is_safe():
    score, level = _deterministic_score(
        "Hey, are we still on for lunch tomorrow at noon?"
    )
    assert score == 0
    assert level == "safe"


def test_benign_appointment_reminder_is_safe():
    score, level = _deterministic_score(
        "Reminder: your dentist appointment is tomorrow at 3pm. Reply C to confirm."
    )
    assert level in ("safe", "low")


def test_toll_scam_smishing_is_at_least_suspicious():
    score, level = _deterministic_score(
        "E-ZPass: You have an unpaid toll balance. Pay the fee now to avoid "
        "additional fines: http://ezpass-toll-pay.top"
    )
    assert level in ("suspicious", "high", "critical")


def test_tech_support_scam_escalates():
    score, level = _deterministic_score(
        "SECURITY ALERT: Your computer is infected with a virus. Call Microsoft "
        "support immediately and allow remote access via TeamViewer to fix it."
    )
    assert score >= 60
    assert level in ("high", "critical")


def test_family_emergency_scam_escalates():
    score, level = _deterministic_score(
        "Mom this is my new number, I lost my old phone. I'm in jail and need "
        "bail money right away, please don't tell dad."
    )
    assert level in ("suspicious", "high", "critical")


def test_bec_ceo_fraud_escalates():
    score, level = _deterministic_score(
        "Are you available right now? I need a favor, keep this between us. "
        "Need you to buy gift cards urgent, I'll explain later.",
        hint="email",
    )
    assert level in ("suspicious", "high", "critical")


def test_bank_alert_smishing_is_at_least_suspicious():
    score, level = _deterministic_score(
        "Did you authorize a charge of $843.00 at Best Buy? Reply YES to "
        "confirm or NO to cancel and lock your card."
    )
    assert level in ("suspicious", "high", "critical")
