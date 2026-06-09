# Contributing to Shield AI

## Local development

### Backend
```bash
cd backend
cp .env.example .env          # fill in SECRET_KEY + API keys
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload # http://localhost:8000/docs
pytest                        # run tests
```

Or run the full stack (Postgres + Redis + API + worker) with Docker:
```bash
cd infra
docker compose up --build
```

### Mobile
```bash
cd mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL
npm install
npm start                     # Expo dev server
```

## Project structure
- `backend/` — FastAPI service (auth, scans, OCR, URL enrichment, risk engine)
- `mobile/` — Expo / React Native app
- `design/` — icon + wireframes
- `docs/` — roadmap and design docs
- `infra/` — docker-compose for local stack

## Conventions
- Keep deterministic detection logic in `app/services/risk_engine.py` — it must run before any LLM call.
- The LLM only *interprets evidence*; it never fabricates verdicts.
- Always surface evidence + confidence separately in reports.
- New DB tables are added phase-by-phase; do not add Phase 2+ tables prematurely.

## Branching
- `main` is deployable. Open PRs for features; keep them scoped to a single epic where possible.
