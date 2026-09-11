import { openDB, type IDBPDatabase } from "idb";

/**
 * Client-side offline write queue. Captures status/note edits made while
 * the device has no connectivity, so they aren't just lost to a failed
 * fetch, and replays them once the network comes back.
 *
 * Three states only, matching what the queue actually represents:
 *   'na fila'  — captured locally, not yet sent to our own server
 *   'enviando' — a flush attempt is in flight right now
 *   'gravado'  — the server accepted it (row updated in Postgres); the
 *                entry is removed right after, this state is transient
 *                and exists only for the UI's brief confirmation flash.
 *
 * Keyed by `${kind}:${id}` — the item's own stable id (Task.id / Goal.id),
 * never a row index or position. A second offline edit to the same item
 * overwrites (merges into) the first: only the latest edit per item is
 * ever queued, never a stack of them.
 */

export type PendingEditKind = "task" | "goal";

export interface PendingEditPatch {
  status?: string;
  note?: string | null;
}

export interface PendingEdit {
  key: string; // `${kind}:${id}`
  kind: PendingEditKind;
  id: string;
  patch: PendingEditPatch;
  state: "na fila" | "enviando" | "gravado";
  updatedAt: string;
  error?: string;
}

const DB_NAME = "ptsaq-offline";
const STORE = "pendingEdits";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

const listeners = new Set<() => void>();
export function onQueueChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  listeners.forEach((cb) => cb());
}

/** Queues an edit, merging into any already-pending edit for the same item (so two offline edits to the same row collapse into one, keeping the latest field values). */
export async function enqueueEdit(kind: PendingEditKind, id: string, patch: PendingEditPatch): Promise<void> {
  const db = await getDb();
  const key = `${kind}:${id}`;
  const existing = await db.get(STORE, key);
  const merged: PendingEdit = {
    key,
    kind,
    id,
    patch: { ...(existing?.patch || {}), ...patch },
    state: "na fila",
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE, merged);
  notify();
}

export async function listPending(): Promise<PendingEdit[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function setState(key: string, state: PendingEdit["state"], error?: string): Promise<void> {
  const db = await getDb();
  const row = await db.get(STORE, key);
  if (!row) return;
  await db.put(STORE, { ...row, state, error });
  notify();
}

export async function removePending(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, key);
  notify();
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || !navigator.onLine;
}
