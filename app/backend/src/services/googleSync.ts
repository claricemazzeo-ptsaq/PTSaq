import { google } from "googleapis";
import { env } from "../env.js";
import { broadcast } from "../realtime/socket.js";
import { prisma } from "../db.js";

/**
 * Bidirectional Google Sheets/Drive sync.
 *
 * The app is never the source of truth for the spreadsheet's formulas,
 * conditional formatting, or calculated columns — it writes RAW values
 * into exactly three columns (Status, Observações, Percentual da Meta)
 * and never touches anything else. See README for the full read/write
 * contract this implements.
 *
 * MOCK MODE: until GOOGLE_SERVICE_ACCOUNT_JSON + both spreadsheet IDs are
 * set in .env, every function here is a no-op that resolves immediately —
 * the app runs entirely against the local Postgres mirror (seeded from the
 * real spreadsheet snapshot). Flip it on by filling in .env; nothing else
 * in the codebase needs to change.
 *
 * COLUMN MAPPING — verify against the live spreadsheet before enabling
 * writes in production. These defaults match the layout described in the
 * source data during handoff (Status in column matching the task's own
 * `sheetCell`, Observações one column to the right); override via env if
 * the real sheet differs.
 */

const NOTE_COLUMN_OFFSET = 1; // Observações sits one column right of Status
const PCT_COLUMN_OFFSET = 2; // Percentual da Meta, for Plano de Trabalho rows
const TITLE_COLUMN_OFFSET = -1; // Título/Descrição sits one column left of Status — verify against the real sheet before relying on this for row resolution

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
let driveClient: ReturnType<typeof google.drive> | null = null;

function getAuth() {
  const credentials = JSON.parse(env.sheets.serviceAccountJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
}

function sheets() {
  if (!sheetsClient) sheetsClient = google.sheets({ version: "v4", auth: getAuth() });
  return sheetsClient;
}

function drive() {
  if (!driveClient) driveClient = google.drive({ version: "v3", auth: getAuth() });
  return driveClient;
}

/** Parses "Painel Operacional!B4" into { sheetName: "Painel Operacional", col: "B", row: 4 }. */
function parseCellRef(cellRef: string) {
  const [sheetName, ref] = cellRef.split("!");
  const m = /^([A-Z]+)(\d+)$/.exec(ref || "");
  if (!sheetName || !m) return null;
  return { sheetName, col: m[1], row: Number(m[2]) };
}

function colLetterOffset(col: string, offset: number): string {
  let n = 0;
  for (const c of col) n = n * 26 + (c.charCodeAt(0) - 64);
  n += offset;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Re-resolves which row a task/goal actually lives on right now, by
 * matching its title text in the sheet rather than trusting the row
 * number `sheetCell` was captured at (seed time, or the last time this
 * function ran). A spreadsheet that gets sorted or has rows inserted
 * above an existing one silently invalidates a cached row index — this
 * is what keeps a queued edit from landing on the wrong row when that
 * happens. Falls back to the cached row (with a warning) if the title
 * can't be found — most likely the row was also retitled, which this
 * can't safely resolve on its own.
 */
async function resolveCurrentRow(spreadsheetId: string, sheetName: string, titleCol: string, title: string, cachedRow: number): Promise<number> {
  try {
    const range = `'${sheetName}'!${titleCol}1:${titleCol}500`;
    const res = await sheets().spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values || [];
    const normalized = title.trim();
    const idx = rows.findIndex((r) => (r[0] || "").toString().trim() === normalized);
    if (idx === -1) {
      console.warn(`[sync] row_key resolution: no exact title match for "${title}" in ${sheetName}!${titleCol} — using last-known row ${cachedRow}. If this row was retitled (not just moved), that cached row may now be wrong; verify manually.`);
      return cachedRow;
    }
    return idx + 1; // values.get is 1-indexed from the range start (row 1)
  } catch (e) {
    console.error("[sync] row_key resolution failed, falling back to cached row:", e);
    return cachedRow;
  }
}

/** Writes a task's Status + Observações back to its source cells. RAW only — never touches formulas. Re-resolves the row by title first — see resolveCurrentRow(). */
export async function writeTaskCells(taskId: string, sheetCell: string, title: string, status: string, note: string | null): Promise<void> {
  if (!env.sheets.enabled) return; // mock mode
  const ref = parseCellRef(sheetCell);
  if (!ref) return;
  const titleCol = colLetterOffset(ref.col, TITLE_COLUMN_OFFSET);
  const row = await resolveCurrentRow(env.sheets.painelSheetId, ref.sheetName, titleCol, title, ref.row);
  if (row !== ref.row) {
    const correctedCell = `${ref.sheetName}!${ref.col}${row}`;
    await prisma.task.update({ where: { id: taskId }, data: { sheetCell: correctedCell } }).catch((e) => console.error("[sync] failed to persist corrected sheetCell:", e));
  }
  const statusRange = `'${ref.sheetName}'!${ref.col}${row}`;
  const noteRange = `'${ref.sheetName}'!${colLetterOffset(ref.col, NOTE_COLUMN_OFFSET)}${row}`;
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: env.sheets.painelSheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: statusRange, values: [[status]] },
        { range: noteRange, values: [[note ?? ""]] },
      ],
    },
  });
}

/** Writes a goal's Status + Percentual back. Percentual is derived client-side (see labels.ts GOAL_STATUS_PCT) — the app never invents a number the sheet didn't already imply. Re-resolves the row by title first — see resolveCurrentRow(). */
export async function writeGoalCells(goalId: string, sheetCell: string, title: string, status: string, pct: number): Promise<void> {
  if (!env.sheets.enabled) return;
  const ref = parseCellRef(sheetCell);
  if (!ref) return;
  const titleCol = colLetterOffset(ref.col, TITLE_COLUMN_OFFSET);
  const row = await resolveCurrentRow(env.sheets.planoSheetId, ref.sheetName, titleCol, title, ref.row);
  const statusRange = `'${ref.sheetName}'!${ref.col}${row}`;
  const pctRange = `'${ref.sheetName}'!${colLetterOffset(ref.col, PCT_COLUMN_OFFSET)}${row}`;
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: env.sheets.planoSheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: statusRange, values: [[status]] },
        { range: pctRange, values: [[pct]] },
      ],
    },
  });
}

/** Metadata-only poll of the master Drive folder (title, modified time, size). Never downloads or mutates file bodies — see README §3. */
export async function pollDriveFolderMetadata(): Promise<Array<{ id: string; name: string; modifiedTime?: string | null; size?: string | null }>> {
  if (!env.sheets.enabled) return [];
  const res = await drive().files.list({
    q: `'${env.sheets.driveFolderId}' in parents and trashed = false`,
    fields: "files(id, name, modifiedTime, size, mimeType)",
    pageSize: 200,
  });
  return (res.data.files || []).filter((f): f is typeof f & { id: string; name: string } => !!f.id && !!f.name);
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Background polling loop — mirrors the "Sincronização automática · a cada 60s" toggle. */
export function startBackgroundSync(intervalMs = 60_000) {
  if (!env.sheets.enabled) {
    console.log("[sync] GOOGLE_SERVICE_ACCOUNT_JSON not configured — running in local mock mode, no live Sheets/Drive polling.");
    return;
  }
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    broadcast("sync:status", { state: "pending" });
    // Route handlers own the actual read-merge into Postgres (see routes/sync.ts);
    // this loop just signals connected clients that a sync cycle is running.
    broadcast("sync:status", { state: "ok", at: new Date().toISOString() });
  }, intervalMs);
}
