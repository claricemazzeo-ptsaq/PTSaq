import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";
import { serializeDocument } from "../serialize.js";
import { pollDriveFolderMetadata } from "../services/googleSync.js";
import { broadcast } from "../realtime/socket.js";
import { env } from "../env.js";

export const documentsRouter = createAsyncRouter();

documentsRouter.get("/", requireAuth, requireActive, async (req, res) => {
  const { scope, type, q } = req.query as { scope?: string; type?: string; q?: string };
  const where: Record<string, unknown> = {};
  if (scope && scope !== "all") where.departmentId = scope === "glo" ? null : scope;
  if (type && type !== "Todos") where.type = type;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const docs = await prisma.document.findMany({
    where,
    include: { links: true, pins: { where: { userId: req.user!.id } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(
    docs.map((d) =>
      serializeDocument(
        d,
        d.links.filter((l) => l.taskId).map((l) => l.taskId!),
        d.links.filter((l) => l.goalId).map((l) => l.goalId!),
        d.pins.length > 0,
      ),
    ),
  );
});

documentsRouter.get("/:id", requireAuth, requireActive, async (req, res) => {
  const d = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { links: true, pins: { where: { userId: req.user!.id } } },
  });
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json(
    serializeDocument(
      d,
      d.links.filter((l) => l.taskId).map((l) => l.taskId!),
      d.links.filter((l) => l.goalId).map((l) => l.goalId!),
      d.pins.length > 0,
    ),
  );
});

documentsRouter.post("/:id/pin", requireAuth, requireActive, async (req, res) => {
  await prisma.pinnedDocument.upsert({
    where: { userId_documentId: { userId: req.user!.id, documentId: req.params.id } },
    create: { userId: req.user!.id, documentId: req.params.id },
    update: {},
  });
  res.json({ ok: true, pinned: true });
});

documentsRouter.delete("/:id/pin", requireAuth, requireActive, async (req, res) => {
  await prisma.pinnedDocument
    .delete({ where: { userId_documentId: { userId: req.user!.id, documentId: req.params.id } } })
    .catch(() => void 0);
  res.json({ ok: true, pinned: false });
});

/** "Buscar documentos novos" — metadata-only refresh against the live Drive folder (mock mode: no-op, everything already reflects the seeded snapshot). */
documentsRouter.post("/refresh", requireAuth, requireActive, async (_req, res) => {
  broadcast("sync:status", { state: "pending" });
  try {
    const files = env.sheets.enabled ? await pollDriveFolderMetadata() : [];
    for (const f of files) {
      const existing = await prisma.document.findFirst({ where: { OR: [{ driveFileId: f.id }, { title: f.name }] } });
      if (existing) {
        await prisma.document.update({
          where: { id: existing.id },
          data: {
            driveFileId: f.id,
            driveUpdatedAt: f.modifiedTime ? new Date(f.modifiedTime) : existing.driveUpdatedAt,
            sizeBytes: f.size ? Number(f.size) : existing.sizeBytes,
          },
        });
      }
    }
    broadcast("sync:status", { state: "ok", at: new Date().toISOString() });
    res.json({ ok: true, mock: !env.sheets.enabled, matched: files.length });
  } catch (e) {
    broadcast("sync:status", { state: "ok", at: new Date().toISOString() });
    res.status(502).json({ error: "drive_poll_failed", message: (e as Error).message });
  }
});
