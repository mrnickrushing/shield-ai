# Shield AI

**AI-powered scam, fraud, and identity protection assistant.**

> Before you click. Before you pay. Before you trust. Know if it's real.

---

## Status — Phase 1 in progress

Phase 1 (the core scam-checker MVP) is scaffolded and building:

- ✅ **Backend** (FastAPI): JWT auth, link + screenshot scan endpoints, OCR pipeline, URL enrichment (Safe Browsing, WHOIS/domain age, redirect/typosquat/homograph checks), blended deterministic + LLM risk engine, scan history & feedback, Celery worker, Alembic migrations. Tests passing.
- ✅ **Mobile** (Expo / React Native): login, dashboard, scan (link + screenshot), history, and risk-report screens; typed API client with token refresh; Zustand auth store.
- ✅ **App icon**: `design/icon/shield-ai-logo.svg` + generated Expo icon/splash/adaptive/favicon.
- ✅ **Infra**: Dockerfile, `docker-compose` (Postgres + Redis + API + worker), `railway.json`.
- 🚧 **Deploy**: Railway project provisioned (backend + Postgres + Redis); Cloudflare DNS set for `shieldai.rushingtechnologies.com` and `admin.shieldai.rushingtechnologies.com`. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Quickstart

```bash
# Backend (full stack)
cd infra && docker compose up --build      # API at http://localhost:8000/docs

# Backend (bare)
cd backend && pip install -r requirements.txt && python start.py

# Mobile
cd mobile && npm install && npm start
```

---

## What is Shield AI?

Shield AI is a decision assistant — not a generic antivirus app. You send it anything suspicious (a screenshot, a link, a forwarded text), and it comes back with a risk score, threat class, plain-English explanation, and exact next steps. The core promise: one narrow, fast answer to "is this safe?" before you act.

Phishing and impersonation are among the highest-frequency reported internet-crime patterns. Shield AI wins on cross-channel analysis, plain-English guidance, and incident recovery rather than competing with the built-in malicious-site checks that Google, Apple, and telecom providers already ship.

---

## Product Strategy

Shield AI positions as a **decision assistant**, not a scanner. The strongest consumer wedge is:

> *"Send us anything suspicious, get a risk score, explanation, and what to do next."*

Mature consumer protections already cover pieces of scam defense — AI scam detection in calls and messages, malicious site warnings. Shield AI's differentiation is **cross-channel analysis** (screenshot + link + text + QR + email + phone in one place), **confidence-aware reporting** (evidence shown separately from conclusion), and **recovery workflows** (what to do after you've already been hit).

---

## Phase Roadmap

| Phase | Goal | User value | Core deliverables |
|-------|------|------------|-------------------|
| **0** | Validate demand and scope | Confirms users trust the flow | User interviews, threat taxonomy, clickable prototype, API feasibility review |
| **1** | Ship the core scam-checker MVP | Lets users assess links, screenshots, and pasted text before acting | Auth, dashboard, screenshot OCR, URL scan, AI risk report, history, feedback loop |
| **2** | Expand input coverage | Makes the app useful in day-to-day messaging and browsing | QR scanner, message analysis, email parser, phone lookup, share extension, notifications |
| **3** | Add protection workflows | Moves from "analyze" to "protect and prevent" | Safe browser, breach monitoring, identity alerts, marketplace and social scam modules |
| **4** | Add recovery and trust network | Helps after a user has already engaged with a scam | Scam recovery wizard, evidence export, family escalation, education center, accessibility upgrades |
| **5** | Build moat and B2B leverage | Improves accuracy and monetization | Proprietary signals, community reporting, admin console, web dashboard, API platform |

---

## Phase 0 — Validation

**Duration:** 3–5 weeks

Before writing production code, validate exact use cases and scoring logic. Focus on the highest-frequency scenarios:

- Suspicious package texts
- Fake bank alerts
- Account verification emails
- Marketplace payment scams
- Fake support prompts
- Crypto and investment lures

