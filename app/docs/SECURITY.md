# PTSaq — Security Posture (OWASP Top 10)

Honest status against each item — checked where it's actually true in
this codebase today, not where it's merely intended. Unchecked items are
real gaps, with the reason they're not done and what closing them would
take.

- [x] **A01 — Broken Access Control**
  RBAC is enforced server-side, not just hidden in the UI:
  `auth/middleware.ts` (`requireAuth`/`requireActive`/`requireAdmin`) gates
  every route, and `auth/rbac.ts canEditRow()` is checked on every
  `PATCH /tasks/:id` and `PATCH /goals/:id` before any write — a request
  forged with someone else's task id still gets rejected with 403 if the
  caller isn't entitled to that row. Reads are deliberately universal
  (everyone sees everything — the app's actual design principle, see
  README), so there's no IDOR surface on `GET`. Per-user data
  (`/notifications`, `/me`, document pins) is always filtered by
  `req.user!.id` from the session, never a client-supplied id.

- [x] **A02 — Cryptographic Failures**
  Passwords: bcrypt, cost factor 12 (`auth/passwords.ts`). Session cookies
  carry `secure: true` whenever `NODE_ENV=production` — meaning they
  simply won't be sent over plain HTTP in that mode; TLS termination
  itself is the deploying host's job (reverse proxy / platform load
  balancer), not application code, and is out of this repo's scope.
  Refresh tokens are stored as SHA-256 hashes, never the raw value
  (`auth/tokens.ts`). No credential — JWT secret, Google service account
  JSON, webhook secret — has a default; `env.ts` throws on boot if a
  required one is missing. `.env` is gitignored in both apps.

- [x] **A03 — Injection**
  Every query goes through Prisma's query builder (parameterized under
  the hood) — there is no raw SQL string concatenation anywhere in this
  codebase. Every mutating route validates its body with Zod before
  touching the database.

- [x] **A04 — Insecure Design (rate limiting, error verbosity)**
  `middleware/rateLimit.ts`: a global limiter (100 req/min/IP) plus a
  tight one on `/auth/login` and `/auth/register` (20 attempts / 15 min,
  keyed by IP+email so one office NAT can't be starved by an attack on a
  single account). The global error handler never returns a stack trace
  or internal message — `{error:"internal_error"}` only, full detail
  logged server-side via `console.error`. Zod's `details` on `400`s
  exposes field-level validation messages (e.g. "email inválido") — that's
  intentional UX, not a leak; it never includes query text or internals.

- [x] **A05 — Security Misconfiguration**
  Helmet is applied with a strict `default-src 'none'` CSP — correct here
  because this server never renders HTML, only JSON, so the
  browsing-page-oriented CSP defaults don't apply. No debug or test
  routes exist in the router tree. The one "default account" risk is the
  seed script's shared demo password (`ptsaq2026-seed`, clearly labeled
  as such in README) — **rotate or remove the seeded users before any
  shared or production deployment**; that's a deployment step, not
  something the code can enforce for you.

- [x] **A07 — Identification and Authentication Failures**
  Access tokens (JWT) expire in 15 minutes. A rotating refresh token
  (30-day validity, stored hashed, `auth/refreshTokens.ts`) reissues them
  without forcing a re-login; presenting an already-rotated refresh token
  — a replay — revokes every refresh token for that user, forcing a real
  re-login everywhere. Passwords require 10+ characters (Zod). Google
  OAuth, when configured, is domain-restricted via `GOOGLE_OAUTH_ALLOWED_DOMAIN`.
  **CSRF**: no separate CSRF token exists, but the combination of
  `SameSite=Lax` cookies + CORS locked to exactly `WEB_ORIGIN` with
  strict credentials mode blocks the realistic attack (a third-party
  site's script issuing a credentialed cross-origin `fetch`/XHR against
  this API) without the extra moving part — a deliberate choice, not an
  oversight, appropriate for a same-origin-frontend, cookie-only API like
  this one.

- [x] **A08 — Software and Data Integrity Failures**
  `POST /webhooks/sheets` requires a shared-secret header
  (`X-PTSaq-Webhook-Secret`) matching `SHEETS_WEBHOOK_SECRET`; the route
  is a `501` no-op until that's configured, so it can't be probed or
  abused before anyone deliberately turns it on. Both `package-lock.json`
  files are committed, pinning the full dependency tree.

- [ ] **A06 — Vulnerable and Outdated Components** — not actively
  monitored. `npm audit` currently reports a handful of moderate-severity
  transitive issues (none in a package this app calls directly). No
  Dependabot/Renovate config exists yet to keep this current automatically
  — a real gap for anything long-running in production; cheap to add
  (`.github/dependabot.yml`) but not done here.

- [ ] **A09 — Security Logging and Monitoring Failures** — partial.
  Domain-level actions are captured in `AuditEntry` (who changed what,
  from which side) and every unhandled error is `console.error`'d
  server-side, but there's no centralized log aggregation, alerting, or
  retention policy — today "the logs" are whatever the process's stdout
  is captured by on whatever host runs it. Wiring that up (e.g. to a
  hosted log sink) is entirely a deployment-environment decision, not
  something to hardcode into the app.

- [ ] **A10 — SSRF** — not a live risk today (the only outbound server-side
  HTTP calls are to Google APIs using fixed, admin-configured spreadsheet
  and folder ids — never a URL derived from user input) but also not
  actively defended with an allowlist, since there was nothing to allowlist
  against. Worth a real check if any feature ever lets a user supply a URL
  the server then fetches.

## What this document deliberately does not claim
No penetration test, dependency audit tool, or external security review
has been run against this code. This is a self-assessment against the
checklist that was asked for, written by the same session that wrote the
code — treat it as a starting point for a real review, not a substitute
for one.
