# Shield AI — Deployment Notes

## Railway (project: `Shield-AI`)

| Resource | Value |
|---|---|
| Project ID | `9410157d-7061-44cc-b069-61934f4fdaf7` |
| Environment (production) | `fa4cbfd7-0709-4f44-aa3b-37cb7bdb9370` |
| backend service | `10fb5bf0-8827-4de7-85ff-a4bc056079b4` (repo `mrnickrushing/shield-ai`, root `/backend`) |
| backend-worker service | `71110c4b-5f9e-4eae-87bf-9254ae2908b4` (Celery worker) |
| backend-beat service | `5148eca9-c13e-45fb-842c-8ac185ae0111` (Celery scheduler) |
| web-admin service | `93354528-3abf-4912-a6d1-04d373dd26f8` (repo `mrnickrushing/shield-ai`, root `/web`) |
| postgres service | `382b3679-47fd-485b-bad0-95590802f803` (image `postgres:16`, volume mounted) |
| redis service | `37692301-eaa1-422c-80be-9bc19a10f331` (image `redis:7`) |
| backend Railway domain | `backend-production-f835.up.railway.app` |
| web-admin Railway domain | `web-admin-production-b6d5.up.railway.app` |

## URL Architecture

| URL | Service | What it serves |
|---|---|---|
| `shieldai.rushingtechnologies.com` | web-admin | Marketing/landing page + admin UI |
| `admin.shieldai.rushingtechnologies.com` | web-admin | Same as above (alias) |
| `api.shieldai.rushingtechnologies.com` | backend | REST API |
| `backend-production-f835.up.railway.app` | backend | REST API (Railway direct) |

## Cloudflare DNS (zone `rushingtechnologies.com` = `7270ff1f9c59d54e9d57d3afa4c45919`)

All CNAMEs are DNS-only (not proxied — required for Railway TLS).

| Hostname | Target | Points to |
|---|---|---|
| `shieldai.rushingtechnologies.com` | `web-admin-production-b6d5.up.railway.app` | Web UI |
| `admin.shieldai.rushingtechnologies.com` | `web-admin-production-b6d5.up.railway.app` | Web UI (alias) |
| `api.shieldai.rushingtechnologies.com` | `ji6xuwh8.up.railway.app` | Backend API |

### Backend env vars (already set)
`ENVIRONMENT=production`, `DEBUG=false`, `SECRET_KEY` (generated), `DATABASE_URL`
(points at `postgres.railway.internal:5432`), `REDIS_URL` / `CELERY_*`
(point at `redis.railway.internal:6379`), `ANTHROPIC_API_KEY` (set),
`CORS_ORIGINS=["*"]`.

**Still to add:** `GOOGLE_SAFE_BROWSING_KEY`,
`VIRUSTOTAL_API_KEY` (optional). Without these the app still runs — the LLM
layer and Safe Browsing simply fall back gracefully (deterministic rules only).

### Web-admin env vars
`VITE_API_URL=https://api.shieldai.rushingtechnologies.com`

### Verify after deploy
```
curl https://api.shieldai.rushingtechnologies.com/health
# -> {"status":"ok","app":"Shield AI","version":"0.1.0"}
```

## Creating the first admin user

1. Register an account (already done for nick@rushingtechnologies.com):
```bash
curl -X POST https://api.shieldai.rushingtechnologies.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","display_name":"Your Name"}'
```

2. Promote to admin via Railway Dashboard → postgres service → Data tab:
```sql
UPDATE users SET is_admin = true WHERE email = 'you@example.com';
```

3. Log in at https://shieldai.rushingtechnologies.com/admin/login

## Mobile app API URL
Set `EXPO_PUBLIC_API_URL=https://api.shieldai.rushingtechnologies.com` for production builds.

## Real-time monitoring workers

The API only serves requests and the SSE alert stream. Continuous monitoring requires two long-running backend processes using the same backend image and env vars:

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info
celery -A app.workers.celery_app.celery_app beat --loglevel=info
```

Railway setup:

1. Add a `backend-worker` service from the same repo/root (`/backend`) and override the start command to the worker command above.
2. Add a `backend-beat` service from the same repo/root and override the start command to the beat command above.
3. Attach the same production variables as the API service, especially `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `SECRET_KEY`, and provider API keys.

Beat schedules:

| Task | Frequency | Purpose |
|---|---:|---|
| `monitoring.identity_targets` | hourly | Re-check enrolled emails/phones/usernames/domains |
| `monitoring.scan_pattern_followups` | hourly | Follow up on high-risk scan patterns |
| `monitoring.recovery_reminders` | daily | Remind users about stale open recovery cases |
| `privacy.apply_retention` | daily | Enforce account retention preferences |

Local full-stack mode now includes `api`, `worker`, and `beat`:

```bash
docker compose -f infra/docker-compose.yml up --build
```
