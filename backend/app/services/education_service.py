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
    {
        "slug": "bank-impersonation",
        "title": "When Your Bank Calls You",
        "summary": "Learn how bank impersonators create panic and how to verify safely.",
        "content": "## The script\n\nA caller says they are from your bank's fraud department. They may already know your name, partial card number, or recent transaction. The goal is to make you act before you verify.\n\n## Red flags\n\n- They ask for a one-time passcode.\n- They tell you to move money to a safe account.\n- They say not to hang up or not to call the bank.\n- They pressure you to install a remote access app.\n\n## Safe move\n\nHang up. Call the number on the back of your card or in your banking app. Never use a number the caller gives you.",
        "threat_category": "bank_scam",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "A caller from your bank asks for the code texted to your phone. What should you do?", "options": ["Read it if they know your name", "Hang up and call the bank directly", "Ask them to email you", "Give only the first three digits"], "answer_index": 1},
        ],
    },
    {
        "slug": "safe-account-scam",
        "title": "The Safe Account Lie",
        "summary": "Why no real bank or police officer will tell you to transfer money to protect it.",
        "content": "## The lie\n\nScammers claim your money is at risk and must be moved to a safe account. The safe account is controlled by the criminal.\n\n## What makes it convincing\n\nThey may spoof a bank number, transfer you to a fake supervisor, or mention real fraud trends.\n\n## The rule\n\nBanks reverse fraud internally. Police do not ask citizens to move money as part of an investigation.",
        "threat_category": "bank_scam",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "Who controls the safe account in this scam?", "options": ["Your bank", "The police", "The scammer", "A government escrow service"], "answer_index": 2},
        ],
    },
    {
        "slug": "remote-access-warning",
        "title": "Remote Access App Warning Signs",
        "summary": "Spot fake support sessions before someone takes control of your device.",
        "content": "## The setup\n\nA fake support agent asks you to install AnyDesk, TeamViewer, ScreenConnect, or another remote tool. Once connected, they can see your screen and guide you into payments or account changes.\n\n## Stop signs\n\n- You did not initiate support.\n- They ask you to log into banking while connected.\n- They tell you to ignore security warnings.\n- They ask you to hide the session from family or bank staff.\n\n## What to do\n\nDisconnect, uninstall the remote app, change passwords from a different device, and call your bank if any financial account was opened.",
        "threat_category": "tech_support",
        "difficulty": "beginner",
        "estimated_minutes": 4,
        "quiz_questions": [
            {"question": "A support caller asks you to open your bank account while screen sharing. What is the safest response?", "options": ["Continue if they sound professional", "Disconnect immediately", "Only show the balance", "Use a private browser window"], "answer_index": 1},
        ],
    },
    {
        "slug": "crypto-investment-scams",
        "title": "Fake Crypto Investment Platforms",
        "summary": "Recognize pig-butchering and fake trading dashboards before deposits grow.",
        "content": "## How it starts\n\nA friendly stranger, dating match, or social contact introduces a trading platform. Early profits appear on a dashboard, but withdrawals require fees, taxes, or more deposits.\n\n## Red flags\n\n- Guaranteed returns.\n- A mentor tells you exactly when to trade.\n- You must use a specific unknown app or site.\n- Withdrawal requires a fee paid outside the platform.\n\n## The truth\n\nThe dashboard is often fake. The money usually goes straight to the criminal's wallet.",
        "threat_category": "investment_scam",
        "difficulty": "intermediate",
        "estimated_minutes": 5,
        "quiz_questions": [
            {"question": "A platform says you must pay taxes before withdrawing profits. What does that indicate?", "options": ["Normal brokerage policy", "A strong scam signal", "A bank requirement", "A way to increase returns"], "answer_index": 1},
        ],
    },
    {
        "slug": "job-check-scam",
        "title": "Fake Job Check Scams",
        "summary": "Identify job offers that use fake checks, equipment purchases, and reshipping tasks.",
        "content": "## The setup\n\nA remote job offer arrives quickly. The company sends a check for equipment or asks you to buy supplies from a specific vendor. Later, the check bounces and you owe the bank.\n\n## Red flags\n\n- Interview only by chat.\n- Pay is unusually high for simple tasks.\n- They send money before real onboarding.\n- You are asked to send money, crypto, gift cards, or packages onward.\n\n## Safer path\n\nVerify the company domain, call a public company number, and never spend funds from a new check until it fully clears.",
        "threat_category": "job_scam",
        "difficulty": "beginner",
        "estimated_minutes": 4,
        "quiz_questions": [
            {"question": "Why is a fake job check dangerous even after your bank shows funds available?", "options": ["The check can still bounce later", "The employer can reverse direct deposit", "Taxes are due instantly", "The check lowers your credit score"], "answer_index": 0},
        ],
    },
    {
        "slug": "marketplace-safety",
        "title": "Marketplace Buyer and Seller Safety",
        "summary": "Avoid overpayment, shipping-label, and off-platform payment scams.",
        "content": "## Common marketplace scams\n\nA buyer overpays and asks for a refund. A seller pushes payment outside the platform. A fake email says funds are held until you provide tracking.\n\n## Safer habits\n\n- Keep payment and messages inside the platform.\n- Do not refund overpayments from a different payment method.\n- Meet in public exchange zones when local.\n- Be suspicious of urgent shipping requests from new accounts.",
        "threat_category": "marketplace_scam",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "A buyer sends too much money and asks you to refund the difference by Zelle. What should you do?", "options": ["Refund immediately", "Cancel/report the transaction", "Ship faster", "Ask for their bank login"], "answer_index": 1},
        ],
    },
    {
        "slug": "qr-code-traps",
        "title": "QR Code Traps",
        "summary": "Learn when a QR code should be scanned and when it should be treated like a hidden link.",
        "content": "## Why QR codes are risky\n\nA QR code hides the destination until after scanning. Criminals place stickers over parking meters, menus, package notices, and payment signs.\n\n## Quick checks\n\n- Inspect for stickers or tampering.\n- Preview the URL before opening.\n- Avoid QR codes that lead to payment or login pages from public signs.\n- Use the official app or website when possible.",
        "threat_category": "url_scam",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "A QR code on a parking meter opens a payment page with a strange domain. What should you do?", "options": ["Pay quickly", "Use the city's official app/site instead", "Enter card details but no email", "Scan it twice"], "answer_index": 1},
        ],
    },
    {
        "slug": "package-delivery-texts",
        "title": "Fake Package Delivery Texts",
        "summary": "Spot missed-delivery texts that steal card numbers and account logins.",
        "content": "## The message\n\nA text says USPS, UPS, FedEx, or DHL needs a small redelivery fee or address confirmation. The link leads to a fake payment page.\n\n## Red flags\n\n- Shortened or unrelated domain.\n- Tiny fee to unlock a package.\n- Requests full card details for a redelivery.\n- Urgent deadline.\n\n## Safer path\n\nOpen the shipper's official app or website and enter the tracking number yourself.",
        "threat_category": "smishing",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "A delivery text asks for a 30 cent fee through a shortened link. What is the safest move?", "options": ["Pay because the fee is small", "Use the official shipper site/app", "Reply STOP", "Forward your card number by text"], "answer_index": 1},
        ],
    },
    {
        "slug": "ai-voice-clone-family",
        "title": "AI Voice Clone Family Emergencies",
        "summary": "Use a family verification plan before reacting to urgent calls.",
        "content": "## The new version\n\nScammers can imitate a loved one's voice using short clips from social media. The call may claim there was an accident, arrest, kidnapping, or medical emergency.\n\n## Family safety plan\n\n- Pick a private family code word.\n- Call the person back on a known number.\n- Verify with another family member.\n- Do not send money while the caller keeps you on the phone.",
        "threat_category": "family_scam",
        "difficulty": "intermediate",
        "estimated_minutes": 4,
        "quiz_questions": [
            {"question": "What is the best first step during a scary emergency call asking for money?", "options": ["Stay on the line", "Send a small test payment", "Verify through a known number or code word", "Post about it online"], "answer_index": 2},
        ],
    },
    {
        "slug": "recovery-first-hour",
        "title": "The First Hour After Sending Money",
        "summary": "What to do immediately after a scam payment to improve recovery odds.",
        "content": "## Move fast\n\nRecovery odds are best before money settles. The first hour matters.\n\n## First steps\n\n1. Contact your bank, card issuer, payment app, or crypto exchange.\n2. Say you were scammed and request fraud recall, dispute, or freeze.\n3. Preserve messages, receipts, wallet addresses, phone numbers, and emails.\n4. File reports with FTC, IC3, local police, or platform support depending on the scam.\n\n## Avoid recovery scams\n\nAnyone promising guaranteed recovery for an upfront fee is likely another scammer.",
        "threat_category": "recovery",
        "difficulty": "beginner",
        "estimated_minutes": 4,
        "quiz_questions": [
            {"question": "Who should you contact first after a bank or payment-app scam?", "options": ["A recovery agent from social media", "Your bank/payment provider", "The scammer", "A random crypto tracing site"], "answer_index": 1},
        ],
    },
    {
        "slug": "data-broker-exposure",
        "title": "Reducing Data Broker Exposure",
        "summary": "Understand why scammers know personal details and how opt-outs help.",
        "content": "## Why scammers know so much\n\nData brokers collect names, addresses, relatives, phone numbers, and other public or commercial records. Scammers use this detail to sound credible.\n\n## What helps\n\n- Search major broker sites for your listing.\n- Submit opt-out requests.\n- Use unique email aliases where possible.\n- Be cautious when a caller uses personal details as proof.\n\n## Important rule\n\nKnowing your address or relatives does not prove a caller is legitimate.",
        "threat_category": "identity_protection",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "A caller knows your old address. What does that prove?", "options": ["They are legitimate", "They may have public/broker data", "They work for your bank", "They are police"], "answer_index": 1},
        ],
    },
    {
        "slug": "password-reset-traps",
        "title": "Password Reset Traps",
        "summary": "Stop attackers from using you to approve your own account takeover.",
        "content": "## The trick\n\nAn attacker starts a password reset, then calls or texts pretending to be support. They ask for the reset code sent to you.\n\n## Defense\n\nNever share a reset code. Support teams do not need your one-time code. If you receive a code you did not request, change your password directly from the official site and review account sessions.",
        "threat_category": "account_security",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "What should you do with a password reset code you did not request?", "options": ["Read it to support", "Ignore or secure the account directly", "Post it in chat", "Use it on the caller's link"], "answer_index": 1},
        ],
    },
    {
        "slug": "invoice-and-business-email",
        "title": "Invoice and Business Email Compromise",
        "summary": "Verify payment changes before wiring money or paying invoices.",
        "content": "## The setup\n\nA real vendor or executive email thread is copied or spoofed. The attacker changes payment instructions, bank routing details, or invoice timing.\n\n## Safer process\n\n- Confirm payment changes by phone using a known number.\n- Require two-person approval for new bank details.\n- Compare domains carefully.\n- Treat urgency and secrecy as warning signs.",
        "threat_category": "business_email_compromise",
        "difficulty": "intermediate",
        "estimated_minutes": 5,
        "quiz_questions": [
            {"question": "How should you verify new wire instructions?", "options": ["Reply to the email", "Call a known trusted number", "Trust the PDF", "Ask the sender for their password"], "answer_index": 1},
        ],
    },
    {
        "slug": "social-media-impersonation",
        "title": "Social Media Impersonation",
        "summary": "Recognize cloned profiles, fake giveaways, and friend-in-trouble messages.",
        "content": "## Common signs\n\nA duplicate account uses a friend's photo, sends a new friend request, then asks for money, codes, votes, or giveaway fees.\n\n## Verification\n\nCheck account history, mutuals, spelling, and recent posts. Contact the person through a different known channel before acting.",
        "threat_category": "impersonation",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "A new profile from a friend asks for a verification code. What should you do?", "options": ["Send the code", "Verify through another channel", "Ask for a selfie only", "Block your real friend"], "answer_index": 1},
        ],
    },
    {
        "slug": "charity-disaster-scams",
        "title": "Charity and Disaster Scams",
        "summary": "Give safely during emergencies without funding impersonators.",
        "content": "## Why it happens\n\nAfter disasters or viral stories, fake charities appear quickly. They use emotional pressure and urgent donation links.\n\n## Safer giving\n\n- Search the charity independently.\n- Use established donation pages.\n- Avoid gift cards, crypto, or peer-to-peer payments to strangers.\n- Check charity registration and ratings when possible.",
        "threat_category": "charity_scam",
        "difficulty": "beginner",
        "estimated_minutes": 3,
        "quiz_questions": [
            {"question": "What is safest before donating through a text link?", "options": ["Donate immediately", "Search and use the charity's official site", "Send gift cards", "Share your bank login"], "answer_index": 1},
        ],
    },
]


def seed_lessons(db: Session) -> None:
    now = datetime.now(timezone.utc)
    existing_slugs = {row[0] for row in db.query(EducationLesson.slug).all()}
    for data in DEFAULT_LESSONS:
        if data["slug"] not in existing_slugs:
            db.add(EducationLesson(id=str(uuid.uuid4()), created_at=now, **data))
    db.commit()


def get_lessons_for_user(db: Session, user_id: str | None, threat_category: str | None = None) -> list[dict]:
    q = db.query(EducationLesson)
    if threat_category:
        q = q.filter(EducationLesson.threat_category == threat_category)
    lessons = q.order_by(EducationLesson.estimated_minutes).all()
    progress_map = {}
    if user_id:
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
