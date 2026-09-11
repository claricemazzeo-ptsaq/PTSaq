export type Role = "admin" | "lead" | "contrib";
export type AccountStatus = "pending" | "active" | "suspended";
export type Availability = "office" | "field" | "focus";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  departmentId: string | null;
  status: AccountStatus;
  availability: Availability;
  notifyPush: boolean;
  offlineCacheMb: number;
}

export interface Department {
  id: string;
  short: string;
  name: string;
  goalProgressPct?: number;
}

export interface Task {
  id: string;
  kind: "task";
  departmentId: string;
  departmentShort: string;
  frente: string;
  title: string;
  owner: string;
  status: "Não iniciado" | "Em execução" | "Executado" | "Justificada";
  dueDate: string | null;
  dueDays: number | null;
  budgetCents: number | null;
  note: string | null;
  contested: boolean;
  conflictSheetStatus: string | null;
  conflictAt: string | null;
  goalId: string | null;
  sheetCell: string | null;
  blockedByTaskId: string | null;
  canEdit: boolean;
  readOnlyReason?: string | null;
}

export interface Goal {
  id: string;
  kind: "goal";
  departmentId: string;
  departmentShort: string;
  title: string;
  owner: string;
  schedule: string | null;
  status: "A iniciar" | "Em andamento" | "Concluída" | "Justificada";
  pct: number;
  dueDate: string | null;
  flag: string | null;
  note: string | null;
  sheetCell: string | null;
  canEdit: boolean;
  readOnlyReason?: string | null;
}

export interface Document {
  id: string;
  driveFileId: string | null;
  departmentId: string | null;
  type: string;
  title: string;
  version: string | null;
  sizeBytes: number | null;
  status: "Aprovado" | "Em revisão" | "Aguardando assinatura";
  note: string | null;
  driveUpdatedAt: string | null;
  linkedTaskIds: string[];
  linkedGoalIds: string[];
  pinned: boolean;
}

export interface Notification {
  id: string;
  kind: "bloqueio" | "dependencia_liberada" | "prazo" | "documento";
  tone: "alert" | "good" | "neutral";
  title: string;
  body: string;
  taskId: string | null;
  documentId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditRow {
  id: string;
  summary: string;
  origin: "app" | "google_sheets";
  when: string;
}

export interface ActivityRow {
  id: string;
  who: string;
  what: string;
  when: string;
}

export interface SyncQueueItem {
  id: string;
  label: string;
  detail: string | null;
  state: string;
  createdAt: string;
}

export interface SyncStatus {
  live: boolean;
  queue: SyncQueueItem[];
  sheets: { name: string; meta: string }[];
}

export interface PendingAccountRequest {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  requestedAt: string;
}
