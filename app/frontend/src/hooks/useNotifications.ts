import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../api/client";
import type { Notification } from "../api/types";
import { useSocket } from "../state/SocketContext";
import { useToast } from "../state/ToastContext";

export function useNotifications() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { flash } = useToast();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/notifications"),
  });

  useEffect(() => {
    if (!socket) return;
    const onNew = (n: Notification) => {
      queryClient.setQueryData<Notification[] | undefined>(["notifications"], (prev) => {
        if (!prev) return [n];
        if (prev.some((x) => x.id === n.id)) return prev; // dedupe — see the matching note in useSyncStatus.ts
        return [n, ...prev];
      });
      flash(n.title);
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [socket, queryClient, flash]);

  const notifications = query.data || [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return { ...query, notifications, unreadCount };
}
