import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import { listPending, removePending, setState, onQueueChange, type PendingEdit } from "../lib/offlineQueue";
import { useToast } from "../state/ToastContext";

let flushing = false;

export function useOfflineQueue() {
  const [pending, setPending] = useState<PendingEdit[]>([]);
  const queryClient = useQueryClient();
  const { flash } = useToast();

  const refresh = useCallback(() => {
    listPending().then(setPending);
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = onQueueChange(refresh);
    return () => {
      unsubscribe();
    };
  }, [refresh]);

  const flush = useCallback(async () => {
    if (flushing || !navigator.onLine) return;
    flushing = true;
    try {
      const items = await listPending();
      for (const item of items) {
        await setState(item.key, "enviando");
        try {
          const path = item.kind === "task" ? `/tasks/${item.id}` : `/goals/${item.id}`;
          await api.patch(path, item.patch);
          await removePending(item.key);
          queryClient.invalidateQueries({ queryKey: [item.kind, item.id] });
          queryClient.invalidateQueries({ queryKey: [item.kind === "task" ? "tasks" : "goals"] });
        } catch (e) {
          if (!navigator.onLine || e instanceof TypeError) {
            // still offline (or just went back offline mid-flush) — leave it queued, stop for now
            await setState(item.key, "na fila");
            break;
          }
          // a real rejection from the server (read-only, conflict, validation) — retrying
          // won't help; drop it and tell the user rather than looping on it silently.
          const reason = e instanceof ApiError ? e.message : "erro desconhecido";
          await removePending(item.key);
          queryClient.invalidateQueries({ queryKey: [item.kind, item.id] });
          flash(`Não foi possível aplicar uma edição feita offline (${reason}). Reabra o item e refaça a alteração.`);
        }
      }
    } finally {
      flushing = false;
    }
  }, [queryClient, flash]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  return { pending, count: pending.length, flush };
}
