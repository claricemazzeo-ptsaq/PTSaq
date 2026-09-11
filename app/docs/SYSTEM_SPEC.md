# PTSaq — System Integration Spec

Companion to `app/README.md`. This covers the three things asked for
specifically: the architecture data flow, the Google Cloud setup steps,
and the PWA manifest/service worker configuration. It documents the
system **as built** — where a requested piece isn't implemented yet, that's
called out rather than described as if it existed (see the "gaps against
this spec" note at the end of each section).

## 1. Architecture blueprint

```
┌─────────────────────────┐        HTTPS (cookie auth)        ┌──────────────────────────────┐
│   Mobile / Desktop PWA   │ ─────────────────────────────────▶│   Express API (Node/TS)      │
│   React + Vite           │◀─────────────────────────────────  │   app/backend/src/routes/*    │
│   installed via           │        JSON REST                  │                                │
│   "Add to Home Screen"    │                                    │  ┌──────────────────────────┐  │
└─────────────┬────────────┘                                    │  │ auth/ (JWT cookie, RBAC)  │  │
              │                                                  │  └──────────────────────────┘  │
              │ WebSocket (Socket.io, same session cookie)       │  ┌──────────────────────────┐  │
              │◀────────────────────────────────────────────────┤  │ services/notify.js         │  │
              │   notification:new                                │  │  (dependency unlock,       │  │
              │   task:unlocked                                   │  │   blocker alerts, audit)   │  │
              │   sync:status / sync:queue                        │  └──────────────────────────┘  │
              │   presence:update                                 │  ┌──────────────────────────┐  │
              ▼                                                  │  │ services/googleSync.ts     │  │
┌─────────────────────────┐                                      │  │  Sheets values.batchUpdate │  │
│  Service worker          │                                      │  │  Drive files.list (poll)   │  │
│  (Workbox, NetworkFirst  │                                      │  └──────────────┬───────────┘  │
│   for GET, offline shell)│                                      └─────────────────┼──────────────┘
└─────────────────────────┘                                                        │
                                                                                     │ Service-account
                                                                                     │ OAuth2 (JWT)
                                                                                     ▼
                                                      ┌──────────────────────────────────────────┐
                                                      │  Google Workspace                          │
                                                      │  - Sheets API v4 (Painel Operacional,      │
                                                      │    Plano de Trabalho)                       │
                                                      │  - Drive API v3 (institutional folder)      │
                                                      │  - OAuth 2.0 (corporate sign-in)            │
                                                      └──────────────────────────────────────────┘
                                                                                     ▲
                                                                                     │ PostgreSQL (Prisma)
                                                                                     │ — local mirror: the
                                                                                     │   device never talks
                                                                                     │   to Sheets/Drive
                                                                                     │   directly
                                                      ┌──────────────────────────────┴─────────────┐
                                                      │  PostgreSQL                                  │
                                                      │  users, tasks, goals, documents,             │
                                                      │  dependencies, notifications, audit_entries, │
                                                      │  sync_queue_items                            │
                                                      └───────────────────────────────────────────────┘
```

**Read path**: PWA → REST (`GET /tasks`, `/goals`, `/documents`, …) →
Postgres. The device never queries Google directly — Postgres is the
mirror every client reads, which is what makes RBAC enforceable
server-side and what makes offline reads possible (see §3).

**Write path**: PWA → `PATCH /tasks/:id` → Postgres updated + audit entry
recorded + `SyncQueueItem` created → `googleSync.writeTaskCells()` called,
which first re-resolves the row by matching the task's title text
(`resolveCurrentRow()` — addressed by the item's stable identity, not a
cached row index, so a reordered sheet can't silently misdirect the
write) → on success the queue item is deleted and `sync:queue` is
broadcast; on failure the item stays queued and is retried on the next
full resync (`POST /sync/now`). When the PATCH itself can't reach the
server at all (offline), the client's own IndexedDB queue
(`frontend/src/lib/offlineQueue.ts`) captures it instead and replays it
on reconnect — see README "Offline write queue".

**Push path**: any Postgres write that matters to someone else
(dependency unlock, blocker note, conflict) calls
`services/notify.ts`, which writes a `Notification` row and calls
`pushToUser()` — emits over the same Socket.io connection the client
already holds, authenticated by the same httpOnly session cookie as the
REST API (no separate token to leak).

### Deferred by decision, not a gap
The doc this responds to asks for **Google Drive push-channel webhooks**
driving the inbound side (Google → app). What's built instead is
**polling** (`pollDriveFolderMetadata()`, and `POST /sync/now` for a
manual full resync) plus the *outbound* write path above. This was a
deliberate call, not an oversight: at this team's scale (60 rows, 11
people) polling is practically indistinguishable from push, and a webhook
receiver adds real moving parts — a public HTTPS callback endpoint, a
renewal cron (channels expire, ~24h max for Drive), and the security-token
verification on every callback — for a few seconds of latency. Revisit if
the team or data volume grows enough that polling interval actually
becomes felt.

