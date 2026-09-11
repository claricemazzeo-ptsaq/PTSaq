import { useNavigate } from "react-router-dom";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { useOfflineQueue } from "../hooks/useOfflineQueue";

const STATE_STYLE = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-dot)" },
  pending: { bg: "var(--warn-bg)", fg: "var(--warn-fg)", dot: "var(--warn-dot)" },
  offline: { bg: "var(--neutral-bg)", fg: "var(--ink-muted-1)", dot: "var(--neutral-dot)" },
};

export function SyncStatusBar() {
  const nav = useNavigate();
  const { state } = useSyncStatus();
  // While offline, the server-side queue is whatever it was as of the last
  // successful fetch — stale by definition. The client-side offline queue
  // (captured locally, not yet even sent) is the number that's actually true.
  const { count: offlineCount } = useOfflineQueue();
  const s = STATE_STYLE[state];
  const text =
    state === "offline"
      ? `Offline · ${offlineCount} na fila`
      : state === "pending"
        ? "Sincronizando com o Drive…"
        : "Ao vivo · SSE conectado";

  return (
    <button
      onClick={() => nav("/perfil")}
      style={{
        width: "100%",
        height: 26,
        border: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "0 20px",
        whiteSpace: "nowrap",
        font: "500 10.5px/1 var(--font-mono)",
        letterSpacing: ".02em",
        background: s.bg,
        color: s.fg,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          animation: state !== "offline" ? `pulsedot ${state === "pending" ? "1s" : "3s"} infinite` : undefined,
        }}
      />
      <span style={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </button>
  );
}
