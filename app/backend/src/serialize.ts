import type { Department, Document, Goal, Task, User } from "@prisma/client";
import { DOC_STATUS_LABEL, GOAL_STATUS_LABEL, GOAL_STATUS_PCT, TASK_STATUS_LABEL } from "./labels.js";
import { canEditRow } from "./auth/rbac.js";

export function serializeUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: u.title,
    departmentId: u.departmentId,
    status: u.status,
    availability: u.availability,
    notifyPush: u.notifyPush,
    offlineCacheMb: u.offlineCacheMb,
  };
}

export function serializeDepartment(d: Department) {
  return { id: d.id, short: d.short, name: d.name };
}

export function serializeTask(t: Task, viewer: Pick<User, "role" | "departmentId" | "name">, departmentShort: string) {
  const dueDays = t.dueDate ? Math.ceil((t.dueDate.getTime() - Date.now()) / 86400000) : null;
  return {
    id: t.id,
    kind: "task" as const,
    departmentId: t.departmentId,
    departmentShort,
    frente: t.frente,
    title: t.title,
    owner: t.ownerName,
    status: TASK_STATUS_LABEL[t.status],
    dueDate: t.dueDate,
    dueDays,
    budgetCents: t.budgetCents,
    note: t.note,
    contested: t.contested,
    conflictSheetStatus: t.conflictSheetStatus ? TASK_STATUS_LABEL[t.conflictSheetStatus] : null,
    conflictAt: t.conflictAt,
    goalId: t.goalId,
    sheetCell: t.sheetCell,
    blockedByTaskId: t.blockedByTaskId,
    canEdit: canEditRow(viewer, t.departmentId, t.ownerName),
  };
}

export function serializeGoal(g: Goal, viewer: Pick<User, "role" | "departmentId" | "name">, departmentShort: string) {
  return {
    id: g.id,
    kind: "goal" as const,
    departmentId: g.departmentId,
    departmentShort,
    title: g.title,
    owner: g.ownerName,
    schedule: g.schedule,
    status: GOAL_STATUS_LABEL[g.status],
    pct: GOAL_STATUS_PCT[g.status],
    dueDate: g.dueDate,
    flag: g.flag,
    note: g.note,
    sheetCell: g.sheetCell,
    canEdit: canEditRow(viewer, g.departmentId, g.ownerName),
  };
}

export function serializeDocument(d: Document, linkedTaskIds: string[], linkedGoalIds: string[], pinned: boolean) {
  return {
    id: d.id,
    driveFileId: d.driveFileId,
    departmentId: d.departmentId,
    type: d.type,
    title: d.title,
    version: d.version,
    sizeBytes: d.sizeBytes,
    status: DOC_STATUS_LABEL[d.status],
    note: d.note,
    driveUpdatedAt: d.driveUpdatedAt,
    linkedTaskIds,
    linkedGoalIds,
    pinned,
  };
}
