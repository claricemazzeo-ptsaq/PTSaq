import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet } from "./Sheet";
import { useNotifications } from "../hooks/useNotifications";
import { api } from "../api/client";
import { relativeTime } from "../lib/theme";
import { useToast } from "../state/ToastContext";
import type { Notification } from "../api/types";

const TONE_COLOR: Record<Notification["tone"], string> = { alert: "var(--danger-fg)", good: "var(--ok-fg)", neutral: "var(--info-fg)" };
const TONE_BORDER: Record<Notification["tone"], string> = { alert: "var(--danger-border)", good: "#B9E8D6", neutral: "#C8DEEE" };

export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, unreadCount } = useNotifications();
  const queryClient = useQueryClient();
  const { flash } = useToast();
  const nav = useNavigate();

  async function openNotif(n: Notification) {
    await api.post(`/notifications/${n.id}/read`);
    queryClient.setQueryData<Notification[] | undefined>(["notifications"], (prev) =>
      prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
    onClose();
    if (n.taskId) nav(`/?open=task:${n.taskId}`);
    else if (n.documentId) nav(`/docs?doc=${n.documentId}`);
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    await api.post("/notifications/read-all");
    queryClient.setQueryData<Notification[] | undefined>(["notifications"], (prev) => prev?.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    flash("Todos os avisos marcados como lidos.");
  }

  return (
    <Sheet open={open} onClose={onClose} top={120} title="Avisos">
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {notifications.length === 0 && (
          <p style={{ margin: "20px 0", font: "400 12.5px/1.6 var(--font-body)", color: "var(--ink-muted-3)" }}>
            Nenhum aviso para você agora. Avisos chegam quando um item seu é bloqueado, quando uma dependência é liberada ou quando um prazo se aproxima.
          </p>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => openNotif(n)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: 14,
              borderRadius: 12,
              cursor: "pointer",
              display: "block",
              background: "var(--surface)",
              border: `1px solid ${n.readAt ? "var(--border-1)" : TONE_BORDER[n.tone]}`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ font: "500 10px var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase", color: TONE_COLOR[n.tone] }}>
                {n.kind === "bloqueio" ? "Bloqueio" : n.kind === "dependencia_liberada" ? "Dependência liberada" : n.kind === "prazo" ? "Prazo" : "Documento"}
              </span>
              <span style={{ font: "400 10.5px var(--font-mono)", color: "var(--ink-muted-4)" }}>{relativeTime(n.createdAt)}</span>
            </span>
            <span style={{ display: "block", font: "500 13.5px/1.4 var(--font-display)", color: "var(--ink)", marginTop: 8 }}>{n.title}</span>
            <span style={{ display: "block", font: "400 12px/1.5 var(--font-body)", color: "var(--ink-muted-2)", marginTop: 5 }}>{n.body}</span>
          </button>
        ))}
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          style={{
            width: "100%",
            minHeight: 44,
            border: "1px solid var(--border-4)",
            borderRadius: 11,
            background: "none",
            font: "500 12px var(--font-display)",
            color: unreadCount > 0 ? "var(--brand-blue)" : "var(--ink-muted-5)",
          }}
        >
          {unreadCount > 0 ? `Marcar todos como lidos (${unreadCount})` : "Nenhum aviso novo"}
        </button>
        <p style={{ margin: "6px 0 0", font: "400 10.5px/1.6 var(--font-body)", color: "var(--ink-muted-4)" }}>
          Os avisos chegam pelo mesmo canal em tempo real da sincronização. Cada pessoa recebe só o que é da sua frente ou do que depende dela.
        </p>
      </div>
    </Sheet>
  );
}
