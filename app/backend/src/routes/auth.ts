import { createAsyncRouter } from "../middleware/asyncRouter.js";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { cookieOptions, refreshCookieOptions, REFRESH_COOKIE, SESSION_COOKIE, signSession } from "../auth/tokens.js";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from "../auth/refreshTokens.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { env } from "../env.js";
import { buildAuthUrl, exchangeCodeForIdentity } from "../auth/google.js";
import { serializeUser } from "../serialize.js";

export const authRouter = createAsyncRouter();

function callbackUrl(req: import("express").Request) {
  return `${req.protocol}://${req.get("host")}/auth/google/callback`;
}

async function issueSession(res: import("express").Response, userId: string) {
  const accessToken = signSession(userId);
  const refreshToken = await issueRefreshToken(userId);
  res.cookie(SESSION_COOKIE, accessToken, cookieOptions);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  departmentId: z.enum(["com", "jur", "tec", "adm"]),
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const { name, email, password, departmentId } = parsed.data;
  if (env.google.allowedDomain && !email.endsWith(`@${env.google.allowedDomain}`)) {
    return res.status(400).json({ error: "domain_not_allowed" });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "email_taken" });

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.create({
      data: { name, email, passwordHash, departmentId, role: "contrib", status: "pending" },
    }),
    prisma.pendingAccountRequest.create({ data: { name, email, departmentId } }),
  ]);
  res.status(201).json({ status: "pending" });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
  if (user.status === "pending") return res.status(403).json({ error: "account_pending" });
  if (user.status === "suspended") return res.status(403).json({ error: "account_suspended" });

  await issueSession(res, user.id);
  res.json({ user: serializeUser(user) });
});

/** Access tokens are short-lived (15 min) by design — the frontend calls this on a 401 or a proactive timer to get a fresh one without forcing a full re-login. */
authRouter.post("/refresh", async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return res.status(401).json({ error: "no_refresh_token" });

  const result = await rotateRefreshToken(raw);
  if (!result.ok) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    return res.status(401).json({ error: result.reason === "reused" ? "refresh_token_reused" : "refresh_token_invalid" });
  }

  const accessToken = signSession(result.userId);
  res.cookie(SESSION_COOKIE, accessToken, cookieOptions);
  res.cookie(REFRESH_COOKIE, result.raw, refreshCookieOptions);
  res.json({ ok: true });
});

authRouter.post("/logout", async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await revokeRefreshToken(raw);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/google", (req, res) => {
  if (!env.google.enabled) return res.status(501).json({ error: "google_oauth_not_configured" });
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("g_state", state, { ...cookieOptions, maxAge: 5 * 60 * 1000 });
  res.redirect(buildAuthUrl(callbackUrl(req), state));
});

authRouter.get("/google/callback", async (req, res) => {
  if (!env.google.enabled) return res.status(501).send("Google OAuth not configured");
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state || state !== req.cookies?.g_state) {
    return res.redirect(`${env.webOrigin}/login?error=google_state_mismatch`);
  }
  try {
    const identity = await exchangeCodeForIdentity(callbackUrl(req), code);
    let user = await prisma.user.findFirst({ where: { OR: [{ googleSub: identity.sub }, { email: identity.email }] } });
    if (!user) {
      user = await prisma.user.create({
        data: { name: identity.name, email: identity.email, googleSub: identity.sub, role: "contrib", status: "pending" },
      });
      await prisma.pendingAccountRequest.create({
        data: { name: identity.name, email: identity.email, departmentId: "adm" },
      }).catch(() => void 0);
    } else if (!user.googleSub) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleSub: identity.sub } });
    }
    if (user.status !== "active") {
      return res.redirect(`${env.webOrigin}/pending`);
    }
    await issueSession(res, user.id);
    res.redirect(env.webOrigin);
  } catch (e) {
    res.redirect(`${env.webOrigin}/login?error=${encodeURIComponent((e as Error).message)}`);
  }
});