### Inbound: Sheets → app (Apps Script `onEdit`, implemented)
Separately from the Drive-webhook decision above, there's a second,
narrower "Google → app" path that **is** built: `POST /webhooks/sheets`
(`backend/src/routes/webhooks.ts`), driven by an Apps Script bound
directly to the two spreadsheets — `GoogleAppsScript.gs` at the repo
root. Someone edits a Status or Observações cell in the sheet itself
(bypassing the app entirely) and the app reflects it within about a
second, without waiting for a poll cycle.

This is deliberately much cheaper than the Drive push-channel design
described above: an Apps Script installable `onEdit` trigger needs no
public Google Cloud resource, no channel-renewal cron (it doesn't
expire), and no `X-Goog-*` signature verification — auth is a single
shared-secret header (`X-PTSaq-Webhook-Secret`, checked against
`SHEETS_WEBHOOK_SECRET`) the script and the backend both hold. See
`GoogleAppsScript.gs`'s own header comment for the one-time install
steps, and `SECURITY.md` for the auth/threat model.

Row resolution mirrors the outbound path's row-key discipline (§1's
write path, `resolveCurrentRow()`): the payload can carry a stable
`id_tarefa` when the sheet has a hidden id column, and falls back to
`sheet_name` + `row_index` matched against each task/goal's own
`sheetCell` when it doesn't — never a cached row position the app
assumes is still correct.

## 2. Google Cloud service account configuration

Two separate credentials, for two separate purposes — don't conflate
them:

### A. OAuth 2.0 Client (corporate sign-in — a *user* signs in)
1. Google Cloud Console → **APIs & Services → Credentials → Create
   Credentials → OAuth client ID** → Application type **Web application**.
2. Authorized redirect URI: `https://{your-api-origin}/auth/google/callback`
   (for local dev: `http://localhost:4000/auth/google/callback`).
3. Under **OAuth consent screen**, restrict to **Internal** if the
   Workspace is a Google Workspace org (recommended — blocks sign-up
   from outside the domain at the Google layer, before the app's own
   `GOOGLE_OAUTH_ALLOWED_DOMAIN` check even runs).
4. Copy the Client ID/Secret into `backend/.env`:
   `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_OAUTH_ALLOWED_DOMAIN=saquarema.rj.gov.br`.

### B. Service account (server-to-server — the *backend* reads/writes Sheets & Drive)
1. Cloud Console → **IAM & Admin → Service Accounts → Create Service
   Account**. No roles needed at the project/IAM level — access is
   granted per-file by *sharing*, not by IAM role.
2. **Keys → Add key → JSON** — download it. This file's contents (as one
   line) is `GOOGLE_SERVICE_ACCOUNT_JSON`. Treat it as a production
   secret: it's a standing credential, not a short-lived token — store it
   in your host's secret manager, not committed to git (`.gitignore`
   already excludes `.env`).
3. Enable the APIs: **Google Sheets API** and **Google Drive API**
   (Cloud Console → APIs & Services → Library).
