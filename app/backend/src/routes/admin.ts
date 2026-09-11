import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { prisma } from "../db.js";
import { requireActive, requireAdmin, requireAuth } from "../auth/middleware.js";

export const adminRouter = createAsyncRouter();

adminRouter.get("/pending-accounts", requireAuth, requireActive, requireAdmin, async (_req, res) => {
  const rows = await prisma.pendingAccountRequest.findMany({ where: { status: "pending" }, orderBy: { requestedAt: "desc" } });
  res.json(rows);
});

adminRouter.post("/pending-accounts/:id/approve", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const request = await prisma.pendingAccountRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "not_found" });

  await prisma.$transaction([
    prisma.pendingAccountRequest.update({ where: { id: request.id }, data: { status: "active" } }),
    prisma.user.updateMany({
      where: { email: request.email },
      data: { status: "active", approvedById: req.user!.id, approvedAt: new Date() },
    }),
  ]);
  res.json({ ok: true });
});

adminRouter.post("/pending-accounts/:id/reject", requireAuth, requireActive, requireAdmin, async (req, res) => {
  await prisma.pendingAccountRequest.update({ where: { id: req.params.id }, data: { status: "suspended" } });
  res.json({ ok: true });
});
