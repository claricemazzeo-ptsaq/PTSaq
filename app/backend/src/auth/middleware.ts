import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { SESSION_COOKIE, verifySession } from "./tokens.js";
import type { User } from "@prisma/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  const claims = verifySession(token);
  if (!claims) return next();
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (user) req.user = user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "not_authenticated" });
  next();
}

export function requireActive(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "not_authenticated" });
  if (req.user.status !== "active") {
    return res.status(403).json({ error: "account_not_active", status: req.user.status });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "admin_only" });
  }
  next();
}
