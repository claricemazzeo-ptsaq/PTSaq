import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";
import { canEditRow, readOnlyReason } from "../auth/rbac.js";
import { serializeTask } from "../serialize.js";
import { TASK_STATUS_FROM_LABEL, TASK_STATUS_LABEL } from "../labels.js";
import { checkDependencyUnlocks, notifyBlocker, recordActivity, recordAudit } from "../services/notify.js";
import { writeTaskCells } from "../services/googleSync.js";
import { broadcast } from "../realtime/socket.js";
import { env } from "../env.js";

export const tasksRouter = createAsyncRouter();

tasksRouter.get("/", requireAuth, requireActive, async (req, res) => {
  const { department, mine } = req.query as { department?: string; mine?: string };
  const where: Record<string, unknown> = {};
  if (department) where.departmentId = department;
  if (mine === "true") {
    const firstName = req.user!.name.split(" ")[0];
    where.ownerName = { contains: firstName };
  }
  const tasks = await prisma.task.findMany({ where, include: { department: true }, orderBy: { id: "asc" } });
  res.json(tasks.map((t) => serializeTask(t, req.user!, t.department.short)));
});

tasksRouter.get("/:id", requireAuth, requireActive, async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { department: true } });
  if (!task) return res.status(404).json({ error: "not_found" });
  const editable = canEditRow(req.user!, task.departmentId, task.ownerName);
  res.json({
    ...serializeTask(task, req.user!, task.department.short),
    readOnlyReason: editable ? null : readOnlyReason(req.user!, task.departmentId, task.ownerName, task.department.short),
  });
});

const patchSchema = z.object({
  status: z.enum(["Não iniciado", "Em execução", "Executado"]).optional(),
  note: z.string().max(2000).nullable().optional(),
});

tasksRouter.patch("/:id", requireAuth, requireActive, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { department: true } });
  if (!task) return res.status(404).json({ error: "not_found" });
  if (!canEditRow(req.user!, task.departmentId, task.ownerName)) {
    return res.status(403).json({ error: "read_only", reason: readOnlyReason(req.user!, task.departmentId, task.ownerName, task.department.short) });
  }
  if (task.contested) {
    return res.status(409).json({ error: "conflict_pending", message: "Resolva o conflito de edição antes de continuar." });
  }

  const data: { status?: typeof task.status; note?: string | null } = {};
  const auditLines: string[] = [];
  if (parsed.data.status) {
    data.status = TASK_STATUS_FROM_LABEL[parsed.data.status];
    auditLines.push(`mudou o status para ${parsed.data.status}`);
  }
  if (parsed.data.note !== undefined) {
    data.note = parsed.data.note;
    if (parsed.data.note) auditLines.push(`anotou "${parsed.data.note}"`);
  }

  const updated = await prisma.task.update({ where: { id: task.id }, data, include: { department: true } });

  for (const line of auditLines) {
    await recordAudit({ taskId: task.id, userId: req.user!.id, origin: "app", summary: `${req.user!.name} ${line}` });
  }
  if (auditLines.length) {
    await recordActivity(req.user!, `mudou "${task.title.replace(/\.$/, "")}" ${parsed.data.status ? "para " + parsed.data.status : ""}`.trim());
  }

  // Write-back queue: applied locally immediately, confirmed against Sheets async.
  const queueItem = await prisma.syncQueueItem.create({
    data: {
      userId: req.user!.id,
      taskId: task.id,
      label: task.title,
      detail: `Status e observação · ${task.sheetCell || "Painel Operacional"}`,
      state: env.sheets.enabled ? "enviando" : "na fila",
    },
  });
  broadcast("sync:queue", { op: "add", item: queueItem });

  if (updated.sheetCell) {
    writeTaskCells(updated.id, updated.sheetCell, updated.title, TASK_STATUS_LABEL[updated.status], updated.note)
      .then(async () => {
        await prisma.syncQueueItem.delete({ where: { id: queueItem.id } }).catch(() => void 0);
        broadcast("sync:queue", { op: "remove", id: queueItem.id });
      })
      .catch(async (e) => {
        console.error("[sync] writeTaskCells failed:", e);
        await prisma.syncQueueItem.delete({ where: { id: queueItem.id } }).catch(() => void 0);
        broadcast("sync:queue", { op: "remove", id: queueItem.id });
      });
  } else {
    await prisma.syncQueueItem.delete({ where: { id: queueItem.id } }).catch(() => void 0);
    broadcast("sync:queue", { op: "remove", id: queueItem.id });
  }

  if (parsed.data.status === "Executado") {
    await checkDependencyUnlocks(task.id);
  }
  if (parsed.data.note && !parsed.data.status) {
    await notifyBlocker(task.id, req.user!, `${req.user!.name} anotou: "${parsed.data.note}"`);
  }

  res.json(serializeTask(updated, req.user!, updated.department.short));
});

const resolveSchema = z.object({ keep: z.enum(["mine", "sheet"]) });

tasksRouter.post("/:id/resolve-conflict", requireAuth, requireActive, async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { department: true } });
  if (!task) return res.status(404).json({ error: "not_found" });
  if (!task.contested) return res.status(400).json({ error: "no_conflict_pending" });
  if (!canEditRow(req.user!, task.departmentId, task.ownerName)) {
    return res.status(403).json({ error: "read_only", reason: readOnlyReason(req.user!, task.departmentId, task.ownerName, task.department.short) });
  }

  const finalStatus = parsed.data.keep === "sheet" && task.conflictSheetStatus ? task.conflictSheetStatus : task.status;
  const discardedLabel = parsed.data.keep === "sheet" ? task.status : task.conflictSheetStatus;

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { status: finalStatus, contested: false, conflictSheetStatus: null, conflictAt: null },
    include: { department: true },
  });

  await recordAudit({
    taskId: task.id,
    userId: req.user!.id,
    origin: "app",
    summary: `${req.user!.name} resolveu o conflito de edição · manteve "${TASK_STATUS_LABEL[finalStatus]}"${discardedLabel ? ` (versão descartada salva como comentário: "${TASK_STATUS_LABEL[discardedLabel]}")` : ""}`,
  });
  await recordActivity(req.user!, `resolveu um conflito de edição em "${task.title.replace(/\.$/, "")}"`);
  broadcast("task:conflict-resolved", { taskId: task.id });

  res.json(serializeTask(updated, req.user!, updated.department.short));
});

const depSchema = z.object({ blockedByTaskId: z.string() });

tasksRouter.post("/:id/dependency", requireAuth, requireActive, async (req, res) => {
  const parsed = depSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const task = await prisma.task.update({ where: { id: req.params.id }, data: { blockedByTaskId: parsed.data.blockedByTaskId } });
  await recordActivity(req.user!, `vinculou "${task.title.replace(/\.$/, "")}" a uma dependência`);
  res.json({ ok: true });
});

tasksRouter.delete("/:id/dependency", requireAuth, requireActive, async (req, res) => {
  await prisma.task.update({ where: { id: req.params.id }, data: { blockedByTaskId: null } });
  res.json({ ok: true });
});

tasksRouter.get("/:id/audit", requireAuth, requireActive, async (req, res) => {
  const rows = await prisma.auditEntry.findMany({
    where: { taskId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(rows.map((r) => ({ id: r.id, summary: r.summary, origin: r.origin, when: r.createdAt })));
});
