import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useTasks, useUpdateTask } from "../hooks/useTasks";
import { useDocuments } from "../hooks/useDocuments";
import { useActivity } from "../hooks/useActivity";
import { useUpdateAvailability } from "../hooks/useMe";
import { usePendingAccounts, useApproveAccount } from "../hooks/useAdmin";
import { useItemOverlay } from "../hooks/useItemOverlay";
import { ItemDetailSheet } from "../components/ItemDetailSheet";
import { pillStyle, unlockedPillStyle, fileTileStyle, docPillStyle, relativeTime, formatDateTime } from "../lib/theme";
import { useToast } from "../state/ToastContext";
import type { Availability, Task } from "../api/types";

const AVAIL_OPTIONS: { id: Availability; label: string; bg: string; fg: string; dot: string }[] = [
  { id: "office", label: "No escritório", bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-dot)" },
  { id: "field", label: "Em campo / obra", bg: "var(--warn-bg)", fg: "var(--warn-fg)", dot: "var(--warn-dot)" },
  { id: "focus", label: "Modo foco", bg: "var(--info-bg)", fg: "var(--info-fg)", dot: "var(--info-dot)" },
];

export function Home() {
  const { user, department } = useAuth();
  const nav = useNavigate();
  const { flash } = useToast();
  const { kind, id, openItem, closeItem } = useItemOverlay();

  const { data: mine = [] } = useTasks({ mine: true });
  const { data: allTasks = [] } = useTasks();
  const { data: docs = [] } = useDocuments();
  const { data: myLog = [] } = useActivity(true);
  const updateTask = useUpdateTask();
  const updateAvailability = useUpdateAvailability();

  const isAdmin = user?.role === "admin";
  const { data: pendingAccounts = [] } = usePendingAccounts(isAdmin);
  const approveAccount = useApproveAccount();

  const firstName = user?.name.split(" ")[0] || "";
  const mineIds = useMemo(() => mine.map((t) => t.id), [mine]);
  const myOpen = mine.filter((t) => t.status !== "Executado");

  const waitingOn = useMemo(() => {
    return myOpen
      .map((t) => {
        if (!t.blockedByTaskId) return null;
        const blocker = allTasks.find((b) => b.id === t.blockedByTaskId);
        if (!blocker || blocker.status === "Executado") return null;
        if ((blocker.owner || "").includes(firstName)) return null;
        return { mine: t, blocker };
      })
      .filter((x): x is { mine: Task; blocker: Task } => !!x);
  }, [myOpen, allTasks, firstName]);

  const blocking = useMemo(() => {
    return allTasks
      .map((w) => {
        if (!w.blockedByTaskId || !mineIds.includes(w.blockedByTaskId)) return null;
        const mineTask = allTasks.find((t) => t.id === w.blockedByTaskId);
        if (!mineTask || mineTask.status === "Executado") return null;
        return { mine: mineTask, waiter: w };
      })
      .filter((x): x is { mine: Task; waiter: Task } => !!x);
  }, [allTasks, mineIds]);

  const signDocs = docs.filter(
    (d) =>
      (d.status === "Em revisão" || d.status === "Aguardando assinatura") &&
      (user?.role === "admin" || d.departmentId === user?.departmentId || d.departmentId === null || d.linkedTaskIds.some((t) => mineIds.includes(t))),
  );
  const myDocs = docs.filter((d) => d.linkedTaskIds.some((t) => mineIds.includes(t)));

  async function advance(t: Task) {
    const next = t.status === "Não iniciado" ? "Em execução" : "Executado";
    await updateTask.mutateAsync({ id: t.id, data: { status: next } });
    flash(`"${t.title.replace(/\.$/, "")}" → ${next}. Enviado para a planilha.`);
  }

  if (!user) return null;
  const avail = AVAIL_OPTIONS.find((a) => a.id === user.availability) || AVAIL_OPTIONS[0];

  return (
    <div style={{ padding: "18px 20px 28px" }}>
      <div style={{ display: "flex", gap: 13, alignItems: "center", marginBottom: 16 }}>
        <span style={{ width: 52, height: 52, flex: "none", borderRadius: "50%", background: "var(--brand-blue)", color: "var(--brand-paper)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 20px var(--font-display)" }}>
          {user.name.charAt(0)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", font: "400 11px var(--font-body)", color: "var(--ink-muted-3)" }}>Bom dia,</span>
          <span style={{ display: "block", font: "600 20px/1.15 var(--font-display)", color: "var(--ink)", letterSpacing: "-.3px", marginTop: 4 }}>{user.name}</span>
          <span style={{ display: "block", font: "400 11.5px/1.4 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>{user.title}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, padding: "3px 9px", borderRadius: 20, background: "var(--surface-sunken)", font: "500 10.5px var(--font-display)", color: "var(--ink-muted-1)" }}>
            {department?.short || "Todas as frentes"}
          </span>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: avail.dot }} />
        <span style={{ font: "400 11.5px var(--font-body)", color: "var(--ink-muted-3)" }}>{avail.label}</span>
      </div>
      <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 11, background: "var(--surface-sunken)", marginBottom: 18 }}>
        {AVAIL_OPTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              updateAvailability.mutate(a.id);
              flash(`Disponibilidade: ${a.label}. A equipe vê no seu perfil.`);
            }}
            style={{ flex: 1, minHeight: 40, border: 0, borderRadius: 9, font: "500 11px var(--font-display)", background: user.availability === a.id ? a.bg : "none", color: user.availability === a.id ? a.fg : "var(--ink-segmented-inactive)" }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 22 }}>
        <Stat value={mine.length} label="atribuídas" />
        <Stat value={mine.filter((t) => t.status === "Executado").length} label="executadas" color="var(--ok-fg)" />
        <Stat value={mine.filter((t) => t.status !== "Executado").length} label="pendentes" color="var(--info-fg)" />
        <Stat value={waitingOn.length} label="travadas" color="var(--danger-dot)" />
      </div>

      {isAdmin && pendingAccounts.length > 0 && (
        <Section title="Contas aguardando sua aprovação">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingAccounts.map((p) => (
              <div key={p.id} style={{ padding: 13, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--warn-border)" }}>
                <div style={{ font: "500 13px/1.3 var(--font-display)", color: "var(--ink)" }}>{p.name}</div>
                <div style={{ font: "400 11px/1.45 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>
                  {p.email} · {p.departmentId} · {relativeTime(p.requestedAt)}
                </div>
                <button
                  onClick={() => approveAccount.mutate(p.id)}
                  style={{ marginTop: 10, minHeight: 40, padding: "0 14px", border: 0, borderRadius: 9, background: "var(--brand-green)", color: "#08281f", font: "500 11.5px var(--font-display)" }}
                >
                  Aprovar acesso
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {signDocs.length > 0 && (
        <Section title="Aguardando sua revisão" badge={`${signDocs.length} documento(s)`}>
          <div className="scroll-x" style={{ display: "flex", gap: 9, margin: "0 -20px", padding: "2px 20px 6px" }}>
            {signDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => nav(`/docs?doc=${d.id}`)}
                style={{ flex: "none", width: 224, minHeight: 48, textAlign: "left", padding: 13, borderRadius: 12, border: "1px solid var(--warn-border)", background: "var(--surface)", display: "flex", gap: 11, alignItems: "flex-start" }}
              >
                <span style={fileTileStyle(d.type, 34, 10.5)}>{d.type}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)", color: "var(--ink)" }}>{d.title}</span>
                  <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-body)", color: "var(--warn-fg)", marginTop: 4 }}>
                    {d.version} · {formatDateTime(d.driveUpdatedAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <h2 style={{ margin: "0 0 10px", font: "600 15px var(--font-display)" }}>Minha fila</h2>
      {myOpen.length === 0 ? (
        <div style={{ padding: 20, borderRadius: 12, background: "var(--surface)", border: "1px dashed var(--border-5)", marginBottom: 24 }}>
          <p style={{ margin: 0, font: "400 12.5px/1.6 var(--font-body)", color: "var(--ink-muted-3)" }}>
            Nada na sua fila hoje. Suas entregas aparecem aqui assim que alguém marcar você como responsável na planilha.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {[...myOpen]
            .sort((a, b) => {
              const aBlocking = blocking.some((x) => x.mine.id === a.id) ? 1 : 0;
              const bBlocking = blocking.some((x) => x.mine.id === b.id) ? 1 : 0;
              const aBlocked = waitingOn.some((x) => x.mine.id === a.id) ? 1 : 0;
              const bBlocked = waitingOn.some((x) => x.mine.id === b.id) ? 1 : 0;
              if (bBlocking !== aBlocking) return bBlocking - aBlocking;
              if (aBlocked !== bBlocked) return aBlocked - bBlocked;
              return (a.dueDays ?? 999) - (b.dueDays ?? 999);
            })
            .map((t) => {
              const w = waitingOn.find((x) => x.mine.id === t.id);
              const b = !w && blocking.find((x) => x.mine.id === t.id);
              const next = t.status === "Não iniciado" ? "Em execução" : "Executado";
              return (
                <div
                  key={t.id}
                  style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: `1px solid ${w ? "var(--warn-border)" : b ? "var(--danger-border)" : "var(--border-1)"}` }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <button onClick={() => openItem("task", t.id)} style={{ font: "500 13.5px/1.4 var(--font-display)", color: "var(--ink)", flex: 1, textAlign: "left", border: 0, background: "none", padding: 0, textWrap: "pretty" }}>
                      {t.title}
                    </button>
                    <span style={pillStyle(t.status)}>{t.status}</span>
                  </div>
                  {w && (
                    <button
                      onClick={() => openItem("task", w.blocker.id)}
                      style={{ width: "100%", textAlign: "left", marginTop: 10, padding: "9px 11px", border: 0, borderRadius: 9, background: "var(--warn-bg)", display: "flex", gap: 8, alignItems: "flex-start" }}
                    >
                      <span style={{ width: 6, height: 6, flex: "none", borderRadius: "50%", background: "var(--warn-dot)", marginTop: 5 }} />
                      <span style={{ font: "500 11px/1.45 var(--font-body)", color: "var(--warn-fg)", textAlign: "left" }}>
                        Travada por {w.blocker.owner} · {w.blocker.title.replace(/\.$/, "")}
                      </span>
                    </button>
                  )}
                  {b && (
                    <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 9, background: "var(--danger-bg)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ width: 6, height: 6, flex: "none", borderRadius: "50%", background: "var(--danger-dot)", marginTop: 5, animation: "pulsedot 2s infinite" }} />
                      <span style={{ font: "500 11px/1.45 var(--font-body)", color: "var(--danger-fg)" }}>
                        Ao concluir, libera "{b.waiter.title.replace(/\.$/, "")}" de {b.waiter.owner}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9, font: "400 11.5px var(--font-body)", color: "var(--ink-muted-3)" }}>
                    <span>{t.frente}</span>
                    <span style={{ color: t.dueDays != null && t.dueDays <= 7 ? "var(--danger-dot)" : "var(--ink-muted-3)" }}>{t.dueDate ? formatDateTime(t.dueDate).split(" ")[0] : "sem prazo"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
                    <button
                      onClick={() => advance(t)}
                      disabled={!t.canEdit || !!w}
                      style={{ flex: 1, minHeight: 44, border: 0, borderRadius: 10, font: "500 11.5px var(--font-display)", background: next === "Executado" ? "var(--brand-green)" : "var(--brand-blue)", color: next === "Executado" ? "#08281f" : "var(--brand-paper)" }}
                    >
                      {next === "Executado" ? "Marcar executado" : "Iniciar"}
                    </button>
                    <button
                      onClick={() => openItem("task", t.id)}
                      style={{ flex: "none", minHeight: 44, padding: "0 14px", border: "1px solid var(--border-4)", borderRadius: 10, background: "none", color: "var(--ink-muted-1)", font: "500 11.5px var(--font-display)" }}
                    >
                      Anotar
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {myDocs.length > 0 && (
        <Section title="Meus documentos">
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {myDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => nav(`/docs?doc=${d.id}`)}
                style={{ width: "100%", textAlign: "left", padding: "11px 12px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", display: "flex", gap: 11, alignItems: "center" }}
              >
                <span style={fileTileStyle(d.type, 36, 11)}>{d.type}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)", color: "var(--ink)" }}>{d.title}</span>
                  <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>{d.version}</span>
                </span>
                <span style={docPillStyle(d.status)}>{d.status}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {myLog.length > 0 && (
        <Section title="Minha atividade" last>
          <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: "15px 16px", borderRadius: 13, background: "var(--surface)", border: "1px solid var(--border-1)" }}>
            {myLog.slice(0, 5).map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", marginTop: 5, background: "var(--brand-blue)" }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "400 12.5px/1.45 var(--font-body)", color: "var(--ink)" }}>{l.what}</span>
                  <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-mono)", color: "var(--ink-muted-4)", marginTop: 2 }}>{relativeTime(l.when)} · sincronizado com o Sheets</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 14px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-1)", marginTop: 24 }}>
        <span style={{ font: "400 12px/1.45 var(--font-body)", color: "var(--ink-muted-1)" }}>Precisa de retorno de outra frente?</span>
        <button
          onClick={() => flash("Pedido de atualização enviado à liderança da frente.")}
          style={{ flex: "none", minHeight: 40, padding: "0 13px", border: "1px solid var(--border-5)", borderRadius: 9, background: "none", color: "var(--brand-blue)", font: "500 11.5px var(--font-display)" }}
        >
          Cobrar
        </button>
      </div>

      {kind && id && <ItemDetailSheet kind={kind} id={id} onClose={closeItem} />}
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ padding: "11px 8px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border-1)" }}>
      <div style={{ font: "600 19px/1 var(--font-display)", color: color || "var(--ink)" }}>{value}</div>
      <div style={{ font: "400 10px/1.3 var(--font-body)", color: "var(--ink-muted-2)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Section({ title, badge, last, children }: { title: string; badge?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: last ? 0 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ margin: 0, font: "600 15px var(--font-display)" }}>{title}</h2>
        {badge && <span style={{ font: "500 10.5px var(--font-mono)", color: "var(--warn-fg)", background: "var(--warn-bg)", padding: "3px 8px", borderRadius: 20 }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}
