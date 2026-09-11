import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";

export const notificationsRouter = createAsyncRouter();

notificationsRouter.get("/", requireAuth, requireActive, async (req, res) => {
  const notifs = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifs);
});

notificationsRouter.post("/:id/read", requireAuth, requireActive, async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

notificationsRouter.post("/read-all", requireAuth, requireActive, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});
