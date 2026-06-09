"""Education center — seed lessons and query helpers."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import EducationLesson, EducationProgress

DEFAULT_LESSONS = [
    {
        "slug": "phishing-basics",
        "title": "How Phishing Emails Work",
        "summary": "Learn the 5 red flags that almost every phishing email shares.",
        "content": "## What is phishing?\n\nPhishing is when a scammer impersonates a trusted organisation to steal your credentials or money.\n\n## 5 red flags\n\n1. **Urgency** — Your account will be suspended in 24 hours. Legitimate companies give you time.\n2. **Sender mismatch** — Display name says PayPal but address is support@paypa1-secure.net.\n3. **Generic greeting** — Dear Customer instead of your actual name.\n4. **Suspicious links** — Hover over links before clicking. The real URL is often completely different.\n5. **Requests for credentials** — No legitimate company asks for your password by email.\n\n## What to do\n\n- Do not click links in suspicious emails.\n- Go directly to the company website by typing it yourself.\n- Report phishing to reportphishing@apwg.org.",
        "threat_category": "phishing",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "You receive an email from 'Amazon Support' at noreply@amaz0n-help.com. What is the biggest red flag?", "options": ["The email mentions your order number", "The sender's domain doesn't match amazon.com", "The email has Amazon's logo", "The email arrived at night"], "answer_index": 1},
            {"question": "What should you do before clicking a link in an email?", "options": ["Reply to the sender asking if it is safe", "Click it quickly so malware cannot load", "Hover over the link to see the real URL", "Forward it to a friend first"], "answer_index": 2},
        ],
    },
    {
        "slug": "gift-card-scams",
        "title": "Why Scammers Demand Gift Cards",
        "summary": "Understand why gift cards are a scammer's payment of choice — and how to say no.",
        "content": "## Why gift cards?\n\nGift cards are nearly irreversible once redeemed, anonymous, and the victim does the work.\n\n## Common setups\n\n- **Fake tech support** — Pay Microsoft with iTunes cards.\n- **IRS impersonation** — Threatens arrest unless you pay with Google Play cards.\n- **Grandparent scam** — Someone pretending to be a grandchild needing bail money.\n- **Prize scam** — You won a prize but must pay a processing fee in gift cards first.\n\n## The rule\n\nNo government agency, utility company, bank, or legitimate business will ever ask you to pay with gift cards. Ever. If someone insists, hang up.",
        "threat_category": "gift_card_scam",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "Someone calls claiming to be the IRS and says you owe back taxes payable by Google Play cards. What should you do?", "options": ["Buy the cards — the IRS has real authority", "Ask them to call back later", "Hang up — the IRS never requests gift card payment", "Pay half now to negotiate"], "answer_index": 2},
        ],
    },
    {
        "slug": "url-red-flags",
        "title": "Reading a URL Before You Click",
        "summary": "A 30-second checklist to evaluate any link before trusting it.",
        "content": "## The 30-second URL check\n\n### 1. Find the real domain\nThe domain is between https:// and the first single /. In https://paypal.com.attacker.net/... the real domain is attacker.net.\n\n### 2. Check for typosquatting\nCommon tricks: paypa1.com, rn instead of m (rnicrosoft.com), 0 instead of o.\n\n### 3. Check the TLD\nLegitimate companies rarely use .xyz, .top, .click, or .zip for login pages.\n\n### 4. URL shorteners\nbit.ly and tinyurl.com hide the real destination. Use a URL expander first.\n\n### 5. HTTP vs HTTPS\nHTTP on a login page is always wrong.",
        "threat_category": "url_scam",
        "difficulty": "beginner",
        "estimated_minutes": 4,
        "quiz_questions": [
            {"question": "What is the real domain in: https://paypal.com.secure-login.net/verify", "options": ["paypal.com", "secure-login.net", "paypal.com.secure-login.net", "verify"], "answer_index": 1},
        ],
    },
    {
        "slug": "romance-scam-patterns",
        "title": "Recognising Romance Scams",
        "summary": "Warning signs that someone building a relationship online may be a scammer.",
        "content": "## What is a romance scam?\n\nA criminal builds a fake romantic relationship online to eventually ask for money.\n\n## Warning signs\n\n1. **They look too good** — Stock-photo-perfect profile. Do a reverse image search.\n2. **They escalate fast** — Professing love within days.\n3. **They can never meet** — Military deployment, overseas contract, family emergency.\n4. **They ask for money** — Always a crisis requiring urgent funds.\n5. **Unusual payment methods** — Wire transfers, crypto, gift cards.\n\n## How to verify\n\n- Reverse image search their profile photos.\n- Video call them unscripted.\n- Ask specific, verifiable questions about their location.",
        "threat_category": "romance_scam",
        "difficulty": "beginner",
        "estimated_minutes": 5,
        "quiz_questions": [
            {"question": "Someone you met online says they are in the military overseas and asks you to wire money for a medical emergency. What should you do?", "options": ["Wire the money", "Send a smaller amount first", "Stop contact and report to the FTC — this is a classic romance scam script", "Ask them to FaceTime first"], "answer_index": 2},
        ],
    },
    {
        "slug": "account-security",
        "title": "Securing Your Accounts",
        "summary": "The three things that prevent most account takeovers.",
        "content": "## The three pillars\n\n### 1. Strong, unique passwords\nUse a password manager. Never reuse passwords across sites.\n\n### 2. Two-factor authentication (2FA)\nEnable 2FA on every account. Authenticator apps are more secure than SMS. SMS 2FA can be bypassed by SIM swap attacks.\n\n### 3. Secure recovery options\nKeep your recovery email and phone number up to date. Store backup codes safely.\n\n## Quick wins today\n\n1. Change any reused password on your email account.\n2. Enable 2FA on your email and bank.\n3. Check haveibeenpwned.com for your email in data breaches.",
        "threat_category": "account_security",
        "difficulty": "beginner",
        "estimated_minutes": 4,
        "quiz_questions": [
            {"question": "Which 2FA method is most resistant to SIM swap attacks?", "options": ["SMS text message code", "Authenticator app (TOTP)", "Security question", "Email verification code"], "answer_index": 1},
        ],
    },
]


def seed_lessons(db: Session) -> None:
    if db.query(EducationLesson).count() > 0:
        return
    now = datetime.now(timezone.utc)
    for data in DEFAULT_LESSONS:
        db.add(EducationLesson(id=str(uuid.uuid4()), created_at=now, **data))
    db.commit()


def get_lessons_for_user(db: Session, user_id: str, threat_category: str | None = None) -> list[dict]:
    q = db.query(EducationLesson)
    if threat_category:
        q = q.filter(EducationLesson.threat_category == threat_category)
    lessons = q.order_by(EducationLesson.estimated_minutes).all()
    progress_map = {p.lesson_id: p for p in db.query(EducationProgress).filter(EducationProgress.user_id == user_id).all()}
    result = []
    for lesson in lessons:
        prog = progress_map.get(lesson.id)
        result.append({
            "id": lesson.id, "slug": lesson.slug, "title": lesson.title,
            "summary": lesson.summary, "threat_category": lesson.threat_category,
            "difficulty": lesson.difficulty, "estimated_minutes": lesson.estimated_minutes,
            "completed": prog.completed if prog else False,
            "quiz_score": prog.quiz_score if prog else None,
        })
    return result