**Outputs:**
- 20–30 user interviews (students, parents, remote workers, older adults, marketplace users)
- Threat taxonomy with 12–20 scam classes — red flags, confidence rules, safe next actions per class
- Sample dataset: screenshots, phishing messages, fake login pages, QR links, scam-call transcripts
- Risk framework draft: known-malicious signal, suspicious signal, social-engineering signal, brand impersonation signal, user-action urgency signal

**Success criteria:**
- 70%+ of testers say they would use it "before clicking" or "before paying"
- 3+ use cases show repeat weekly value
- Team identifies one primary acquisition loop (likely share extension or link paste)

---

## Phase 1 — MVP

**Duration:** 10–14 weeks

### Scope

- **Auth:** email/password, magic link, optional OAuth later
- **Dashboard:** recent scans, top CTA to analyze content, saved reports
- **Screenshot Scanner:** image upload → OCR extraction → brand/entity detection → urgency and credential-theft heuristics
- **Link Scanner:** URL parsing, expansion, Safe Browsing check, domain age + WHOIS enrichment, redirect and parameter checks
- **AI Report Engine:** plain-language explanation, red flags, "do this now" action list
- **History and report detail screens**
- **Feedback capture:** "Was this accurate?" to improve prompts and scoring

### Out of scope for Phase 1
- Built-in browser
- Dark web monitoring
- Family plan
- Community reporting
- Enterprise console
- Social-platform-specific modules

### Architecture

**Frontend**
- React Native + Expo + TypeScript
- Expo Router
- React Query
- Zustand
- React Hook Form + Zod

**Backend**
- FastAPI (main API layer)
- PostgreSQL (users, scans, reports, audit history)
- Redis + Celery (OCR, URL enrichment, AI analysis jobs)
- Docker (environment consistency)
- NGINX (reverse proxy + rate limiting)

**AI and detection pipeline**
1. OCR extracts text from screenshots
2. Deterministic rule engine runs first (suspicious TLDs, URL shorteners, brand mismatches, credential prompts)
3. LLM interprets evidence and produces user-facing explanation + classification
4. Final risk score combines deterministic checks + model output — LLM does not score alone

### Phase 1 Data Model

Initial tables:
- `users`
- `profiles`
- `devices`
- `scan_history`
- `risk_reports`
- `image_scans`
- `link_scans`
- `api_usage`
- `audit_logs`

Defer until features exist: `education_progress`, `trusted_contacts`, `identity_alerts`.

### Phase 1 KPIs
- Weekly active scanners
- % of new users who complete first scan in under 2 minutes
- Scan-to-return rate within 7 days
- % of high-risk reports that trigger a follow-up action tap
- User-rated helpfulness on reports
- False positive and false negative rate from labeled feedback

---

## Phase 2 — Expanded Inputs

**Goal:** widen input channels, not reinvent the core engine.

**Features:**
- **QR Scanner** — destination preview, "safe open mode"
- **Message Analyzer** — pasted SMS, chats, marketplace threads
- **Email Analyzer** — headers, sender display mismatch, reply-to mismatch, extracted links, attachment metadata
- **Phone Lookup** — spam/scam reputation, category, recommended action
- **Universal Share Extension** — iOS and Android
- **Notification framework** — completed async scans and breach alerts

**Operational detail:**
- Normalized "artifact ingestion" service so every input becomes a common evidence object
- Queue-based enrichment so mobile responses stay fast
- Confidence gating — if confidence is low, tell the user that clearly instead of pretending certainty

**Exit criteria:**
- 40%+ of scans come from shared content rather than manual entry
- Median time from share to report under 15 seconds for lightweight scans
- 2+ input types beyond screenshots achieve strong repeat usage

---

## Phase 3 — Protection Workflows

**Features:**
- **Identity Protection** — breach lookup, exposed email monitoring, password hygiene prompts, fraud alert and credit freeze guidance
- **Safe Browser** — in-app browsing, risky-form warnings, domain clarity, known-malicious blocklists
- **Marketplace Protection** — buyer/seller scam pattern classification, fake payment screenshot detection, escrow/payment red flags
- **Social Media Protection** — impersonation and fake giveaway flows, account takeover red flags, crypto/romance scam pattern checks

