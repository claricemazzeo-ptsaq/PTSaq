# PTSaq — API Reference

All routes are mounted under the backend origin (`http://localhost:4000` in
dev; the frontend talks to them via the `/api` proxy — see `README.md`).
Every response is JSON. Every authenticated route requires the
`ptsaq_session` httpOnly cookie set by `/auth/login`, `/auth/register`
(after approval), or `/auth/google/callback` — there is no bearer-token
mode; the cookie is mandatory. Errors are `{ "error": "<code>" }`, plus
`details` for validation failures (Zod's `.flatten()`); frontend copy maps
these codes to human-readable Portuguese (see `Login.tsx`, `Register.tsx`)
rather than showing them raw.

**Access token lifetime**: 15 minutes. Do not treat a 401 as "the user
logged out" — first `POST /auth/refresh` (the frontend's `api/client.ts`
does this automatically on any 401). Only a failed *refresh* means the
session is actually over.

## Auth (`/auth`) — rate-limited: 20 req / 15 min per IP+email

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | none | `{name, email, password, departmentId}` | Creates a `pending` account + `PendingAccountRequest`; domain-restricted if `GOOGLE_OAUTH_ALLOWED_DOMAIN` is set |
| POST | `/auth/login` | none | `{email, password}` | Sets `ptsaq_session` (15 min) + `ptsaq_refresh` (30 days) cookies |
| POST | `/auth/refresh` | refresh cookie | — | Rotates the refresh token, reissues both cookies. A reused (already-rotated) refresh token revokes the whole chain — signals theft |
| POST | `/auth/logout` | session | — | Revokes the current refresh token, clears both cookies |
| GET | `/auth/google` | none | — | Redirects to Google's consent screen (`501` if OAuth isn't configured) |
| GET | `/auth/google/callback` | none | — | Exchanges the code, creates/links the user, redirects to the frontend |

## Me (`/me`)

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | Current user + department |
| PATCH | `/me` | `{availability?, notifyPush?, offlineCacheMb?}` |

## Departments (`/departments`)

| Method | Path | Notes |
|---|---|---|
| GET | `/departments` | All 4, with computed `goalProgressPct` |

## Tasks (`/tasks`) — "Painel Operacional"

| Method | Path | Notes |
|---|---|---|
| GET | `/tasks?department=&mine=true` | RBAC never filters *reads* — every row includes `canEdit` computed for the caller |
| GET | `/tasks/:id` | Includes `readOnlyReason` when `canEdit` is false |
| PATCH | `/tasks/:id` | `{status?, note?}` — 403 if not editable, 409 `conflict_pending` if `contested`. Triggers: audit entry, activity feed, `SyncQueueItem`, Sheets write-back, dependency-unlock check if status → Executado |
| POST | `/tasks/:id/resolve-conflict` | `{keep: "mine"\|"sheet"}` — clears `contested`, keeps the chosen status, the other is only kept in the audit trail text |
| POST | `/tasks/:id/dependency` | `{blockedByTaskId}` |
| DELETE | `/tasks/:id/dependency` | Clears the link |
| GET | `/tasks/:id/audit` | Recent audit entries, newest first |

## Goals (`/goals`) — "Plano de Trabalho"

Same shape as Tasks minus dependencies: `GET /goals?department=`,
`GET /goals/:id`, `PATCH /goals/:id` (`{status?, note?}`),
`GET /goals/:id/audit`.

## Documents (`/documents`) — institutional Drive repository

| Method | Path | Notes |
|---|---|---|
| GET | `/documents?scope=&type=&q=` | `scope`: department id, `glo` for Global, or omit for all |
| GET | `/documents/:id` | |
| POST | `/documents/:id/pin` / `DELETE .../pin` | Per-user offline pin |
| POST | `/documents/refresh` | Metadata-only Drive poll (no-op, `mock: true` in the response, when live sync isn't configured) |

## Notifications (`/notifications`)

`GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`.

## Activity (`/activity`)

`GET /activity?mine=true` — last 12 entries, dashboard feed.

## Sync (`/sync`)

`GET /sync/status` — `{live, queue: SyncQueueItem[], sheets}`.
`POST /sync/now` — triggers a full resync cycle (broadcasts `sync:status`).

## Admin (`/admin`) — requires `role: admin`

`GET /admin/pending-accounts`, `POST /admin/pending-accounts/:id/approve`,
`POST /admin/pending-accounts/:id/reject`.

## Webhooks (`/webhooks`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/webhooks/sheets` | `X-PTSaq-Webhook-Secret` header | Apps Script `onEdit` push — see `docs/SYSTEM_SPEC.md` §1 and `SECURITY.md` |

Payload:
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "sheet_name": "Painel Operacional",
  "row_index": 4,
  "data": { "id_tarefa": "T1", "status": "Em execução", "observacao": "…" }
}
```
`data.id_tarefa` is optional but preferred — when present it's looked up
directly by primary key; otherwise the row is matched by
`sheet_name` + `row_index` against every task/goal's stored `sheetCell`.
Returns `404 no_matching_row` if neither resolves, `501` if
`SHEETS_WEBHOOK_SECRET` isn't configured, `401` if the header doesn't match.

## Real-time (Socket.io, same origin, session-cookie authenticated)

Connect with `withCredentials: true` — no separate token. Server → client
events: `notification:new`, `task:unlocked`, `task:external-update`,
`goal:external-update`, `sync:status`, `sync:queue`, `activity:new`,
`presence:update`. Client → server: `presence:enter` / `presence:leave`
(payload: item id).
