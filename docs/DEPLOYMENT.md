# Deployment

**Database** — managed PostgreSQL (Render, Neon, Supabase, RDS…): enable automated backups, restrict network access
(private network / IP allow-list), separate production credentials. Database name `accident_db`.

**Backend** — `accident-cloud/Dockerfile` (runs `alembic upgrade head` then uvicorn). Set env vars from `.env.example`
with `APP_ENV=production`, `ENABLE_DOCS=false`, strong `JWT_SECRET`, `CORS_ORIGINS=https://your-frontend`.
Health checks: `/health` (liveness), `/health/ready` (DB). TLS is terminated by the platform; the container trusts
`X-Forwarded-*` headers. Scale > 1 worker only after moving the WebSocket hub to Redis (otherwise clients on other
workers fall back to polling).

**Frontend** — `npm ci && npm run build`, publish `dist/` to any static host with an SPA rewrite to `/index.html`.
Set `VITE_API_BASE_URL` and `VITE_WS_URL` (wss://) at build time.

**Blueprint** — `render.yaml` provisions all three on Render (edit hostnames/plan names).

**Vehicle** — firmware `secrets.h`: `API_BASE_URL=https://<api-host>/api/v1`, device id/key from the admin dashboard,
APN. Provision the CA certificate into the modem (see AT-COMMAND-VERIFICATION.md). Never point a vehicle at localhost.

**Backups** — managed snapshots + weekly `pg_dump` copy; test a restore quarterly.
