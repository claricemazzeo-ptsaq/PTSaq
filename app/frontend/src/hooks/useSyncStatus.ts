import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SyncQueueItem, SyncStatus } from "../api/types";
import { useSocket } from "../state/SocketContext";
import { useOnlineStatus } from "./useOnlineStatus";

export type SyncState = "ok" | "pending" | "offline";

export function useSyncStatus() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [liveState, setLiveState] = useState<SyncState>("ok");

  const query = useQuery({
    queryKey: ["sync-status"],
    queryFn: () => api.get<SyncStatus>("/sync/status"),
    refetchInterval: 60_000, // mirrors "Sincronização automática · a cada 60s"
  });

  useEffect(() => {
    if (!socket) return;
    const onStatus = (payload: { state: SyncState }) => setLiveState(payload.state);
    const onQueue = (payload: { op: "add" | "remove"; item?: SyncQueueItem; id?: string }) => {
      queryClient.setQueryData<SyncStatus | undefined>(["sync-status"], (prev) => {
        if (!prev) return prev;
        if (payload.op === "add" && payload.item) {
          if (prev.queue.some((q) => q.id === payload.item!.id)) return prev; // dedupe — e.g. React StrictMode's double effect-mount in dev can otherwise double-register this listener
          return { ...prev, queue: [payload.item, ...prev.queue] };
        }
        if (payload.op === "remove" && payload.id) return { ...prev, queue: prev.queue.filter((q) => q.id !== payload.id) };
        return prev;
      });
    };
    // A row changed from the Sheets side (Apps Script webhook) rather than
    // through this app — invalidate so any open view picks it up live.
    const onTaskExternal = (payload: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["task", payload.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-audit", payload.id] });
    };
    const onGoalExternal = (payload: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["goal", payload.id] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    };
    socket.on("sync:status", onStatus);
    socket.on("sync:queue", onQueue);
    socket.on("task:external-update", onTaskExternal);
    socket.on("goal:external-update", onGoalExternal);
    return () => {
      socket.off("sync:status", onStatus);
      socket.off("sync:queue", onQueue);
      socket.off("task:external-update", onTaskExternal);
      socket.off("goal:external-update", onGoalExternal);
    };
  }, [socket, queryClient]);

  const queue = query.data?.queue || [];
  const state: SyncState = !online ? "offline" : queue.length > 0 ? "pending" : liveState;

  return { ...query, state, queue, live: query.data?.live ?? false, sheets: query.data?.sheets || [] };
}
