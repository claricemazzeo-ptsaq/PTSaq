import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";
import { canEditRow, readOnlyReason } from "../auth/rbac.js";
import { serializeGoal } from "../serialize.js";
import { GOAL_STATUS_FROM_LABEL, GOAL_STATUS_PCT } from "../labels.js";
import { recordActivity, recordAudit } from "../services/notify.js";
import { writeGoalCells } from "../services/googleSync.js";
import { broadcast } from "../realtime/socket.js";
import { env } from "../env.js";

export const goalsRouter = createAsyncRouter();

goalsRouter.get("/", requireAuth, requireActive, async (req, res) => {
  const { department } = req.query as { department?: string };
  const where: Record<string, unknown> = {};
  if (department) where.departmentId = department;
  const goals = await prisma.goal.findMany({ where, include: { department: true }, orderBy: { id: "asc" } });
  res.json(goals.map((g) => serializeGoal(g, req.user!, g.department.short)));
});

goalsRouter.get("/:id", requireAuth, requireActive, async (req, res) => {
  const goal = await prisma.goal.findUnique({ where: { id: req.params.id }, include: { department: true } });
  if (!goal) return res.status(404).json({ error: "not_found" });
  const editable = canEditRow(req.user!, goal.departmentId, goal.ownerName);
  res.json({
    ...serializeGoal(goal, req.user!, goal.department.short),
    readOnlyReason: editable ? null : readOnlyReason(req.user!, goal.departmentId, goal.ownerName, goal.department.short),
  });
});

const patchSchema = z.object({
  status: z.enum(["A iniciar", "Em andamento", "Concluída", "Justificada"]).optional(),
  note: z.string().max(2000).nullable().optional(),
});

goalsRouter.patch("/:id", requireAuth, requireActive, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const goal = await prisma.goal.findUnique({ where: { id: req.params.id }, include: { department: true } });
  if (!goal) return res.status(404).json({ error: "not_found" });
  if (!canEditRow(req.user!, goal.departmentId, goal.ownerName)) {
    return res.status(403).json({ error: "read_only", reason: readOnlyReason(req.user!, goal.departmentId, goal.ownerName, goal.department.short) });
  }

  const data: { status?: typeof goal.status; note?: string | null } = {};
  const auditLines: string[] = [];
  if (parsed.data.status) {
    data.status = GOAL_STATUS_FROM_LABEL[parsed.data.status];
    auditLines.push(`mudou o status para ${parsed.data.status}`);
  }
  if (parsed.data.note !== undefined) {
    data.note = parsed.data.note;
    if (parsed.data.note) auditLines.push(`anotou "${parsed.data.note}"`);
  }

  const updated = await prisma.goal.update({ where: { id: goal.id }, data, include: { department: true } });
  for (const line of auditLines) {
    await recordAudit({ goalId: goal.id, userId: req.user!.id, origin: "app", summary: `${req.user!.name} ${line}` });
  }
  if (auditLines.length) await recordActivity(req.user!, `atualizou a meta ${goal.id} · ${goal.title}`);

  const queueItem = await prisma.syncQueueItem.create({
    data: {
      userId: req.user!.id,
      goalId: goal.id,
      label: `Meta ${goal.id} · ${goal.title}`,
      detail: "Status e percentual · Plano de Trabalho",
      state: env.sheets.enabled ? "enviando" : "na fila",
    },
  });
  broadcast("sync:queue", { op: "add", item: queueItem });

  if (updated.sheetCell) {
    writeGoalCells(updated.id, updated.sheetCell, updated.title, updated.status, GOAL_STATUS_PCT[updated.status])
      .then(async () => {
        await prisma.syncQueueItem.delete({ where: { id: queueItem.id } }).catch(() => void 0);
        broadcast("sync:queue", { op: "remove", id: queueItem.id });
      })
      .catch(async (e) => {
        console.error("[sync] writeGoalCells failed:", e);
        await prisma.syncQueueItem.delete({ where: { id: queueItem.id } }).catch(() => void 0);
        broadcast("sync:queue", { op: "remove", id: queueItem.id });
      });
  } else {
    await prisma.syncQueueItem.delete({ where: { id: queueItem.id } }).catch(() => void 0);
    broadcast("sync:queue", { op: "remove", id: queueItem.id });
  }

  res.json(serializeGoal(updated, req.user!, updated.department.short));
});

goalsRouter.get("/:id/audit", requireAuth, requireActive, async (req, res) => {
  const rows = await prisma.auditEntry.findMany({
    where: { goalId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(rows.map((r) => ({ id: r.id, summary: r.summary, origin: r.origin, when: r.createdAt })));
});
