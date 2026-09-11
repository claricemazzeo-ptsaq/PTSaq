# PTSaq — Hub de Operações

A full-stack implementation of the "PTSaq — Hub de Operações" design handoff
(`project/PTSaq - Hub de Operações.dc.html` in the repo root): an operations
hub for the Parque Tecnológico de Saquarema team, built on top of two real
spreadsheets ("Painel Operacional" and "Plano de Trabalho") and an
institutional Google Drive document repository.

This is a real, running application — not a mockup. Auth, the database,
RBAC, the dependency/unlock engine, the conflict-resolution flow, real-time
notifications, and the PWA frontend all work today against a local
Postgres database. The one piece that genuinely cannot work without your
organization's own credentials is **live** Google Sheets/Drive sync — see
[Going live](#going-live-with-google-sheets--drive) below.

## Architecture

```
app/
  backend/    Node.js + TypeScript + Express + Prisma + PostgreSQL + Socket.io
  frontend/   React + TypeScript + Vite PWA
```

- **Auth**: email/password (bcrypt + JWT httpOnly cookie) and, once
  configured, corporate Google OAuth restricted to your Workspace domain.
  New accounts start `pending` until an admin (role `admin`) approves them.
- **RBAC**: mirrors the original design's rule exactly — everyone reads
  everything; **admin** edits every row; **lead** edits everything in their
  own department; **contrib** edits only rows where their first name
  appears in that row's free-text owner field. Enforced server-side
  (`src/auth/rbac.ts`), not just hidden in the UI.
  Filtering happens server-side, so a device never even receives an edit
  affordance it isn't entitled to use.
- **Dependency/unlock engine**: tasks can name another task as a blocker
  (`Task.blockedByTaskId`). Marking the blocker "Executado" immediately
  finds every task waiting on it, notifies each owner in real time over
  Socket.io, and the UI flips their badge with a pulse animation.
- **Conflict resolution**: a row can be marked `contested` with a
  `conflictSheetStatus` — the value the live sheet held vs. what's in the
  app. Editing a contested row is blocked until the user picks a side in
  the conflict modal; the discarded value is kept in the audit trail.
- **Audit trail**: every write (from the app or, once live, from Sheets)
  is recorded per task/goal with who, what, and which side it came from.
- **Real-time layer**: Socket.io, authenticated with the same httpOnly
  session cookie as the REST API (no separate token to leak). Powers
  notifications, presence ("Ana está com este item aberto"), the sync
  status bar, and the dependency-unlock flash.
- **Google Sheets/Drive sync** (`src/services/googleSync.ts`): writes RAW
  values into exactly the Status/Observações/Percentual-da-meta columns —
  it never touches formulas or conditional formatting. Runs in **mock
  mode** (local Postgres only) until you configure real credentials; see
  below. Before every live write it re-resolves which row the task/goal
  is actually on right now by matching its title text
  (`resolveCurrentRow()`), rather than trusting a row number cached at
  seed time — a spreadsheet sort or inserted row can't silently misdirect
  a write.
- **Offline write queue** (`frontend/src/lib/offlineQueue.ts`): status/note
  edits made with no connectivity are captured in IndexedDB (three states:
  `na fila` → `enviando` → confirmed and removed), keyed by the task/goal's
  own stable id — never a row index or position — so a second offline edit
  to the same item merges into the first instead of stacking. Flushes
  automatically on reconnect; surfaced in the sync status bar and under
  "Fila local (offline)" in Profile.
- **Sheets → app push** (`POST /webhooks/sheets`): an Apps Script bound to
  the two spreadsheets (`GoogleAppsScript.gs` at the repo root) pushes a
  Status/Observações edit made directly in the sheet to the app within
  about a second, instead of waiting for the next poll. See that file's
  own header comment for the one-time install steps.
- **Interactive API docs**: Swagger UI at `/docs` once the backend is
  running (`http://localhost:4000/docs`), generated from the OpenAPI spec
  in `src/openapi.ts` — every endpoint is testable from the browser,
  including auth, with cookies handled automatically.

## Data

The seed script (`backend/src/seed.ts`) loads the real snapshot captured
during the design handoff: 24 tasks from "Painel Operacional" (updated
27/08/2026), 34 goals from "Plano de Trabalho", 17 documents from the
institutional Drive folder, the 4 departments, and the 7 named team
accounts (André, Ana Flávia, Clarice, Ailton, Gabriel, Rhanon, Carlos).
Two data-quality gaps the design session already identified are preserved
rather than papered over: task budgets are `null` ("não informado") except
where the sheet had a real currency value, and goal progress is derived
from the *Situação* column rather than the sheet's row-number artifacts in
the percentage column.

## Running locally

Prerequisites: Node 20+, a PostgreSQL server.

```bash
# 1. Backend
cd backend
cp .env.example .env        # edit DATABASE_URL / JWT_SECRET if needed
npm install
npx prisma migrate dev      # creates the schema
npm run seed                # loads the real PTSaq snapshot
npm run dev                 # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173, proxies /api to :4000
```

Interactive API docs (Swagger UI, "Try it out" against the real running
backend): **http://localhost:4000/docs**.

Open http://localhost:5173/login. **Seed accounts** all share the password
`ptsaq2026-seed` (see the console output of `npm run seed`) — this is a
local development convenience, not a real credential; rotate/remove it
before any shared or production deployment. Try:

| Email | Role |
|---|---|
| `andre@saquarema.rj.gov.br` | admin — approves accounts, edits everything |
| `ana.flavia@saquarema.rj.gov.br` | lead · Jurídico |
| `clarice@saquarema.rj.gov.br` | lead · Comunicação |
| `rhanon@saquarema.rj.gov.br` | contrib · Administrativo (edits only rows naming "Rhanon") |

To see the flows the original design called out specifically:
- Log in as **Ana Flávia**, open task **T9** ("Lei de inovação de
  Saquarema") from her queue — it's seeded with a pending edit conflict.
- Mark task **T8** ("Termo de cessão de uso do espaço") as *Executado* —
  it unlocks T1 and T4 for Rhanon and Clarice in real time.
- Log in as **André** on the home screen to see the pending-account
  approval queue.

## Build & deploy

```bash
# Backend — compiles TS to dist/, then runs the compiled server
cd backend
npx prisma migrate deploy   # applies pending migrations without prompting
                             # (use this in prod/CI; `migrate dev` above is
                             # for local development only)
npm run build                # tsc -p tsconfig.json → dist/
npm start                    # node dist/server.js

# Frontend — static build, served by whatever host/CDN you use
cd frontend
npm run build                # outputs to dist/ (includes the PWA
                              # manifest + generated service worker)
```

The backend needs a reachable PostgreSQL instance and a Node 20+ host; the
frontend build is static output — serve it from any static host, with
`WEB_ORIGIN` in `backend/.env` set to wherever that ends up. There's no
Dockerfile/hosting config included yet — see "Known follow-ups" below.

## Going live with Google Sheets / Drive

Nothing in the codebase needs to change — fill in `backend/.env` and
restart:

1. **Corporate Google Sign-In**: create an OAuth 2.0 Client ID (Web
   application) in Google Cloud Console, add
   `{your-api-origin}/auth/google/callback` as an authorized redirect URI,
   and set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` /
   `GOOGLE_OAUTH_ALLOWED_DOMAIN`.
2. **Live Sheets/Drive sync**: create a service account, share it as
   Editor on both spreadsheets and Viewer on the Drive folder, and set
   `GOOGLE_SERVICE_ACCOUNT_JSON` (the key file's contents, as one line),
   `SHEET_ID_PAINEL_OPERACIONAL`, `SHEET_ID_PLANO_DE_TRABALHO`, and
   `DRIVE_FOLDER_ID` (defaults to the folder named in the design brief,
   `1rtRecy4IjFejSXOG7UHsVEYm-4h7QoBM`).
3. **Verify the column mapping before enabling writes in production.**
   `googleSync.ts` writes Status into the exact cell captured in each
   row's `sheetCell` (e.g. `Painel Operacional!B4`) and Observações one
   column to its right — confirm that offset matches the real sheet's
   layout (`NOTE_COLUMN_OFFSET` / `PCT_COLUMN_OFFSET` in that file) before
   trusting it against production data.
4. Restart the backend — `GET /health` reports `liveSync: true` once all
   three sync env vars are set, and the sync status bar/profile screen
   switch from "modo local" to live automatically.
5. **Optional — Sheets → app push**: install `GoogleAppsScript.gs` in each
   spreadsheet's own script editor (Extensions → Apps Script) so an edit
   made directly in the sheet reaches the app within about a second
   instead of waiting for the next poll. Set `SHEETS_WEBHOOK_SECRET` in
   `backend/.env` first — the endpoint (`POST /webhooks/sheets`) returns
   501 and does nothing until that's set. Full steps are in the script's
   own header comment.

The app **runs correctly with none of this configured** — it's a complete
local system on Postgres, useful for development, review, and demoing the
UX without touching the real spreadsheets.

## Known follow-ups (not yet built)

Flagging these explicitly rather than leaving them silently unfinished:

- **Google Drive push-channel webhooks** — inbound sync is polling-based
  today (`pollDriveFolderMetadata()`, manual `POST /sync/now`), not
  webhook-driven. Deferred deliberately: it needs a public HTTPS callback
  URL and a renewal cron (Drive channels expire, ~24h max), and at this
  team's scale (60 rows, 11 people) polling is effectively indistinguishable
  from push. Revisit once/if the webhook receiver actually earns its
  complexity. See `docs/SYSTEM_SPEC.md` §1 for the shape it would take.
- **Password reset by email** — needs a transactional email provider
  (SES/SendGrid/etc.); the "Esqueci minha senha" link isn't wired up.
- **"Somente em Wi-Fi" / configurable auto-sync interval** — the original
  design mocked these as toggles; a real implementation needs
  network-aware service-worker logic, not just a stored preference.
- **Native push notifications on iOS** — the PWA gets web push on
  Android/desktop; iOS web push has real platform limits the design chat
  called out — a React Native wrapper is the documented fallback if that
  becomes a hard requirement.
- **Containerized deployment** — no Dockerfile included yet; "Build &
  deploy" above covers the plain Node/static-host path.
- **Automated tests** — the flows above were verified manually
  (API smoke tests + Playwright screenshots); there's no test suite yet.
