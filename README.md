# CrashSense — IoT Vehicle Accident Detection & Insurance Management System

ESP32 + MPU6050/6500 + u-blox GPS + A7672S 4G modem → FastAPI + PostgreSQL → CrashSense React dashboards
(Owner · Family · Insurance · Admin).

```
vehicle-accident-system/
├── accident-cloud/   FastAPI backend (SQLAlchemy 2, Alembic, JWT/Argon2, WebSocket hub, pytest)
├── frontend/         React + Vite + Tailwind + Leaflet + Recharts
├── firmware/         ESP32 PlatformIO project (detection FSM, SMS/call, HTTPS upload, offline queue)
├── docs/             HARDWARE, SECURITY, TESTING, DEPLOYMENT, AT-COMMAND-VERIFICATION
├── docker-compose.yml  local Postgres + API
└── render.yaml         cloud blueprint (managed Postgres + API + static site)
```

## What is verified vs. not (read this first)

| Area | Status |
|---|---|
| Backend API, RBAC, idempotent device upload, claims, notifications | **Automated tests: 16 passing** (SQLite in tests; PostgreSQL in production) |
| Alembic migration | Ran successfully against SQLite; run against your PostgreSQL before first use |
| Frontend | `npm run build` succeeds. Not exercised in a browser against a live API in this build |
| ESP32 firmware | **Written but NOT compiled or tested on hardware.** Expect to fix compile errors/pin issues on first build |
| A7672S HTTPS / SSL / delivery-report AT sequences | Based on SIMCom A76XX conventions; **must be verified on your module** (see docs/AT-COMMAND-VERIFICATION.md) |
| Detection thresholds | Placeholders. Calibrate on a bench rig (docs/TESTING.md). Do not crash-test vehicles |

Phase 1 note: no pre-existing project files were supplied, so this is a fresh scaffold. If you
have existing code/DB, merge file-by-file and use `alembic upgrade head` (it only creates missing tables).

## 1. Backend

```bash
cd accident-cloud
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -c "import secrets;print(secrets.token_urlsafe(64))"   # paste as JWT_SECRET in .env
# edit DATABASE_URL in .env
```
Create the database (PostgreSQL), then migrate and run:
```bash
createdb accident_db            # or: psql -c "CREATE DATABASE accident_db;"
alembic upgrade head
python -m scripts.create_admin admin@example.com "Admin Name"    # prompts for password
uvicorn app.main:app --reload --port 8000
# docs at http://127.0.0.1:8000/docs (disable with ENABLE_DOCS=false in production)
pytest -q                       # run tests
```
Or: `POSTGRES_PASSWORD=... docker compose up --build`.

### Environment variables
| Variable | Meaning |
|---|---|
| `APP_ENV` | `development` or `production` (production refuses to start without `JWT_SECRET`) |
| `DATABASE_URL` | e.g. `postgresql+psycopg2://user:pass@host:5432/accident_db` |
| `JWT_SECRET` | long random string; never commit |
| `ACCESS_TOKEN_MINUTES` / `REFRESH_TOKEN_DAYS` | token lifetimes (15 min / 7 days) |
| `CORS_ORIGINS` | comma-separated frontend origins |
| `ENABLE_DOCS` | `false` in production |
| `LOGIN_RATE_LIMIT`, `DEVICE_RATE_LIMIT` | slowapi limits |
| `MAX_NOTIFICATION_RETRIES`, `DEVICE_ONLINE_SECONDS` | retry cap; heartbeat window for "online" |

## 2. Frontend
```bash
cd frontend
cp .env.example .env     # VITE_API_BASE_URL, VITE_WS_URL (public values only)
npm install
npm run dev              # http://localhost:5173
npm run build            # production bundle in dist/
```

## 3. First-run walkthrough
1. Create the admin (`scripts.create_admin`), log in at the website.
2. Admin → *Users & insurers*: create an INSURANCE user. Its **Organization** must equal the vehicles'
   `insurance_company` text (case-insensitive) — that is how insurers are scoped to their own vehicles.
3. Register an OWNER (Register page) → add a vehicle (set insurance company/policy).
4. Admin → *Devices*: register device `ESP01` linked to the vehicle's ID. **Copy the device key now** (shown once).
5. Owner → vehicle page → share with a FAMILY user (they register themselves first).
6. Firmware: `cp src/secrets.example.h src/secrets.h`, fill DEVICE_ID/DEVICE_KEY/API_BASE_URL/phone numbers/APN.
7. Flash: `cd firmware && pio run -t upload && pio device monitor`.

## 4. Firmware
See `docs/HARDWARE.md` (wiring, **modem power**) and `docs/AT-COMMAND-VERIFICATION.md`.
Hold the push-button while powering up to enter **USB↔modem AT passthrough** for testing AT commands.

## Key design decisions
- **Detection ≠ claim ≠ approval.** Accidents come only from authenticated devices (`POST /device/accidents`);
  website users cannot create them (405). Claims are raised by the owner, reviewed by insurance staff, audited.
- **Idempotent uploads.** Device generates `ACC-<DEVICE>-<counter>` (persistent NVS counter). Re-posting returns 200;
  a dispatched alert can never be flipped to cancelled (and vice versa).
- **SMS status honesty.** `SUBMITTED` = modem accepted; `DELIVERED` only from a network delivery report (+CDS).
  Timeouts become `UNKNOWN` and are *not* auto-resent (avoids duplicate SMS). Website users can only *request* a retry
  (picked up on the next device heartbeat); only the device endpoint writes delivery status.
- **Non-blocking firmware.** Core 1 samples at 200 Hz + FSM; modem and OLED run in core-0 tasks.
  Events persist in flash and survive resets/offline periods.
- **Data scoping in the backend.** Owner = own vehicles; Family = explicitly shared vehicles (no telemetry/insurance data,
  masked phones); Insurance = vehicles insured by its organization; Admin = all. Cross-tenant access returns 404.
- **Real-time:** WebSocket hints (first-message token auth) with automatic polling fallback. Single-process hub;
  use Redis pub/sub if you run several workers.

## Remaining work / known limitations
- Hardware bring-up and AT-command verification (above). Calibrate detection thresholds.
- No email service: password reset is admin-initiated.
- Frontend has no automated tests; no code-splitting (bundle ≈ 830 KB).
- Alembic initial migration uses `create_all(checkfirst=True)`; use `--autogenerate` for later changes.
- Insurance claim documents/attachments are not implemented.