**Policy and legal work required:**
- Clear disclaimers: the app provides risk guidance, not legal or financial advice
- Data retention and deletion policy by input type
- Consent and sensitive-data handling for screenshots, emails, and breach alerts

---

## Phase 4 — Recovery, Family, and Accessibility

**Features:**
- **Scam recovery wizard** — guided flows for bank transfer, gift card, crypto, marketplace fraud, and account takeover scenarios
- **Incident summary generator** — formatted for bank, police, or platform reports
- **Evidence preservation bundle** — screenshots, URLs, timestamps, message text, reporting destinations
- **Family Protection** — trusted contacts, escalation prompts, shared alerts
- **Accessibility** — large text mode, simplified language mode, voice reading, one-tap scan workflows
- **Education Center** — lessons tied to real user scans, "why this looked risky" explanations, short scenario-based quizzes

Education works best when connected to a recent user action, not as a disconnected content library.

---

## Phase 5 — Moat and B2B

**Investments:**
- Advanced model routing by artifact type
- Behavior-based risk signals (where privacy and platform rules allow)
- Custom threat intel from prior scans and analyst-reviewed patterns
- Community reporting with moderation and abuse controls
- Web dashboard and admin console for support, triage, and model QA
- API platform for partners: banks, telcos, insurers, marketplaces, employee-security tools

**Long-term moat:**
- Cross-channel evidence graph
- Human-reviewed scam pattern library
- Outcome feedback loops from users
- Recovery workflows tied to scam class

That is much harder to copy than "LLM explains screenshots."

---

## Build Order

Regardless of phase labels, ship in this order:

1. Common ingestion and report schema
2. OCR and screenshot analysis pipeline
3. URL scanning and enrichment
4. Risk scoring engine
5. User-facing report generation
6. History, feedback, analytics, and moderation tooling
7. New input types one by one
8. Identity, recovery, and family layers

Every future feature depends on a stable ingestion, evidence, scoring, and explanation backbone.

---

## Team and Timeline

**Recommended initial team:**
- 1 product-minded founder or PM
- 1 React Native engineer
- 1 backend/platform engineer
- 1 designer (strong mobile UX)
- 1 part-time security analyst or advisor
- 1 part-time ML/prompt engineer

**12-month delivery plan:**
- Months 1–2: Phase 0 validation, design system, threat taxonomy, architecture
- Months 3–5: Phase 1 build and internal alpha
- Months 6–8: Phase 2 build and public beta
- Months 9–10: Phase 3 protection features
- Months 11–12: Phase 4 recovery, accessibility, and family tools

---

## Monetization

Freemium from day one — free tier must be genuinely useful.

| Tier | Includes |
|------|----------|
| **Free** | Limited scans/month, screenshot + link checks, basic report history |
| **Premium** | Unlimited scans, QR + phone analysis, deeper reports, suspicious-site warnings, breach alerts |
| **Family** | Multiple members, shared alerts, trusted-contact escalation, older-adult support workflows |
| **B2B (later)** | API, white-label workflows, employee anti-phishing benefits |

The paid hook is **ongoing protection and recovery**, not just "more scans."

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| False positives erode trust | Always show evidence and confidence separately |
| False negatives are dangerous | Use deterministic signals wherever possible; never trust LLM output alone |
| LLM outputs sound overconfident | Evidence and confidence displayed independently from conclusion |
| Third-party API cost and latency | Async queue; cost monitoring from day one |
| Sensitive-content privacy pressure | Store minimal sensitive data; offer delete/export controls |
| Human-review gap at scale | Build moderation and QA tooling before enterprise or community features launch |

---

## Status

Currently in **Phase 0 / early Phase 1** — validating threat taxonomy, designing ingestion and report schema, and scoping the MVP build.
