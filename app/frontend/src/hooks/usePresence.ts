import { useEffect, useState } from "react";
import { useSocket } from "../state/SocketContext";
import { useAuth } from "../state/AuthContext";

/** Live "who else has this item open" — mirrors the prototype's presence banner. Never reports the viewer's own presence back to themselves. */
export function usePresence(itemId: string | null) {
  const socket = useSocket();
  const { user } = useAuth();
  const [presence, setPresence] = useState<{ who: string; where: string } | null>(null);

  useEffect(() => {
    setPresence(null);
    if (!socket || !itemId) return;
    socket.emit("presence:enter", itemId);
    const onUpdate = (payload: { itemId: string; who: string | null; where: string | null }) => {
      if (payload.itemId !== itemId) return;
      if (payload.who && payload.who === user?.name) return;
      setPresence(payload.who ? { who: payload.who, where: payload.where! } : null);
    };
    socket.on("presence:update", onUpdate);
    return () => {
      socket.emit("presence:leave", itemId);
      socket.off("presence:update", onUpdate);
    };
  }, [socket, itemId, user?.name]);

  return presence;
}
