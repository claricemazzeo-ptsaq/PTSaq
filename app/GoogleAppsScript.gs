/**
 * PTSaq — Hub de Operações
 * Google Apps Script: onEdit → POST /webhooks/sheets
 *
 * Pushes a change made directly in "Painel Operacional" or "Plano de
 * Trabalho" to the backend the instant someone edits a Status or
 * Observações cell, instead of waiting for the app's own polling cycle.
 * This is the cheap alternative to Drive push-channel webhooks described
 * in docs/SYSTEM_SPEC.md §1 — no public Google Cloud resource to
 * register, no 24h channel-renewal cron, just this script plus the
 * receiver already built at backend/src/routes/webhooks.ts.
 *
 * ── INSTALLATION (run once, from the spreadsheet's own script editor) ──
 * 1. Open the spreadsheet → Extensions → Apps Script.
 * 2. Paste this whole file in, replacing any starter code.
 * 3. Set WEBHOOK_URL below to the backend's public URL
 *    (e.g. "https://api.ptsaq.example.org/webhooks/sheets").
 * 4. Select `setWebhookSecret` in the function dropdown → Run. Paste the
 *    exact same value the backend has in SHEETS_WEBHOOK_SECRET (see
 *    backend/.env.example — generate one with `openssl rand -hex 32` if
 *    it isn't set yet). Google will ask you to authorize the script the
 *    first time; accept.
 * 5. Select `installTrigger` → Run. This creates the installable "On
 *    edit" trigger this script needs — a bare `onEdit(e)` simple trigger
 *    is NOT allowed to call external URLs at all, which is why this
 *    two-step setup exists instead of just naming a function `onEdit`.
 * 6. Done. Edit a Status or Observações cell in either tracked sheet and
 *    the change reaches the app within about a second.
 *
 * To confirm it's wired up: Extensions → Apps Script → Executions shows
 * one run of `onEditInstallable` per tracked edit, with its outcome.
 *
 * ── COLUMN LAYOUT THIS EXPECTS ──
 * Mirrors the offsets backend/src/services/googleSync.ts writes back to:
 *   "Painel Operacional": A = Título, B = Status, C = Observações
 *   "Plano de Trabalho":  A = Título, B = Status, C = Observações, D = %
 * Edits anywhere else — including the % column, which the app derives
 * from Status and never reads back — are ignored.
 */

const WEBHOOK_URL = "https://YOUR-BACKEND-DOMAIN/webhooks/sheets"; // TODO: replace with the real deployed backend URL
const TRACKED_SHEETS = ["Painel Operacional", "Plano de Trabalho"];
const STATUS_COLUMN = 2; // B
const NOTE_COLUMN = 3; // C
const HEADER_ROW = 1;

/** Run once from the editor. Stores the shared secret in this script's own Properties, not in the file itself, so it isn't sitting in plain text if the script is ever copied or shared. */
function setWebhookSecret() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    "Segredo do webhook",
    "Cole o mesmo valor configurado em SHEETS_WEBHOOK_SECRET no backend:",
    ui.ButtonSet.OK_CANCEL,
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const secret = result.getResponseText().trim();
  if (!secret) {
    ui.alert("Nenhum valor informado — nada foi salvo.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty("SHEETS_WEBHOOK_SECRET", secret);
  ui.alert("Segredo salvo. Agora rode installTrigger (uma única vez).");
}

/** Run once from the editor. Safe to re-run — clears any trigger this script created before, so it never ends up with duplicates. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "onEditInstallable")
    .forEach((t) => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("onEditInstallable").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();

  SpreadsheetApp.getUi().alert("Gatilho instalado. Edições em Status/Observações agora avisam o app.");
}

function onEditInstallable(e) {
  try {
    handleEdit_(e);
  } catch (err) {
    // Never block the user's edit or pop up a dialog on every keystroke —
    // a failed push just gets logged. Check Extensions > Apps Script >
    // Executions if updates stop showing up live in the app.
    console.error("onEditInstallable failed: " + err);
  }
}

function handleEdit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  if (TRACKED_SHEETS.indexOf(sheetName) === -1) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row <= HEADER_ROW) return;
  if (col !== STATUS_COLUMN && col !== NOTE_COLUMN) return;

  const status = sheet.getRange(row, STATUS_COLUMN).getValue().toString().trim();
  const observacao = sheet.getRange(row, NOTE_COLUMN).getValue().toString().trim();

  const payload = {
    spreadsheet_id: e.source.getId(),
    sheet_name: sheetName,
    row_index: row,
    data: {
      status: status || undefined,
      observacao: observacao || undefined,
    },
  };
  const idTarefa = readIdTarefa_(sheet, row);
  if (idTarefa) payload.data.id_tarefa = idTarefa;

  sendWebhook_(payload);
}

/**
 * Optional: if a hidden column holds the stable Task/Goal id (e.g. "T7",
 * "2.4"), this sends it so the backend matches by id instead of by sheet
 * name + row number — see webhooks.ts. The current real sheets don't have
 * such a column, so this normally returns null, which is fine: the
 * backend's row-index fallback covers that case already.
 */
function readIdTarefa_(sheet, row) {
  const header = sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = header.findIndex((h) => h.toString().trim().toLowerCase() === "id_tarefa") + 1;
  if (idCol <= 0) return null;
  const value = sheet.getRange(row, idCol).getValue();
  return value ? value.toString().trim() : null;
}

function sendWebhook_(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty("SHEETS_WEBHOOK_SECRET");
  if (!secret) {
    console.error("SHEETS_WEBHOOK_SECRET not set — run setWebhookSecret() once first.");
    return;
  }
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: { "X-PTSaq-Webhook-Secret": secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code >= 300) {
    console.error("Webhook POST failed (" + code + "): " + response.getContentText());
  }
}
