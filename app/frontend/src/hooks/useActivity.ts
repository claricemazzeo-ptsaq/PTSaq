import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../api/client";
import type { ActivityRow } from "../api/types";
import { useSocket } from "../state/SocketContext";

export function useActivity(mine = false) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["activity", mine],
    queryFn: () => api.get<ActivityRow[]>(`/activity${mine ? "?mine=true" : ""}`),
  });

  useEffect(() => {
    if (!socket) return;
    const onNew = (row: ActivityRow) => {
      queryClient.setQueryData<ActivityRow[] | undefined>(["activity", mine], (prev) => {
        if (!prev) return prev;
        if (prev.some((r) => r.id === row.id)) return prev; // dedupe — see the matching note in useSyncStatus.ts
        return [row, ...prev].slice(0, 12);
      });
    };
    socket.on("activity:new", onNew);
    return () => {
      socket.off("activity:new", onNew);
    };
  }, [socket, queryClient, mine]);

  return query;
}
