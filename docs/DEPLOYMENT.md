# Shield AI — Deployment Notes

## Railway (project: `Shield-AI`)

| Resource | Value |
|---|---|
| Project ID | `9410157d-7061-44cc-b069-61934f4fdaf7` |
| Environment (production) | `fa4cbfd7-0709-4f44-aa3b-37cb7bdb9370` |
| backend service | `10fb5bf0-8827-4de7-85ff-a4bc056079b4` (repo `mrnickrushing/shield-ai`, root `/backend`) |
| postgres service | `382b3679-47fd-485b-bad0-95590802f803` (image `postgres:16`, volume mounted) |
| redis service | `37692301-eaa1-422c-80be-9bc19a10f331` (image `redis:7`) |
| Railway domain | `backend-production-f835.up.railway.app` |

### Backend env vars (already set)
`ENVIRONMENT=production`, `DEBUG=false`, `SECRET_KEY` (generated), `DATABASE_URL`
(points at `postgres.railway.internal:5432`), `REDIS_URL` / `CELERY_*`
(point at `redis.railway.internal:6379`), `OPENAI_MODEL=gpt-4o-mini`,
`FREE_TIER_DAILY_SCANS=15`, `CORS_ORIGINS=["*"]`.

**Still to add by you:** `OPENAI_API_KEY`, `GOOGLE_SAFE_BROWSING_KEY`,
`VIRUSTOTAL_API_KEY` (optional). Without these the app still runs — the LLM
layer and Safe Browsing simply fall back gracefully (deterministic rules only).

### Start command fix (the `$PORT` issue)
Early deploys failed with `Invalid value for '--port': '$PORT'` because Railway
ran the start command without a shell, so `$PORT` wasn't expanded. Fixed by
adding `backend/start.py`, which reads `PORT` in Python. Both `railway.json`
(`startCommand: python start.py`) and the Dockerfile `CMD` now use it. Just
redeploy the backend from the latest `main` and the healthcheck should pass.

### Verify after deploy
```
curl https://backend-production-f835.up.railway.app/health
# -> {"status":"ok","app":"Shield AI","version":"0.1.0"}
```

## Cloudflare DNS (zone `rushingtechnologies.com` = `7270ff1f9c59d54e9d57d3afa4c45919`)

Both CNAMEs created (DNS-only / not proxied, required for Railway TLS):

| Hostname | Target |
|---|---|
| `shieldai.rushingtechnologies.com` | `ji6xuwh8.up.railway.app` |
| `admin.shieldai.rushingtechnologies.com` | `zp2wk07c.up.railway.app` |

Custom domains are registered on the Railway backend service; once the backend
is healthy, Railway issues certs and both hostnames go live. `admin.` currently
points at the same backend (serves API docs) until the Phase 5 admin UI exists.
