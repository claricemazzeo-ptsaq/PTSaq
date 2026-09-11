import { useState } from "react";
import { useAuth } from "../state/AuthContext";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { useTasks } from "../hooks/useTasks";
import { useUpdateMePrefs } from "../hooks/useMe";
import { api } from "../api/client";
import { useToast } from "../state/ToastContext";
import { ConflictModal } from "../components/ConflictModal";
import { formatDateTime } from "../lib/theme";
import { useQueryClient } from "@tanstack/react-query";

export function Profile() {
  const { user, department, logout } = useAuth();
  const { state, queue, sheets, live } = useSyncStatus();
  const { pending: offlineQueue, count: offlineCount, flush: flushOfflineQueue } = useOfflineQueue();
  const { data: tasks = [] } = useTasks();
  const updatePrefs = useUpdateMePrefs();
  const { flash } = useToast();
  const queryClient = useQueryClient();
  const [conflictTaskId, setConflictTaskId] = useState<string | null>(null);

  const contested = tasks.filter((t) => t.contested);
  const conflictTask = conflictTaskId ? contested.find((t) => t.id === conflictTaskId) : null;

  async function syncNow() {
    await api.post("/sync/now");
    flash("Lendo as duas planilhas…");
  }

  if (!user) return null;

  return (
    <div style={{ padding: "18px 20px 28px" }}>
      <div style={{ font: "400 11px var(--font-body)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Conta</div>
      <h1 style={{ margin: "8px 0 14px", font: "600 25px/1.15 var(--font-display)", letterSpacing: "-.4px" }}>Perfil e ajustes</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-1)", marginBottom: 12 }}>
        <span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: "var(--brand-blue)", color: "var(--brand-paper)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 17px var(--font-display)" }}>
          {user.name.charAt(0)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", font: "500 14px/1.25 var(--font-display)", color: "var(--ink)" }}>{user.name}</span>
          <span style={{ display: "block", font: "400 11px/1.45 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>
            {user.title} · {department ? department.short : "Todas as frentes"}
          </span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 26 }}>
        <button onClick={logout} style={{ flex: 1, minHeight: 48, border: "1px solid var(--border-4)", borderRadius: 11, background: "none", color: "var(--danger-fg)", font: "500 12px var(--font-display)" }}>
          Sair
        </button>
      </div>

      <div style={{ font: "400 11px var(--font-body)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Origem dos dados</div>
      <h2 style={{ margin: "8px 0 16px", font: "600 18px/1.2 var(--font-display)", letterSpacing: "-.3px" }}>Sincronização</h2>

      <div
        style={{
          padding: "15px 16px",
          borderRadius: 12,
          background: state === "offline" ? "var(--surface-sunken)" : state === "pending" ? "var(--warn-bg)" : "var(--ok-bg)",
          color: state === "offline" ? "var(--ink-muted-1)" : state === "pending" ? "var(--warn-fg)" : "var(--ok-fg)",
        }}
      >
        <div style={{ font: "500 13px/1.4 var(--font-display)" }}>{state === "offline" ? "Sem conexão" : state === "pending" ? "Enviando alterações" : "Tudo sincronizado"}</div>
        <div style={{ font: "400 11.5px/1.5 var(--font-body)", marginTop: 4, opacity: 0.85 }}>
          {state === "offline"
            ? `Você está lendo o último cache local. ${offlineCount} edição(ões) aguardando rede.`
            : queue.length
              ? `${queue.length} edição(ões) a caminho da planilha.`
              : `Nada pendente de envio. ${live ? "Sincronização ao vivo com o Google Sheets." : "Rodando em modo local (sem credenciais do Google configuradas)."}`}
        </div>
      </div>

      {offlineQueue.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px" }}>
            <h2 style={{ margin: 0, font: "600 15px var(--font-display)" }}>Fila local (offline)</h2>
            <button onClick={flushOfflineQueue} style={{ minHeight: 32, padding: "0 10px", border: 0, background: "none", color: "var(--brand-blue)", font: "500 11px var(--font-display)" }}>
              Tentar agora
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {offlineQueue.map((item) => (
              <div key={item.key} style={{ padding: "12px 13px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border-4)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 26, height: 26, flex: "none", borderRadius: 7, background: "var(--surface-sunken)", color: "var(--ink-muted-1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                  {item.kind === "task" ? "T" : "M"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)" }}>
                    {item.kind === "task" ? "Tarefa" : "Meta"} {item.id}
                  </span>
                  <span style={{ display: "block", font: "400 11px/1.45 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>
                    {item.patch.status ? `Status: ${item.patch.status}` : ""}
                    {item.patch.status && item.patch.note !== undefined ? " · " : ""}
                    {item.patch.note !== undefined ? "observação alterada" : ""}
                  </span>
                </span>
                <span style={{ font: "400 10.5px var(--font-mono)", color: "var(--ink-muted-4)" }}>{item.state}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", font: "400 10.5px/1.55 var(--font-body)", color: "var(--ink-muted-5)" }}>
            Capturado neste aparelho enquanto offline — ainda não chegou ao servidor. Sobe sozinho ao reconectar.
          </p>
        </>
      )}

      <div style={{ marginTop: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-1)", overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border-1)" }}>
          <div style={{ font: "500 12.5px var(--font-display)" }}>Planilhas conectadas</div>
        </div>
        {sheets.map((s) => (
          <div key={s.name} style={{ padding: "13px 14px", borderBottom: "1px solid var(--border-1)", display: "flex", alignItems: "center", gap: 11 }}>
            <span style={{ width: 30, height: 30, flex: "none", borderRadius: 7, background: "var(--ok-bg)", display: "flex", alignItems: "center", justifyContent: "center", font: "500 12px var(--font-mono)", color: "var(--ok-fg)" }}>▦</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "500 12.5px/1.3 var(--font-display)" }}>{s.name}</span>
              <span style={{ display: "block", font: "400 11px/1.4 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 2 }}>{s.meta}</span>
            </span>
          </div>
        ))}
        <button onClick={syncNow} style={{ width: "100%", minHeight: 48, border: 0, background: "var(--brand-green)", color: "#08281f", font: "500 13px var(--font-display)" }}>
          Sincronizar agora
        </button>
      </div>

      <h2 style={{ margin: "22px 0 10px", font: "600 15px var(--font-display)" }}>Notificações</h2>
      <div style={{ borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-1)", overflow: "hidden" }}>
        <button
          onClick={() => updatePrefs.mutate({ notifyPush: !user.notifyPush })}
          style={{ width: "100%", minHeight: 56, padding: "12px 14px", border: 0, background: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left" }}
        >
          <span>
            <span style={{ display: "block", font: "500 12.5px var(--font-display)", color: "var(--ink)" }}>Avisos push</span>
            <span style={{ display: "block", font: "400 11px/1.4 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>Bloqueios, dependências liberadas e prazos</span>
          </span>
          <span style={{ width: 44, height: 26, flex: "none", borderRadius: 13, padding: 3, display: "flex", transition: ".18s", background: user.notifyPush ? "var(--brand-green)" : "#D5D2C4", justifyContent: user.notifyPush ? "flex-end" : "flex-start" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", display: "block" }} />
          </span>
        </button>
      </div>

      <h2 style={{ margin: "22px 0 10px", font: "600 15px var(--font-display)" }}>Fila de envio</h2>
      {queue.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {queue.map((q) => (
            <div key={q.id} style={{ padding: "12px 13px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--warn-border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 26, height: 26, flex: "none", borderRadius: 7, background: "var(--warn-bg)", color: "var(--warn-fg-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>↑</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)" }}>{q.label}</span>
                <span style={{ display: "block", font: "400 11px/1.45 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>{q.detail}</span>
              </span>
              <span style={{ font: "400 10.5px var(--font-mono)", color: "var(--ink-muted-4)" }}>{q.state}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, font: "400 12px/1.6 var(--font-body)", color: "var(--ink-muted-3)" }}>Nada pendente. Todas as edições feitas no app já estão na planilha.</p>
      )}

      {contested.length > 0 && (
        <button
          onClick={() => setConflictTaskId(contested[0].id)}
          style={{ marginTop: 22, width: "100%", minHeight: 48, border: "1px solid var(--danger-dot)", borderRadius: 11, background: "none", color: "var(--danger-fg)", font: "500 12.5px var(--font-display)" }}
        >
          Ver conflito pendente ({contested.length})
        </button>
      )}

      <p style={{ margin: "18px 0 0", font: "400 11px/1.6 var(--font-body)", color: "var(--ink-muted-5)" }}>
        O app escreve apenas nas colunas <em>Status</em>, <em>Observações</em> e <em>Percentual da meta</em>. Fórmulas, formatação condicional e colunas calculadas da planilha permanecem intactas.
      </p>

      {conflictTask && (
        <ConflictModal
          task={conflictTask}
          onClose={() => {
            setConflictTaskId(null);
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
          }}
        />
      )}
    </div>
  );
}
