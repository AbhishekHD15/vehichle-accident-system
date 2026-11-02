# Security notes
- Passwords: Argon2id. JWT access (15 min) + refresh (7 d) tokens; refresh tokens are single-use with server-side
  revocation; re-use of a rotated token revokes all of that user's sessions.
- Authorisation is enforced in the API (`require_roles` + query scoping in `accident_service.scope_*`). Cross-tenant
  lookups return 404. The React role checks are only UX.
- Devices authenticate with a random 256-bit key stored only as a SHA-256 hash; shown once; rotate/disable from admin.
  The ESP32 never holds database credentials. Device endpoints are rate-limited.
- Self-registration is limited to OWNER/FAMILY; INSURANCE/ADMIN are created by an admin.
- Rate limiting (slowapi), CORS allow-list, security headers, HSTS in production, no stack traces to clients,
  Swagger disabled via `ENABLE_DOCS=false`.
- WebSocket token is sent as the first message (not in the URL). Events carry only ids; data is re-fetched via REST.
- Front-end token storage: access/refresh tokens live in localStorage (remember me) or sessionStorage. This is exposed to
  XSS; React escapes output and no user HTML is rendered, but if you need stronger protection move refresh tokens to
  HttpOnly cookies with CSRF protection.
- Rotate `JWT_SECRET` only with a planned logout of all users. Back up PostgreSQL (managed automated backups +
  periodic `pg_dump` to separate storage; test restores).
