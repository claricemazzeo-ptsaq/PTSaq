import { useState } from "react";
import { useResolveConflict } from "../hooks/useTasks";
import { formatDateTime } from "../lib/theme";
import { useToast } from "../state/ToastContext";
import type { Task } from "../api/types";

export function ConflictModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [pick, setPick] = useState<"mine" | "sheet">("mine");
  const resolve = useResolveConflict();
  const { flash } = useToast();

  async function confirm() {
    await resolve.mutateAsync({ id: task.id, keep: pick });
    flash("Conflito resolvido · versão anterior salva como comentário.");
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 240, background: "rgba(20,32,28,.52)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--brand-paper)", borderRadius: 18, overflow: "hidden", animation: "rise .22s ease-out" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 18px", background: "var(--danger-dot)", color: "var(--brand-paper)" }}>
          <div style={{ font: "500 10.5px var(--font-mono)", letterSpacing: ".07em", textTransform: "uppercase", opacity: 0.9 }}>Conflito de edição</div>
          <div style={{ font: "600 17px/1.3 var(--font-display)", marginTop: 5 }}>A mesma célula mudou nos dois lados</div>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <p style={{ margin: "0 0 14px", font: "400 12.5px/1.55 var(--font-body)", color: "var(--ink-muted-1)" }}>
            <strong style={{ fontWeight: 500 }}>{task.title}</strong> · coluna <span style={{ fontFamily: "var(--font-mono)" }}>Status</span>
            {task.sheetCell ? ` (${task.sheetCell.split("!")[1]})` : ""}. {task.conflictAt ? `Detectado em ${formatDateTime(task.conflictAt)}.` : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <button
              onClick={() => setPick("mine")}
              style={{ textAlign: "left", padding: "13px 14px", borderRadius: 12, background: "var(--surface)", border: `2px solid ${pick === "mine" ? "var(--brand-green)" : "var(--border-3)"}` }}
            >
              <span style={{ display: "block", font: "500 10.5px var(--font-mono)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Sua versão</span>
              <span style={{ display: "block", font: "500 14px var(--font-display)", color: "var(--ink)", marginTop: 6 }}>{task.status}</span>
              <span style={{ display: "block", font: "400 11px var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>no aplicativo</span>
            </button>
            <button
              onClick={() => setPick("sheet")}
              style={{ textAlign: "left", padding: "13px 14px", borderRadius: 12, background: "var(--surface)", border: `2px solid ${pick === "sheet" ? "var(--brand-green)" : "var(--border-3)"}` }}
            >
              <span style={{ display: "block", font: "500 10.5px var(--font-mono)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Planilha</span>
              <span style={{ display: "block", font: "500 14px var(--font-display)", color: "var(--ink)", marginTop: 6 }}>{task.conflictSheetStatus}</span>
              <span style={{ display: "block", font: "400 11px var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>Google Sheets</span>
            </button>
          </div>
          <button
            onClick={confirm}
            disabled={resolve.isPending}
            style={{ marginTop: 14, width: "100%", minHeight: 52, border: 0, borderRadius: 12, background: "var(--ink)", color: "var(--brand-paper)", font: "500 13px var(--font-display)" }}
          >
            {pick === "mine" ? `Manter "${task.status}" e sobrescrever` : `Aceitar "${task.conflictSheetStatus}" da planilha`}
          </button>
          <p style={{ margin: "12px 0 0", font: "400 10.5px/1.5 var(--font-body)", color: "var(--ink-muted-5)" }}>A versão descartada fica no histórico da célula como comentário, com autor e horário.</p>
        </div>
      </div>
    </div>
  );
}
