import rateLimit from "express-rate-limit";

/** General API traffic — generous, just a backstop against runaway clients/scripts. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

/** Login/register — the actual brute-force surface. Tight, and keyed so a
 * shared office IP (this whole team may sit behind one NAT) can't lock
 * itself out from one bad actor's attempts against a single account. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email || "").toLowerCase()}`,
  message: { error: "too_many_attempts" },
});
