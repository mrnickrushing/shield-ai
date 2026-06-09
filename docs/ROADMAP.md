# Shield AI — Phased Roadmap

> Detailed phased product plan. Phase 1 is implemented in this repo.

## Phase 0 — Validate demand and scope
- 20–30 user interviews (students, parents, remote workers, older adults, marketplace users)
- Threat taxonomy: 12–20 scam classes with red flags, confidence rules, safe next actions
- Sample dataset collection (screenshots, phishing messages, fake login pages, QR links)
- Risk framework draft (known-malicious, suspicious, social-engineering, brand impersonation, urgency)
- **Success:** ≥70% of testers would use it "before clicking/paying"; ≥3 use cases show repeat weekly value

## Phase 1 — Core scam-checker MVP (THIS REPO)
Promise: "Send us anything suspicious, get a risk score, explanation, and what to do next."
- Authentication (email/password, JWT)
- Dashboard with recent scans
- Screenshot Scanner (OCR + brand/urgency/credential heuristics)
- Link Scanner (URL expansion, Safe Browsing, domain age/WHOIS, redirect & param checks)
- AI Report Engine (deterministic rules blended with LLM explanation)
- History + report detail + feedback capture
- **Excluded:** safe browser, dark web monitoring, family plan, community reporting, enterprise console

### Phase 1 architecture
- **Mobile:** React Native + Expo + TypeScript, Expo Router, React Query, Zustand, RHF + Zod
- **Backend:** FastAPI, PostgreSQL, Redis + Celery, Docker, NGINX, JWT
- **AI/detection:** OCR → deterministic rule engine → LLM interpretation → blended risk score

### Phase 1 data model
`users, profiles, devices, scan_history, risk_reports, image_scans, link_scans, api_usage, audit_logs`
(specialized tables deferred to later phases)

### Phase 1 KPIs
- Weekly active scanners
- % new users completing first scan < 2 min
- 7-day scan-to-return rate
- % high-risk reports triggering a follow-up action
- User-rated helpfulness
- False positive / false negative review rate

## Phase 2 — Expand input coverage
QR scanner, message analyzer, email analyzer, phone lookup, universal share extension, notifications.
- Normalized "artifact ingestion" service → common evidence object
- Queue-based enrichment; confidence gating
- **Exit:** >40% of scans from shared content; median share→report < 15s

## Phase 3 — Protection workflows
Identity protection (breach lookup, exposed email monitoring, credit-freeze guidance), safe browser,
marketplace protection, social media protection. Plus data retention/consent policy work.

## Phase 4 — Recovery + trust network
"I got scammed" recovery wizard, incident summary generator, evidence preservation bundle,
family protection (trusted contacts, escalation, shared alerts), accessibility, education center.

## Phase 5 — Moat + B2B leverage
Advanced model routing, behavior-based signals, custom threat intel, community reporting,
**web dashboard + admin console**, API platform (banks, telcos, insurers, marketplaces).

## Engineering build order
1. Common ingestion + report schema
2. OCR + screenshot pipeline
3. URL scanning + enrichment
4. Risk scoring engine
5. User-facing report generation
6. History, feedback, analytics, moderation tooling
7. New input types one by one
8. Identity, recovery, and family layers

## Monetization
- **Free:** limited scans/month, link + screenshot checks, basic history
- **Premium:** unlimited scans, QR + phone analysis, deeper reports, site warnings, breach alerts
- **Family:** multiple members, shared alerts, trusted-contact escalation
- **B2B (later):** API, white-label, employee anti-phishing

## Key risks & mitigations
- False positives erode trust → always show evidence + confidence separately
- False negatives are dangerous → prefer deterministic signals; blend with LLM
- Overconfident LLM output → ground in evidence, cap confidence
- API cost/latency → async analysis, caching, clear status states
- Sensitive content → minimal retention, delete/export controls
