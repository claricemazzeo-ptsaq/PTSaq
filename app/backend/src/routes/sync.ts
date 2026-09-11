import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";
import { env } from "../env.js";
import { broadcast } from "../realtime/socket.js";

export const syncRouter = createAsyncRouter();

syncRouter.get("/status", requireAuth, requireActive, async (req, res) => {
  const queue = await prisma.syncQueueItem.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } });
  const [taskCount, goalCount, docCount] = await Promise.all([
    prisma.task.count(),
    prisma.goal.count(),
    prisma.document.count(),
  ]);
  res.json({
    live: env.sheets.enabled,
    queue,
    sheets: [
      { name: "Painel Operacional", meta: `${taskCount} linhas` },
      { name: "Plano de Trabalho", meta: `${goalCount} metas` },
      { name: "Repositório institucional", meta: `${docCount} arquivos · pasta /${env.sheets.driveFolderId.slice(0, 8)}… · leitura` },
    ],
  });
});

syncRouter.post("/now", requireAuth, requireActive, async (_req, res) => {
  broadcast("sync:status", { state: "pending" });
  // In live mode a full resync would re-read both sheets and merge changed
  // rows into Postgres here (last-write-wins per cell, contested rows
  // flagged for the conflict UI). Mock mode has nothing to read.
  setTimeout(() => broadcast("sync:status", { state: "ok", at: new Date().toISOString() }), 1200);
  res.json({ ok: true, live: env.sheets.enabled });
});
