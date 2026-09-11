import { prisma } from "../db.js";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "./tokens.js";

export async function issueRefreshToken(userId: string): Promise<string> {
  const { raw, hash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
  });
  return raw;
}

export type RefreshResult = { ok: true; userId: string; raw: string } | { ok: false; reason: "invalid" | "expired" | "reused" };

/**
 * Rotates a refresh token: the presented one is retired and a new one is
 * issued in its place. If the presented token was already retired (its
 * revokedAt is set), that's a replay — the same token being used twice
 * means it leaked, so every refresh token for that user is revoked,
 * forcing a real re-login everywhere.
 */
export async function rotateRefreshToken(rawToken: string): Promise<RefreshResult> {
  const hash = hashRefreshToken(rawToken);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!row) return { ok: false, reason: "invalid" };

  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, reason: "reused" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const next = generateRefreshToken();
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedById: next.hash } }),
    prisma.refreshToken.create({
      data: { userId: row.userId, tokenHash: next.hash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
    }),
  ]);
  return { ok: true, userId: row.userId, raw: next.raw };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const hash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}