4. **Share both spreadsheets** ("Painel Operacional", "Plano de
   Trabalho") with the service account's email
   (`…@…iam.gserviceaccount.com`) as **Editor** — the write-back path
   needs this.
5. **Share the Drive folder**
   (`/folders/1rtRecy4IjFejSXOG7UHsVEYm-4h7QoBM`) with the same service
   account as **Viewer** — the app only ever reads folder metadata, never
   writes or deletes (see `services/googleSync.ts`).
6. Copy each spreadsheet's ID (the long string in its URL between `/d/`
   and `/edit`) into `SHEET_ID_PAINEL_OPERACIONAL` /
   `SHEET_ID_PLANO_DE_TRABALHO`.
7. Restart the backend. `GET /health` should report `"liveSync": true`.

### Webhook callback endpoint (not yet built — see gap note above)
If/when the Drive-webhook inbound path is added, it needs: a public
HTTPS endpoint (`POST /webhooks/drive`), a `channel.watch()` call per
watched resource (Sheets file ID / Drive folder ID) via `drive.files.watch`,
a renewal job (Google push channels expire — max ~24h for Drive,
so a cron needs to re-register before expiry), and verification of the
`X-Goog-Channel-Token`/`X-Goog-Resource-State` headers on each callback
before trusting it. None of this exists yet; flagging the shape of it so
it's not a surprise when it's built.

## 3. PWA manifest & service worker

Configured in `frontend/vite.config.ts` via `vite-plugin-pwa`
(Workbox under the hood — not a hand-written service worker):

```ts
manifest: {
  name: "PTSaq — Hub de Operações",
  short_name: "PTSaq",
  start_url: "/",
  display: "standalone",       // installed app has no browser chrome
  background_color: "#FFF9E7", // Branco Praia — splash screen background
  theme_color: "#136AA0",      // Azul Mar — status bar / task-switcher color
  icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
}
```

- **Installability**: manifest + HTTPS (or localhost) + a registered
  service worker is the whole checklist for both Android Chrome's install
  prompt and iOS Safari's "Add to Home Screen" — no store submission.
  iOS honors `display: standalone` and the manifest icon; it does **not**
  support the Web Push API for background notifications the way Android
  does (a real platform gap, not a bug here — see README's "Known
  follow-ups").
- **Caching strategy**: `NetworkFirst` for same-origin GET requests
  (`app-shell` cache, 3s network timeout before falling back to cache) —
  the UI shell and last-read data stay available offline; writes
  (PATCH/POST) are never cached and always hit the network directly.
- **Precache**: Workbox precaches the built JS/CSS/HTML on install
  (`generateSW` mode) so the app shell loads instantly on repeat visits,
  online or off.
- **Production icons — implemented**: the manifest lists the SVG mark
  (`frontend/public/icon.svg`) plus generated 192×192/512×512 WebP
  fallbacks (`frontend/public/icons/`), and `index.html` links a real PNG
  `apple-touch-icon`. All generated from `frontend/assets/*.png` via
  `npx capacitor-assets generate` — same source used for the iOS/Android
  native app icons and splash screens, see README "Apps nativos".

### Client-side offline write queue — implemented
Reads work offline via the Workbox cache above; writes made offline are
captured by a separate mechanism, `frontend/src/lib/offlineQueue.ts` — a
small IndexedDB store (not WatermelonDB; unnecessary weight at this data
volume). `useUpdateTask`/`useUpdateGoal` (`frontend/src/hooks/`) attempt
the real `PATCH` first and only fall back to the local queue when the
fetch itself fails to reach the network (`isNetworkError()` — a
`TypeError` from `fetch`, or `navigator.onLine` already false), so an
actual server rejection (403 read-only, 409 conflict) is never silently
swallowed into the queue.

Three states only: `na fila` (captured locally) → `enviando` (a flush
attempt in flight) → removed on confirmation. Entries are keyed by
`${kind}:${id}` — the item's own stable database id, never a row index or
position — so a second offline edit to the same item merges into the
first (`enqueueEdit()` does a keyed `put`, not an append) rather than
queuing twice. Flushes automatically on the browser's `online` event and
on mount; a manual "Tentar agora" retry lives in Profile next to the
queue list. This is a distinct thing from the *server-side*
`SyncQueueItem` table / "Fila de envio" (§1's write path) — that one
reflects writes that already reached Postgres but haven't been confirmed
against Google Sheets yet; the client queue covers the step before that,
edits that haven't reached the server at all.
