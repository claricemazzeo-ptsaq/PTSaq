import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";
import { GOAL_STATUS_PCT } from "../labels.js";
import { serializeDepartment } from "../serialize.js";

export const departmentsRouter = createAsyncRouter();

departmentsRouter.get("/", requireAuth, requireActive, async (_req, res) => {
  const depts = await prisma.department.findMany({ include: { goals: true } });
  res.json(
    depts.map((d) => {
      const pct = d.goals.length
        ? Math.round(d.goals.reduce((sum, g) => sum + GOAL_STATUS_PCT[g.status], 0) / d.goals.length)
        : 0;
      return { ...serializeDepartment(d), goalProgressPct: pct };
    }),
  );
});
