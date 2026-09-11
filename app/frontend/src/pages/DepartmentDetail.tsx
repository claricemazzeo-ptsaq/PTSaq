import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDepartments } from "../hooks/useDepartments";
import { useTasks } from "../hooks/useTasks";
import { useGoals } from "../hooks/useGoals";
import { useDocuments } from "../hooks/useDocuments";
import { useItemOverlay } from "../hooks/useItemOverlay";
import { ItemDetailSheet } from "../components/ItemDetailSheet";
import { pillStyle, fileTileStyle, formatDateTime } from "../lib/theme";

export function DepartmentDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: depts = [] } = useDepartments();
  const dept = depts.find((d) => d.id === id);
  const { data: tasks = [] } = useTasks({ department: id });
  const { data: goals = [] } = useGoals({ department: id });
  const { data: docs = [] } = useDocuments({ scope: id });
  const { kind, id: openId, openItem, closeItem } = useItemOverlay();

  const [tab, setTab] = useState<"painel" | "plano">("painel");
  const [dense, setDense] = useState<"compact" | "detailed">("detailed");

  const signDocs = docs.filter((d) => d.status === "Em revisão" || d.status === "Aguardando assinatura");

  return (
    <div style={{ padding: "18px 20px 28px" }}>
      <button onClick={() => nav("/frentes")} style={{ minHeight: 36, border: 0, background: "none", padding: 0, marginBottom: 10, font: "400 12px var(--font-body)", color: "var(--brand-blue)" }}>
        ← Todas as frentes
      </button>
      <div style={{ font: "500 10px var(--font-mono)", color: "var(--ink-muted-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>Frente</div>
      <h1 style={{ margin: "8px 0 4px", font: "600 23px/1.2 var(--font-display)", letterSpacing: "-.4px" }}>{dept?.name || id}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ font: "400 12.5px var(--font-body)", color: "var(--ink-muted-2)" }}>Frente:</span>
        <span style={{ font: "500 12.5px var(--font-display)", color: "var(--brand-blue)" }}>{dept?.short}</span>
      </div>

      {signDocs.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 10px", font: "600 14px var(--font-display)" }}>Documentos em revisão nesta frente</h2>
          <div className="scroll-x" style={{ display: "flex", gap: 9, margin: "0 -20px", padding: "2px 20px 6px" }}>
            {signDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => nav(`/docs?doc=${d.id}`)}
                style={{ flex: "none", width: 218, minHeight: 48, textAlign: "left", padding: 12, borderRadius: 12, border: "1px solid var(--warn-border)", background: "var(--surface)", display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <span style={fileTileStyle(d.type, 34, 10.5)}>{d.type}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "500 12px/1.35 var(--font-display)", color: "var(--ink)", textWrap: "pretty" }}>{d.title}</span>
                  <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-body)", color: "var(--warn-fg)", marginTop: 4 }}>
                    {d.status} · {d.version}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", padding: 3, borderRadius: 10, background: "var(--surface-sunken)", marginBottom: 12 }}>
        <button
          onClick={() => setTab("painel")}
          style={{ flex: 1, minHeight: 40, border: 0, borderRadius: 8, font: "500 12px var(--font-display)", background: tab === "painel" ? "var(--surface)" : "none", color: tab === "painel" ? "var(--ink)" : "var(--ink-segmented-inactive)", boxShadow: tab === "painel" ? "0 1px 3px rgba(20,32,28,.12)" : undefined }}
        >
          Painel Operacional
        </button>
        <button
          onClick={() => setTab("plano")}
          style={{ flex: 1, minHeight: 40, border: 0, borderRadius: 8, font: "500 12px var(--font-display)", background: tab === "plano" ? "var(--surface)" : "none", color: tab === "plano" ? "var(--ink)" : "var(--ink-segmented-inactive)", boxShadow: tab === "plano" ? "0 1px 3px rgba(20,32,28,.12)" : undefined }}
        >
          Plano de Trabalho
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ font: "400 11.5px var(--font-body)", color: "var(--ink-muted-3)" }}>{tab === "painel" ? `${tasks.length} tarefas` : `${goals.length} metas`}</span>
        <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 8, background: "var(--surface-sunken)" }}>
          <button onClick={() => setDense("compact")} style={{ minHeight: 32, padding: "0 11px", border: 0, borderRadius: 6, font: "500 11px var(--font-display)", background: dense === "compact" ? "var(--surface)" : "none", color: dense === "compact" ? "var(--ink)" : "var(--ink-segmented-inactive)" }}>
            Compacto
          </button>
          <button onClick={() => setDense("detailed")} style={{ minHeight: 32, padding: "0 11px", border: 0, borderRadius: 6, font: "500 11px var(--font-display)", background: dense === "detailed" ? "var(--surface)" : "none", color: dense === "detailed" ? "var(--ink)" : "var(--ink-segmented-inactive)" }}>
            Detalhado
          </button>
        </div>
      </div>

      {tab === "painel" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => openItem("task", t.id)}
              style={{ width: "100%", textAlign: "left", padding: dense === "detailed" ? 14 : "11px 13px", borderRadius: 12, border: `1px solid ${t.note ? "var(--danger-border)" : "var(--border-1)"}`, background: "var(--surface)", display: "block" }}
            >
              <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <span style={{ font: "500 13.5px/1.4 var(--font-display)", color: "var(--ink)", flex: 1, textWrap: "pretty" }}>{t.title}</span>
                <span style={pillStyle(t.status)}>{t.status}</span>
              </span>
              {dense === "detailed" && (
                <span style={{ display: "block" }}>
                  {t.note && (
                    <span style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 9, padding: "8px 10px", borderRadius: 8, background: "var(--danger-bg)" }}>
                      <span style={{ font: "500 11px/1.4 var(--font-body)", color: "var(--danger-fg)" }}>⚑ {t.note}</span>
                    </span>
                  )}
                  {t.budgetCents != null && (
                    <span style={{ display: "inline-block", marginTop: 9, padding: "5px 9px", borderRadius: 7, background: "var(--ok-bg)", font: "500 11.5px var(--font-mono)", color: "var(--ok-fg)" }}>
                      {(t.budgetCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  )}
                </span>
              )}
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, font: "400 11.5px var(--font-body)", color: "var(--ink-muted-3)" }}>
                <span>{t.owner}</span>
                <span style={{ color: t.dueDays != null && t.dueDays <= 7 ? "var(--danger-dot)" : "var(--ink-muted-3)" }}>{t.dueDate ? formatDateTime(t.dueDate).split(" ")[0] : "sem prazo"}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {goals.map((g) => (
            <button key={g.id} onClick={() => openItem("goal", g.id)} style={{ width: "100%", textAlign: "left", padding: 14, borderRadius: 12, border: "1px solid var(--border-1)", background: "var(--surface)", display: "block" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ font: "500 11px var(--font-mono)", color: "var(--brand-paper)", background: "var(--brand-blue)", padding: "3px 6px", borderRadius: 4 }}>{g.id}</span>
                <span style={pillStyle(g.status)}>{g.status}</span>
              </span>
              <span style={{ display: "block", font: "500 13.5px/1.4 var(--font-display)", color: "var(--ink)", marginTop: 9, textWrap: "pretty" }}>{g.title}</span>
              <span style={{ display: "block", height: 5, borderRadius: 3, background: "var(--surface-sunken)", marginTop: 11 }}>
                <span style={{ display: "block", height: 5, borderRadius: 3, width: `${g.pct}%`, background: g.pct === 100 ? "var(--brand-green)" : "var(--brand-blue)" }} />
              </span>
              <span style={{ display: "flex", justifyContent: "space-between", marginTop: 8, font: "400 11.5px var(--font-body)", color: "var(--ink-muted-3)" }}>
                <span>
                  {g.owner} · {g.schedule || "—"}
                </span>
                <span>{g.pct}%</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {kind && openId && <ItemDetailSheet kind={kind} id={openId} onClose={closeItem} />}
    </div>
  );
}
