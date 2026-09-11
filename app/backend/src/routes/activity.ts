import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";

export const activityRouter = createAsyncRouter();

activityRouter.get("/", requireAuth, requireActive, async (req, res) => {
  const { mine } = req.query as { mine?: string };
  const where = mine === "true" ? { userId: req.user!.id } : {};
  const rows = await prisma.activityEntry.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  res.json(rows.map((r) => ({ id: r.id, who: r.user.name, what: r.summary, when: r.createdAt })));
});
