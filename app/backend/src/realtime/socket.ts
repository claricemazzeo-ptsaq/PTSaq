import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import cookie from "cookie";
import { SESSION_COOKIE, verifySession } from "../auth/tokens.js";
import { prisma } from "../db.js";
import { env } from "../env.js";

let io: SocketServer | null = null;

// item id ("T1", goal id, doc id) -> { userId, name, where }
const presence = new Map<string, { userId: string; name: string; where: "app" }>();

export function initRealtime(server: HttpServer) {
  io = new SocketServer(server, {
    cors: { origin: env.webOrigin, credentials: true },
  });

  // Reuses the same httpOnly session cookie the REST API sits behind —
  // there is no separate socket token to leak, and the cookie can't be
  // read by client JS regardless.
  io.use(async (socket, next) => {
    const raw = socket.handshake.headers.cookie ? cookie.parse(socket.handshake.headers.cookie) : {};
    const token = raw[SESSION_COOKIE];
    const claims = token ? verifySession(token) : null;
    if (!claims) return next(new Error("unauthorized"));
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.status !== "active") return next(new Error("unauthorized"));
    (socket.data as { userId: string; name: string }).userId = user.id;
    (socket.data as { userId: string; name: string }).name = user.name;
    next();
  });

  io.on("connection", (socket) => {
    const { userId, name } = socket.data as { userId: string; name: string };
    socket.join(`user:${userId}`);

    socket.on("presence:enter", (itemId: string) => {
      if (typeof itemId !== "string") return;
      presence.set(itemId, { userId, name, where: "app" });
      io?.emit("presence:update", { itemId, who: name, where: "no aplicativo" });
    });
    socket.on("presence:leave", (itemId: string) => {
      if (presence.get(itemId)?.userId === userId) {
        presence.delete(itemId);
        io?.emit("presence:update", { itemId, who: null, where: null });
      }
    });
    socket.on("disconnect", () => {
      for (const [itemId, p] of presence) {
        if (p.userId === userId) {
          presence.delete(itemId);
          io?.emit("presence:update", { itemId, who: null, where: null });
        }
      }
    });
  });

  return io;
}

export function getPresence(itemId: string) {
  return presence.get(itemId) || null;
}

/** Push a notification to one user's connected devices in real time. */
export function pushToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Broadcast to everyone — used for dashboard activity feed / sync status. */
export function broadcast(event: string, payload: unknown) {
  io?.emit(event, payload);
}
