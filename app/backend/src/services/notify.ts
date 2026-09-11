import { prisma } from "../db.js";
import { pushToUser, broadcast } from "../realtime/socket.js";
import type { SyncOrigin, User } from "@prisma/client";

export async function recordAudit(opts: { taskId?: string; goalId?: string; userId?: string; origin: SyncOrigin; summary: string }) {
  await prisma.auditEntry.create({ data: opts });
}

export async function recordActivity(user: User, summary: string) {
  const entry = await prisma.activityEntry.create({
    data: { userId: user.id, departmentId: user.departmentId, summary },
  });
  broadcast("activity:new", { id: entry.id, who: user.name, what: summary, when: entry.createdAt });
}

/**
 * Mirrors the prototype's unlockCheck(): when a task moves to "executado",
 * find every task that names it as their blocker, notify each blocked
 * task's owner in real time, and record the unlock notification.
 */
export async function checkDependencyUnlocks(completedTaskId: string) {
  const freed = await prisma.task.findMany({ where: { blockedByTaskId: completedTaskId } });
  if (!freed.length) return [];
  const source = await prisma.task.findUnique({ where: { id: completedTaskId } });
  if (!source) return [];

  for (const task of freed) {
    const owner = task.ownerId ? await prisma.user.findUnique({ where: { id: task.ownerId } }) : null;
    const title = task.title.replace(/\.$/, "");
    const sourceTitle = source.title.replace(/\.$/, "");
    if (owner) {
      const n = await prisma.notification.create({
        data: {
          kind: "dependencia_liberada",
          tone: "good",
          title: `"${sourceTitle}" foi concluída`,
          body: `Com isso, "${title}" está liberada para começar.`,
          userId: owner.id,
          taskId: task.id,
        },
      });
      pushToUser(owner.id, "notification:new", n);
    }
    broadcast("task:unlocked", { taskId: task.id, blockerId: completedTaskId });
  }
  return freed;
}

/** Fires a "Blocker Alert" — a task's status moved to a blocked/justified state. */
export async function notifyBlocker(taskId: string, actor: User, detail: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  const recipients = new Set<string>();
  if (task.ownerId) recipients.add(task.ownerId);
  const leadsAndAdmins = await prisma.user.findMany({
    where: { status: "active", OR: [{ role: "admin" }, { role: "lead", departmentId: task.departmentId }] },
  });
  for (const u of leadsAndAdmins) recipients.add(u.id);

  for (const userId of recipients) {
    const n = await prisma.notification.create({
      data: {
        kind: "bloqueio",
        tone: "alert",
        title: `"${task.title.replace(/\.$/, "")}" foi marcada como bloqueada`,
        body: detail,
        userId,
        taskId: task.id,
      },
    });
    pushToUser(userId, "notification:new", n);
  }
}
