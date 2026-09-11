import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireActive, requireAuth } from "../auth/middleware.js";
import { serializeUser } from "../serialize.js";

export const meRouter = createAsyncRouter();

meRouter.get("/", requireAuth, requireActive, async (req, res) => {
  const dept = req.user!.departmentId ? await prisma.department.findUnique({ where: { id: req.user!.departmentId } }) : null;
  res.json({ user: serializeUser(req.user!), department: dept });
});

const patchSchema = z.object({
  availability: z.enum(["office", "field", "focus"]).optional(),
  notifyPush: z.boolean().optional(),
  offlineCacheMb: z.number().int().min(0).max(5000).optional(),
});

meRouter.patch("/", requireAuth, requireActive, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
  res.json({ user: serializeUser(user) });
});
