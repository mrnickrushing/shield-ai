# Shield AI

**AI-powered scam, fraud, and identity protection assistant.**

> Before you click. Before you pay. Before you trust. Know if it's real.

---

## Current Status

**Phase 1 shipped — iOS app live on TestFlight.**

- ✅ **Mobile** (Expo / React Native): full redesigned UI — dashboard with protection ring, multi-mode scan (link, image, QR, message, email, phone, marketplace, social), protect screen, history, result detail
- ✅ **Backend** (FastAPI + Railway): JWT auth, link + screenshot scan endpoints, OCR pipeline, URL enrichment (Safe Browsing, WHOIS, redirect/typosquat/homograph checks), blended deterministic + LLM risk engine, scan history & feedback, Celery worker, Alembic migrations
- ✅ **CI/CD** (Codemagic): automated iOS builds → TestFlight, OTA JS updates via Expo EAS Update (production channel)
- ✅ **App icon + branding**: Neon Shield design system — deep dark backgrounds, sky blue accent, animated SVG protection ring
- ✅ **Infra**: Dockerfile, `docker-compose` (Postgres + Redis + API + worker), Railway deploy

### Quickstart

```bash
# Backend
cd infra && docker compose up --build      # API at http://localhost:8000/docs

# Mobile
cd mobile && npm install && npm start
```

### Deploying changes

**Full build (native changes, new packages, app config):**
Triggered manually via Codemagic → `iOS → TestFlight` workflow on `main`.

**OTA update (JS/UI changes only — no native code touched):**
Triggered manually via Codemagic → `OTA Update → Expo production` workflow on `main`.
Lands on device within ~2 min, no App Store review needed.

---

## What is Shield AI?

Shield AI is a decision assistant — not a generic antivirus app. You send it anything suspicious (a screenshot, a link, a forwarded text, a QR code), and it comes back with a risk score, threat class, plain-English explanation, and exact next steps.

The core promise: one narrow, fast answer to **"is this safe?"** before you act.

---

## Product Strategy

Shield AI positions as a **decision assistant**, not a scanner. The strongest consumer wedge is:

> *"Send us anything suspicious, get a risk score, explanation, and what to do next."*

Differentiation is **cross-channel analysis** (screenshot + link + text + QR + email + phone in one place), **confidence-aware reporting** (evidence shown separately from conclusion), and **recovery workflows** (what to do after you've already been hit).

---

## Phase Roadmap

| Phase | Goal | Status |
|-------|------|--------|
| **0** | Validate demand and scope | ✅ Done |
| **1** | Ship core scam-checker MVP | ✅ Done — live on TestFlight |
| **2** | Expand input coverage | 🚧 Next |
| **3** | Add protection workflows | Planned |
| **4** | Add recovery and trust network | Planned |
| **5** | Build moat and B2B leverage | Planned |

### Phase 2 — Expanded Inputs

- **QR Scanner** — destination preview, "safe open mode"
- **Message Analyzer** — pasted SMS, chats, marketplace threads
- **Email Analyzer** — headers, sender display mismatch, extracted links
- **Phone Lookup** — spam/scam reputation, category, recommended action
- **Universal Share Extension** — iOS and Android
- **Notification framework** — completed async scans and breach alerts

### Phase 3 — Protection Workflows

- **Identity Protection** — breach lookup, exposed email monitoring, fraud alert and credit freeze guidance
- **Safe Browser** — in-app browsing, risky-form warnings, known-malicious blocklists
- **Marketplace Protection** — buyer/seller scam classification, fake payment detection
- **Social Media Protection** — impersonation and fake giveaway flows, account takeover red flags

### Phase 4 — Recovery, Family, and Accessibility

- **Scam recovery wizard** — guided flows for bank transfer, gift card, crypto, marketplace fraud
- **Incident summary generator** — formatted for bank, police, or platform reports
- **Evidence preservation bundle** — screenshots, URLs, timestamps, reporting destinations
- **Family Protection** — trusted contacts, escalation prompts, shared alerts
- **Education Center** — lessons tied to real user scans, scenario-based quizzes

### Phase 5 — Moat and B2B

- Advanced model routing by artifact type
- Community reporting with moderation
- Web dashboard and admin console
- API platform for partners: banks, telcos, insurers, marketplaces

---

## Architecture

**Mobile**
- React Native + Expo + TypeScript
- Expo Router (file-based navigation)
- React Query + Zustand + React Hook Form + Zod
- NativeWind (Tailwind for RN)
- expo-updates (OTA JS delivery via EAS Update)

**Backend**
- FastAPI (main API layer)
- PostgreSQL (users, scans, reports, audit history)
- Redis + Celery (OCR, URL enrichment, AI analysis jobs)
- Docker + Railway

**AI and detection pipeline**
1. OCR extracts text from screenshots
2. Deterministic rule engine runs first (suspicious TLDs, URL shorteners, brand mismatches, credential prompts)
3. LLM interprets evidence and produces user-facing explanation + classification
4. Final risk score combines deterministic checks + model output — LLM does not score alone

---

## Monetization

Shield AI has no free tier — every account requires an active subscription
(a short free trial, card required, precedes the first charge). There is one
consumer plan, plus a Family upsell and a later B2B tier:

| Tier | Includes |
|------|----------|
| **Premium** | All scan types, Live Safe Browser, identity breach monitoring, weekly protection report, data-broker exposure checklist |
| **Family** | Everything in Premium, shared across multiple members, trusted-contact escalation |
| **B2B (later)** | API, white-label workflows, employee anti-phishing benefits |

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| False positives erode trust | Always show evidence and confidence separately |
| False negatives are dangerous | Use deterministic signals; never trust LLM output alone |
| LLM outputs sound overconfident | Evidence and confidence displayed independently from conclusion |
| Third-party API cost and latency | Async queue; cost monitoring from day one |
| Sensitive-content privacy pressure | Store minimal sensitive data; offer delete/export controls |
