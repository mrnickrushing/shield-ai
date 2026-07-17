# Shield AI — Deployment Notes

## Railway (project: `Shield-AI`)

| Resource | Value |
|---|---|
| Project ID | `9410157d-7061-44cc-b069-61934f4fdaf7` |
| Environment (production) | `fa4cbfd7-0709-4f44-aa3b-37cb7bdb9370` |
| backend service | `10fb5bf0-8827-4de7-85ff-a4bc056079b4` (repo `mrnickrushing/shield-ai`, root `/backend`) |
| backend-worker service | `9f0835c6-4d5f-4db0-8f21-99cc196fe410` (Celery worker) |
| backend-beat service | `df083870-789a-483b-9c86-dc6e84ace3a8` (Celery scheduler) |
| web-admin service | `93354528-3abf-4912-a6d1-04d373dd26f8` (repo `mrnickrushing/shield-ai`, root `/web`) |
| postgres service | `382b3679-47fd-485b-bad0-95590802f803` (image `postgres:16`, volume mounted) |
| redis service | `37692301-eaa1-422c-80be-9bc19a10f331` (image `redis:7`) |
| backend Railway domain | `backend-production-ed5a.up.railway.app` |
| web-admin Railway domain | `web-admin-production-874f.up.railway.app` |

## URL Architecture

| URL | Service | What it serves |
|---|---|---|
| `shieldai.rushingtechnologies.com` | web-admin | Marketing/landing page + admin UI |
| `admin.shieldai.rushingtechnologies.com` | web-admin | Same as above (alias) |
| `api.shieldai.rushingtechnologies.com` | backend | REST API |
| `backend-production-ed5a.up.railway.app` | backend | REST API (Railway direct) |

## Cloudflare DNS (zone `rushingtechnologies.com` = `7270ff1f9c59d54e9d57d3afa4c45919`)

All CNAMEs are DNS-only (not proxied — required for Railway TLS). Railway may
rotate its internal CNAME target; treat the custom-domain assignment in Railway
as authoritative rather than copying a service-domain hostname into runbooks.

| Hostname | Target | Points to |
|---|---|---|
| `shieldai.rushingtechnologies.com` | Railway web-admin custom domain | Web UI |
| `admin.shieldai.rushingtechnologies.com` | Railway web-admin custom domain | Web UI (alias) |
| `api.shieldai.rushingtechnologies.com` | Railway backend custom domain | Backend API |

### Backend env vars (already set)
`ENVIRONMENT=production`, `DEBUG=false`, `SECRET_KEY` (generated), `DATABASE_URL`
(points at `postgres.railway.internal:5432`), `REDIS_URL` / `CELERY_*`
(point at `redis.railway.internal:6379`), `ANTHROPIC_API_KEY` (set),
`CORS_ORIGINS=["https://shieldai.rushingtechnologies.com","https://www.shieldai.rushingtechnologies.com"]`,
provider credentials, `MOBILE_GOOGLE_AUTH_RETURN_URI`, and the public Android
signing fingerprints used by `/.well-known/assetlinks.json`.

`VIRUSTOTAL_API_KEY` is optional. Without an optional provider the app still
runs and uses the deterministic evidence available from the configured layers.

### Web-admin env vars
`VITE_API_URL=https://api.shieldai.rushingtechnologies.com`

### Verify after deploy
```
curl https://api.shieldai.rushingtechnologies.com/health
# -> {"status":"ok","app":"Shield AI","version":"0.6.0"}
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

The API only serves requests and the SSE alert stream. Continuous monitoring
uses two long-running services built from the same backend image. The shared
`python start.py` entrypoint selects the role with `SHIELD_PROCESS` and exposes
a real child-process liveness check at `/health`:

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info
celery -A app.workers.celery_app.celery_app beat --loglevel=info
```

Railway setup is committed and automated:

1. `backend-worker` has `SHIELD_PROCESS=worker`; `backend-beat` has
   `SHIELD_PROCESS=beat`.
2. Both services use Railway variable references back to `backend` for the
   database, Redis, signing key, delivery credentials, and provider keys.
3. On a successful `main` CI run, `Deploy monitoring workers` waits for the API
   migration/health check, deploys both services from `backend/`, and verifies
   both deployments. A failed API or test run therefore cannot start workers
   against an incompatible schema.

Beat schedules:

| Task | Frequency | Purpose |
|---|---:|---|
| `monitoring.identity_targets` | hourly | Re-check enrolled emails/phones/usernames/domains |
| `monitoring.scan_pattern_followups` | hourly | Follow up on high-risk scan patterns |
| `monitoring.recovery_reminders` | daily | Remind users about stale open recovery cases |
| `privacy.apply_retention` | daily | Enforce account retention preferences |
| `feeds.refresh_seeds` | daily | Refresh phone/domain intelligence feeds |
| `identity.broker_rechecks` | daily | Re-check overdue and removed broker listings |
| `monitoring.weekly_protection_report` | weekly | Generate protection reports |
| `feeds.blocklist_growth_push` | weekly | Notify subscribers of blocklist growth |
| `notifications.check_push_receipts` | every 15 minutes | Reconcile Expo tickets and revoke invalid tokens |

Local full-stack mode now includes `api`, `worker`, and `beat`:

```bash
docker compose -f infra/docker-compose.yml up --build
```
