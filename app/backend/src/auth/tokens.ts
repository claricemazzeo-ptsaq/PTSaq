import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../env.js";

export interface SessionClaims {
  sub: string; // user id
}

const ACCESS_TOKEN_TTL = "15m";

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId } satisfies SessionClaims, env.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, env.jwtSecret) as SessionClaims;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "ptsaq_session";
export const REFRESH_COOKIE = "ptsaq_refresh";

const isProd = process.env.NODE_ENV === "production";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  maxAge: 15 * 60 * 1000, // matches ACCESS_TOKEN_TTL
  path: "/",
};

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  maxAge: REFRESH_TOKEN_TTL_MS,
  // Deliberately Path=/, matching the session cookie — not narrowed to
  // "/auth". A narrower path is evaluated by the browser against the URL
  // it thinks it's calling, which in dev is the frontend's /api/* proxy
  // prefix (Vite strips /api before forwarding to the backend) — a
  // Path=/auth cookie set by the backend then never matches the browser's
  // /api/auth/refresh request and silently never gets sent. Path scoping
  // isn't worth that fragility across dev proxies / prod reverse proxies;
  // httpOnly already keeps it off-limits to JS either way.
  path: "/",
};

/** Opaque, unguessable — not a JWT. Revocability lives in the DB row (RefreshToken.tokenHash), not in the token's own claims. */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
