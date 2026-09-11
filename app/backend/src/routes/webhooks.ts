import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { TASK_STATUS_FROM_LABEL, GOAL_STATUS_FROM_LABEL } from "../labels.js";
import { checkDependencyUnlocks, recordAudit } from "../services/notify.js";
import { broadcast } from "../realtime/socket.js";

export const webhooksRouter = createAsyncRouter();

/**
 * Receives onEdit() pushes from a Google Apps Script bound to the two
 * source spreadsheets. This is the cheap alternative to Drive push-channel
 * webhooks (see docs/SYSTEM_SPEC.md §1) — no public-facing Google Cloud
 * resource to register, no channel-renewal cron, just this endpoint plus
 * a script trigger the sheet owner installs once (Extensions > Apps
 * Script > Triggers > On edit).
 *
 * Row resolution prefers `data.id_tarefa` (the stable Task/Goal id) when
 * the script can supply it — e.g. from a hidden helper column — over
 * spreadsheet_id + sheet_name + row_index, which is exactly the "row
 * index, not row key" fragility this whole design avoids elsewhere
 * (see googleSync.ts resolveCurrentRow()). The row/sheet fallback exists
 * for the common case where no such column exists yet.
 *
 * ETL discipline: unrecognized status strings are logged and skipped
 * rather than rejected outright — a note-only edit shouldn't be lost just
 * because a status cell held something this app doesn't recognize.
 */

const webhookSchema = z.object({
  spreadsheet_id: z.string().min(1),
  sheet_name: z.string().min(1),
  row_index: z.number().int().positive(),
  data: z.object({
    id_tarefa: z.string().optional(),
    status: z.string().optional(),
    observacao: z.string().optional(),
  }),
});

function matchesSheetRow(sheetCell: string | null, sheetName: string, rowIndex: number): boolean {
  if (!sheetCell) return false;
  const [cellSheetName, ref] = sheetCell.split("!");
  const m = /^[A-Z]+(\d+)$/.exec(ref || "");
  return cellSheetName === sheetName && !!m && Number(m[1]) === rowIndex;
}

webhooksRouter.post("/sheets", async (req, res) => {
  if (!env.webhookSecret) return res.status(501).json({ error: "webhook_not_configured" });
  const provided = req.header("X-PTSaq-Webhook-Secret");
  if (!provided || provided !== env.webhookSecret) return res.status(401).json({ error: "invalid_webhook_secret" });

  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[webhooks/sheets] rejected malformed payload:", parsed.error.flatten());
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  const { spreadsheet_id, sheet_name, row_index, data } = parsed.data;

  let task = data.id_tarefa ? await prisma.task.findUnique({ where: { id: data.id_tarefa } }) : null;
  let goal = !task && data.id_tarefa ? await prisma.goal.findUnique({ where: { id: data.id_tarefa } }) : null;

  if (!task && !goal) {
    const candidateTasks = await prisma.task.findMany({ where: { sheetCell: { not: null } } });
    task = candidateTasks.find((t) => matchesSheetRow(t.sheetCell, sheet_name, row_index)) || null;
    if (!task) {
      const candidateGoals = await prisma.goal.findMany({ where: { sheetCell: { not: null } } });
      goal = candidateGoals.find((g) => matchesSheetRow(g.sheetCell, sheet_name, row_index)) || null;
    }
  }

  if (!task && !goal) {
    console.warn(`[webhooks/sheets] no local row matched ${spreadsheet_id}/${sheet_name}!${row_index} (id_tarefa=${data.id_tarefa ?? "none"})`);
    return res.status(404).json({ error: "no_matching_row" });
  }

  const summaryParts: string[] = [];

  if (task) {
    const updateData: { status?: import("@prisma/client").TaskStatus; note?: string } = {};
    if (data.status !== undefined) {
      const mapped = TASK_STATUS_FROM_LABEL[data.status];
      if (mapped) {
        updateData.status = mapped;
        summaryParts.push(`status → ${data.status}`);
      } else {
        console.warn(`[webhooks/sheets] task ${task.id}: unrecognized status "${data.status}" — left untouched`);
      }
    }
    if (data.observacao !== undefined) {
      updateData.note = data.observacao;
      summaryParts.push("observação atualizada");
    }
    if (Object.keys(updateData).length === 0) {
      return res.json({ ok: true, matched: "task", id: task.id, applied: false });
    }

    const updated = await prisma.task.update({ where: { id: task.id }, data: updateData });
    await recordAudit({ taskId: task.id, origin: "google_sheets", summary: `Planilha: ${summaryParts.join(", ")}` });
    broadcast("task:external-update", { id: task.id });
    if (updateData.status === "executado") await checkDependencyUnlocks(task.id);
    return res.json({ ok: true, matched: "task", id: task.id, applied: true });
  }

  if (goal) {
    const updateData: { status?: import("@prisma/client").GoalStatus; note?: string } = {};
    if (data.status !== undefined) {
      const mapped = GOAL_STATUS_FROM_LABEL[data.status];
      if (mapped) {
        updateData.status = mapped;
        summaryParts.push(`status → ${data.status}`);
      } else {
        console.warn(`[webhooks/sheets] goal ${goal.id}: unrecognized status "${data.status}" — left untouched`);
      }
    }
    if (data.observacao !== undefined) {
      updateData.note = data.observacao;
      summaryParts.push("observação atualizada");
    }
    if (Object.keys(updateData).length === 0) {
      return res.json({ ok: true, matched: "goal", id: goal.id, applied: false });
    }

    await prisma.goal.update({ where: { id: goal.id }, data: updateData });
    await recordAudit({ goalId: goal.id, origin: "google_sheets", summary: `Planilha: ${summaryParts.join(", ")}` });
    broadcast("goal:external-update", { id: goal.id });
    return res.json({ ok: true, matched: "goal", id: goal.id, applied: true });
  }

  return res.status(404).json({ error: "no_matching_row" });
});
