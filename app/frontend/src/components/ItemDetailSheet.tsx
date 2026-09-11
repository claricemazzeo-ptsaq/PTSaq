import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "./Sheet";
import { useTask, useTaskAudit, useUpdateTask, useSetTaskDependency } from "../hooks/useTasks";
import { useGoal, useGoalAudit, useUpdateGoal } from "../hooks/useGoals";
import { useDocuments } from "../hooks/useDocuments";
import { usePresence } from "../hooks/usePresence";
import { pillStyle, fileTileStyle, docPillStyle, formatBRL, formatDateTime } from "../lib/theme";
import { useToast } from "../state/ToastContext";
import { DependencyPicker } from "./DependencyPicker";
import { ConflictModal } from "./ConflictModal";
import { ApiError } from "../api/client";
import type { AuditRow } from "../api/types";

const TASK_STATUS_OPTIONS = ["Não iniciado", "Em execução", "Executado"] as const;
const GOAL_STATUS_OPTIONS = ["A iniciar", "Em andamento", "Concluída", "Justificada"] as const;

export function ItemDetailSheet({ kind, id, onClose }: { kind: "task" | "goal"; id: string; onClose: () => void }) {
  const nav = useNavigate();
  const { flash } = useToast();
  const isTask = kind === "task";

  const taskQuery = useTask(isTask ? id : null);
  const goalQuery = useGoal(!isTask ? id : null);
  const rec = isTask ? taskQuery.data : goalQuery.data;

  const taskAuditQuery = useTaskAudit(id, isTask);
  const goalAuditQuery = useGoalAudit(id, !isTask);
  const audit: AuditRow[] = (isTask ? taskAuditQuery.data : goalAuditQuery.data) || [];

  const blockedByTaskId = isTask ? (rec as { blockedByTaskId?: string | null } | undefined)?.blockedByTaskId : null;
  const blockerQuery = useTask(blockedByTaskId || null);
  const blocker = blockerQuery.data;

  const presence = usePresence(id);
  const { data: allDocs } = useDocuments();
  const linkedDocs = (allDocs || []).filter((d) => (isTask ? d.linkedTaskIds : d.linkedGoalIds).includes(id));

  const updateTask = useUpdateTask();
  const updateGoal = useUpdateGoal();
  const setDependency = useSetTaskDependency();

  const [noteDraft, setNoteDraft] = useState("");
  const [depPickerOpen, setDepPickerOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  useEffect(() => {
    setNoteDraft(rec?.note || "");
  }, [rec?.note, id]);

  if (!rec) return null;

  const canEdit = rec.canEdit;
  const dirty = noteDraft !== (rec.note || "");
  const statusOptions = isTask ? TASK_STATUS_OPTIONS : GOAL_STATUS_OPTIONS;
  const isContested = isTask && (rec as { contested?: boolean }).contested;

  async function setStatus(status: string) {
    if (isContested) {
      setConflictOpen(true);
      return;
    }
    try {
      if (isTask) {
        await updateTask.mutateAsync({ id, data: { status: status as (typeof TASK_STATUS_OPTIONS)[number] } });
      } else {
        await updateGoal.mutateAsync({ id, data: { status: status as (typeof GOAL_STATUS_OPTIONS)[number] } });
      }
    } catch (e) {
      if (e instanceof ApiError && (e.body as { error?: string })?.error === "conflict_pending") setConflictOpen(true);
      else throw e;
    }
  }

  async function save() {
    if (isContested) {
      setConflictOpen(true);
      return;
    }
    try {
      if (isTask) await updateTask.mutateAsync({ id, data: { note: noteDraft } });
      else await updateGoal.mutateAsync({ id, data: { note: noteDraft } });
      flash("Enviado para a planilha.");
    } catch (e) {
      if (e instanceof ApiError && (e.body as { error?: string })?.error === "conflict_pending") setConflictOpen(true);
      else throw e;
    }
  }

  async function clearDep() {
    await setDependency.mutateAsync({ id, blockedByTaskId: null });
    flash("Dependência removida.");
  }

  return (
    <Sheet open onClose={onClose} top={86} kicker={isTask ? "Painel Operacional" : "Plano de Trabalho"}>
      <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
        {!isTask && (
          <span style={{ font: "500 11px var(--font-mono)", color: "var(--brand-paper)", background: "var(--brand-blue)", padding: "4px 7px", borderRadius: 4 }}>
            Meta {id}
          </span>
        )}
        <span style={pillStyle(rec.status)}>{rec.status}</span>
      </div>
      <h1 style={{ margin: "0 0 14px", font: "600 21px/1.28 var(--font-display)", letterSpacing: "-.3px" }}>{rec.title}</h1>

      {isContested && (
        <button
          onClick={() => setConflictOpen(true)}
          style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--danger-dot)", background: "var(--danger-bg)", color: "var(--danger-fg)", font: "500 12.5px var(--font-display)", marginBottom: 16 }}
        >
          ⚠ Conflito de edição pendente — toque para resolver
        </button>
      )}

      {presence && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 11, background: "var(--info-bg)", marginBottom: 16 }}>
          <span style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", background: "var(--brand-blue)", animation: "pulsedot 1.6s infinite" }} />
          <span style={{ font: "400 12px/1.45 var(--font-body)", color: "var(--info-fg)" }}>
            {presence.who} está com este item aberto {presence.where}
          </span>
        </div>
      )}

      {(rec.note || (rec as { flag?: string | null }).flag) && (
        <div style={{ padding: "13px 14px", borderRadius: 12, background: "var(--danger-bg)", marginBottom: 16 }}>
          <div style={{ font: "500 10.5px var(--font-mono)", color: "var(--danger-fg)", letterSpacing: ".06em", textTransform: "uppercase" }}>Dependência</div>
          <div style={{ font: "400 13px/1.5 var(--font-body)", color: "var(--danger-fg)", marginTop: 6 }}>{rec.note || (rec as { flag?: string | null }).flag}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border-1)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ background: "var(--surface)", padding: "13px 14px" }}>
          <div style={{ font: "400 10.5px var(--font-body)", color: "var(--ink-muted-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Responsável</div>
          <div style={{ font: "500 13.5px var(--font-display)", marginTop: 5 }}>{rec.owner || "—"}</div>
        </div>
        <div style={{ background: "var(--surface)", padding: "13px 14px" }}>
          <div style={{ font: "400 10.5px var(--font-body)", color: "var(--ink-muted-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Prazo</div>
          <div style={{ font: "500 13.5px var(--font-display)", marginTop: 5, color: isTask && (rec as { dueDays?: number | null }).dueDays != null && (rec as { dueDays?: number | null }).dueDays! <= 7 ? "var(--danger-dot)" : "var(--ink)" }}>
            {rec.dueDate ? formatDateTime(rec.dueDate).split(" ")[0] : (isTask ? "—" : (rec as { schedule?: string | null }).schedule || "—")}
          </div>
        </div>
        <div style={{ background: "var(--surface)", padding: "13px 14px" }}>
          <div style={{ font: "400 10.5px var(--font-body)", color: "var(--ink-muted-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Frente</div>
          <div style={{ font: "500 13.5px var(--font-display)", marginTop: 5 }}>{isTask ? (rec as { frente?: string }).frente : rec.departmentShort}</div>
        </div>
        <div style={{ background: "var(--surface)", padding: "13px 14px" }}>
          <div style={{ font: "400 10.5px var(--font-body)", color: "var(--ink-muted-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Valor orçado</div>
          <div
            style={{
              font: isTask && (rec as { budgetCents?: number | null }).budgetCents ? "500 13.5px var(--font-mono)" : "500 13.5px var(--font-display)",
              marginTop: 5,
              color: isTask && (rec as { budgetCents?: number | null }).budgetCents ? "var(--ok-fg)" : "var(--ink-muted-5)",
            }}
          >
            {isTask ? formatBRL((rec as { budgetCents?: number | null }).budgetCents ?? null) : "—"}
          </div>
        </div>
      </div>

      {isTask && (
        <>
          <h2 style={{ margin: "0 0 9px", font: "600 14px var(--font-display)" }}>Dependência</h2>
          {blocker && (
            <div style={{ padding: "13px 14px", borderRadius: 12, marginBottom: 16, background: blocker.status === "Executado" ? "var(--ok-bg)" : "var(--warn-bg)" }}>
              <div
                style={{
                  font: "500 10.5px var(--font-mono)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: blocker.status === "Executado" ? "var(--ok-fg)" : "var(--warn-fg)",
                }}
              >
                {blocker.status === "Executado" ? "Dependência liberada" : "Aguardando dependência"}
              </div>
              <div style={{ font: "400 12.5px/1.5 var(--font-body)", marginTop: 6, color: blocker.status === "Executado" ? "var(--ok-fg)" : "var(--warn-fg)" }}>
                {blocker.status === "Executado"
                  ? `"${blocker.title.replace(/\.$/, "")}" foi concluída por ${blocker.owner}. Este item pode começar.`
                  : `Depende de "${blocker.title.replace(/\.$/, "")}", com ${blocker.owner}.`}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                <button
                  onClick={() => nav(`/?open=task:${blocker.id}`)}
                  style={{ minHeight: 40, padding: "0 13px", border: "1px solid var(--border-5)", borderRadius: 9, background: "var(--surface)", color: "var(--ink)", font: "500 11.5px var(--font-display)" }}
                >
                  Abrir o item bloqueador
                </button>
                <button onClick={clearDep} style={{ minHeight: 40, padding: "0 13px", border: 0, borderRadius: 9, background: "none", color: "var(--ink-muted-1)", font: "500 11.5px var(--font-display)" }}>
                  Desvincular
                </button>
              </div>
            </div>
          )}
          <button
            onClick={() => setDepPickerOpen(true)}
            style={{
              width: "100%",
              minHeight: 48,
              marginBottom: 20,
              border: "1px dashed var(--border-3)",
              borderRadius: 11,
              background: "none",
              color: "var(--brand-blue)",
              font: "500 12px var(--font-display)",
            }}
          >
            + Vincular a outro item
          </button>
        </>
      )}

      {linkedDocs.length > 0 && (
        <>
          <h2 style={{ margin: "0 0 9px", font: "600 14px var(--font-display)" }}>Documentos vinculados</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
            {linkedDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => nav(`/docs?doc=${d.id}`)}
                style={{ width: "100%", textAlign: "left", padding: "11px 12px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", display: "flex", gap: 11, alignItems: "center" }}
              >
                <span style={fileTileStyle(d.type, 34, 10)}>{d.type}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)", color: "var(--ink)" }}>{d.title}</span>
                  <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>
                    {d.version} · {formatDateTime(d.driveUpdatedAt)}
                  </span>
                </span>
                <span style={docPillStyle(d.status)}>{d.status}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {canEdit ? (
        <div>
          <h2 style={{ margin: "0 0 9px", font: "600 14px var(--font-display)" }}>Atualizar status</h2>
          <div style={{ display: "flex", gap: 7, marginBottom: 20, flexWrap: "wrap" }}>
            {statusOptions.map((s) => {
              const active = rec.status === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  style={{
                    flex: 1,
                    minWidth: 90,
                    minHeight: 48,
                    padding: "0 6px",
                    borderRadius: 11,
                    font: "500 11.5px var(--font-display)",
                    border: `1px solid ${active ? "var(--brand-blue)" : "var(--border-4)"}`,
                    background: active ? "var(--info-bg)" : "var(--surface)",
                    color: active ? "var(--info-fg)" : "var(--ink-muted-1)",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <h2 style={{ margin: "0 0 9px", font: "600 14px var(--font-display)" }}>Observação</h2>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Registre um bloqueio, dependência ou justificativa…"
            style={{ width: "100%", minHeight: 88, padding: 12, borderRadius: 11, border: "1px solid var(--border-4)", background: "var(--surface)", font: "400 13px/1.5 var(--font-body)", color: "var(--ink)", resize: "none" }}
          />
          <button
            onClick={save}
            disabled={!dirty}
            style={{
              marginTop: 12,
              width: "100%",
              minHeight: 52,
              border: 0,
              borderRadius: 12,
              font: "500 13.5px var(--font-display)",
              background: dirty ? "var(--brand-green)" : "var(--surface-sunken)",
              color: dirty ? "#08281f" : "var(--ink-muted-5)",
            }}
          >
            {dirty ? "Enviar para a planilha" : "Sem alterações"}
          </button>
          <p style={{ margin: "10px 0 0", font: "400 10.5px/1.55 var(--font-body)", color: "var(--ink-muted-5)" }}>
            O envio grava apenas <span style={{ fontFamily: "var(--font-mono)" }}>Status</span>, <span style={{ fontFamily: "var(--font-mono)" }}>Observações</span> e{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>Percentual da meta</span>. Fórmulas e formatação condicional não são tocadas.
          </p>
        </div>
      ) : (
        <div style={{ padding: "14px 15px", borderRadius: 12, background: "var(--surface-sunken)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted-1)" strokeWidth="1.9" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span style={{ font: "500 11px var(--font-mono)", color: "var(--ink-muted-1)", letterSpacing: ".05em", textTransform: "uppercase" }}>Somente leitura</span>
          </div>
          <p style={{ margin: "8px 0 0", font: "400 12.5px/1.55 var(--font-body)", color: "var(--ink-muted-1)" }}>{rec.readOnlyReason}</p>
        </div>
      )}

      {audit.length > 0 && (
        <>
          <h2 style={{ margin: "24px 0 12px", font: "600 14px var(--font-display)" }}>Histórico</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 2 }}>
            {audit.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", marginTop: 5, background: a.origin === "app" ? "var(--brand-blue)" : "var(--brand-green)" }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "400 12.5px/1.5 var(--font-body)", color: "var(--ink)" }}>{a.summary}</span>
                  <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-mono)", color: "var(--ink-muted-4)", marginTop: 3 }}>
                    {a.origin === "app" ? "Aplicativo" : "Google Sheets"} · {formatDateTime(a.when)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border-1)" }}>
        <div style={{ font: "400 11px/1.6 var(--font-body)", color: "var(--ink-muted-5)" }}>
          Origem: <span style={{ fontFamily: "var(--font-mono)" }}>{(rec as { sheetCell?: string | null }).sheetCell || "—"}</span>
        </div>
      </div>

      {isTask && <DependencyPicker open={depPickerOpen} onClose={() => setDepPickerOpen(false)} taskId={id} />}
      {isContested && conflictOpen && <ConflictModal task={rec as import("../api/types").Task} onClose={() => setConflictOpen(false)} />}
    </Sheet>
  );
}
