import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useTasks } from "../hooks/useTasks";
import { useGoals } from "../hooks/useGoals";
import { useDepartments } from "../hooks/useDepartments";
import { useActivity } from "../hooks/useActivity";
import { useNotifications } from "../hooks/useNotifications";
import { useItemOverlay } from "../hooks/useItemOverlay";
import { ItemDetailSheet } from "../components/ItemDetailSheet";
import { NotificationsSheet } from "../components/NotificationsSheet";
import { formatBRL, formatDateTime, relativeTime } from "../lib/theme";

const RING_CIRCUMFERENCE = 2 * Math.PI * 33;

export function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: depts = [] } = useDepartments();
  const { data: feed = [] } = useActivity(false);
  const { unreadCount } = useNotifications();
  const { kind, id, openItem, closeItem } = useItemOverlay();
  const [digestOpen, setDigestOpen] = useState(false);

  const doneMetas = goals.filter((g) => g.status === "Concluída").length;
  const runMetas = goals.filter((g) => g.status === "Em andamento").length;
  const metaPct = goals.length ? Math.round((doneMetas / goals.length) * 100) : 0;
  const activeTasks = tasks.filter((t) => t.status === "Em execução").length;
  const blocked = tasks.filter((t) => t.note);
  const totalBudgetCents = tasks.reduce((sum, t) => sum + (t.budgetCents || 0), 0);
  const budgetedCount = tasks.filter((t) => t.budgetCents != null).length;

  const firstName = user?.name.split(" ")[0] || "";
  const myDigest = tasks.filter((t) => (t.owner || "").includes(firstName) && t.dueDays != null && t.dueDays <= 7);

  return (
    <div style={{ padding: "18px 20px 28px" }}>
      <div style={{ font: "400 11px var(--font-body)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Visão geral</div>
      <h1 style={{ margin: "8px 0 2px", font: "600 27px/1.15 var(--font-display)", letterSpacing: "-.5px" }}>Bom dia, {user?.name}</h1>
      <p style={{ margin: "0 0 16px", font: "400 13px/1.5 var(--font-body)", color: "var(--ink-muted-2)" }}>
        {activeTasks} tarefas em execução · {blocked.length} paradas por dependência
      </p>

      <button
        onClick={() => setDigestOpen(true)}
        style={{ width: "100%", textAlign: "left", padding: "14px 15px", borderRadius: 13, border: "1px solid var(--border-2)", background: "var(--surface)", display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}
      >
        <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, background: "var(--warn-bg)", color: "var(--warn-fg)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 13px var(--font-display)" }}>
          {myDigest.length}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", font: "500 12.5px/1.3 var(--font-display)", color: "var(--ink)" }}>Resumo do dia</span>
          <span style={{ display: "block", font: "400 11px/1.45 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>
            Suas entregas dos próximos 7 dias · {unreadCount > 0 ? `${unreadCount} aviso(s) novo(s)` : "nenhum aviso novo"}
          </span>
        </span>
        <span style={{ color: "var(--ink-muted-5)", fontSize: 15 }}>›</span>
      </button>

      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 18, borderRadius: 14, background: "var(--brand-blue)", color: "var(--brand-paper)", marginBottom: 12 }}>
        <div style={{ position: "relative", width: 78, height: 78, flex: "none" }}>
          <svg width="78" height="78" viewBox="0 0 78 78">
            <circle cx="39" cy="39" r="33" fill="none" stroke="rgba(255,249,231,.22)" strokeWidth="9" />
            <circle
              cx="39"
              cy="39"
              r="33"
              fill="none"
              stroke="var(--brand-green)"
              strokeWidth="9"
              strokeLinecap="round"
              transform="rotate(-90 39 39)"
              strokeDasharray={`${(metaPct / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ font: "600 20px/1 var(--font-display)" }}>{metaPct}%</span>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "500 13px/1.3 var(--font-display)", letterSpacing: ".02em" }}>Plano de Trabalho</div>
          <div style={{ font: "400 12px/1.55 var(--font-body)", color: "rgba(255,249,231,.78)", marginTop: 4 }}>
            {doneMetas} de {goals.length} metas concluídas, {runMetas} em andamento. Progresso derivado da coluna Situação.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-1)" }}>
          <div style={{ font: "600 26px/1 var(--font-display)", color: "var(--ink)" }}>{activeTasks}</div>
          <div style={{ font: "400 11.5px/1.35 var(--font-body)", color: "var(--ink-muted-2)", marginTop: 5 }}>
            tarefas em execução
            <br />
            de {tasks.length} no painel
          </div>
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-1)" }}>
          <div style={{ font: "600 20px/1.1 var(--font-display)", color: "var(--ink)" }}>{formatBRL(totalBudgetCents || null)}</div>
          <div style={{ font: "400 11.5px/1.35 var(--font-body)", color: "var(--ink-muted-2)", marginTop: 5 }}>
            total orçado
            <br />
            <span style={{ color: "#B8860B" }}>
              {budgetedCount} de {tasks.length} tarefas com valor
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 10px" }}>
        <h2 style={{ margin: 0, font: "600 16px var(--font-display)" }}>Precisa de atenção</h2>
        <span style={{ font: "500 11px var(--font-mono)", color: "var(--danger-dot)", background: "var(--danger-bg)", padding: "3px 7px", borderRadius: 20 }}>{blocked.length} bloqueios</span>
      </div>
      <div className="scroll-x" style={{ display: "flex", gap: 10, margin: "0 -20px", padding: "2px 20px 8px" }}>
        {blocked.map((t) => (
          <button
            key={t.id}
            onClick={() => openItem("task", t.id)}
            style={{ flex: "none", width: 246, minHeight: 48, textAlign: "left", padding: 14, borderRadius: 12, border: "1px solid var(--danger-border)", background: "var(--surface)", display: "block" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, font: "500 10px var(--font-mono)", color: "var(--danger-dot)", letterSpacing: ".04em", textTransform: "uppercase" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger-dot)", animation: "pulsedot 2s infinite" }} />
              Dependência
            </div>
            <div style={{ font: "500 13.5px/1.4 var(--font-display)", color: "var(--ink)", margin: "8px 0 6px" }}>{t.title}</div>
            <div style={{ font: "400 11.5px/1.45 var(--font-body)", color: "var(--ink-muted-2)" }}>{t.note}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, font: "400 11px var(--font-body)", color: "var(--ink-muted-4)" }}>
              <span>{t.owner}</span>
              <span>{t.dueDate ? formatDateTime(t.dueDate).split(" ")[0] : "sem prazo"}</span>
            </div>
          </button>
        ))}
      </div>

      <h2 style={{ margin: "24px 0 10px", font: "600 16px var(--font-display)" }}>Atividade da equipe</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "15px 16px", borderRadius: 13, background: "var(--surface)", border: "1px solid var(--border-1)" }}>
        {feed.length === 0 && <p style={{ margin: 0, font: "400 12px var(--font-body)", color: "var(--ink-muted-4)" }}>Sem atividade recente.</p>}
        {feed.map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", marginTop: 5, background: "var(--ink-muted-5)" }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "400 12.5px/1.45 var(--font-body)", color: "var(--ink)" }}>
                {f.who} {f.what}
              </span>
              <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-mono)", color: "var(--ink-muted-4)", marginTop: 2 }}>{relativeTime(f.when)}</span>
            </span>
          </div>
        ))}
      </div>

      <h2 style={{ margin: "24px 0 10px", font: "600 16px var(--font-display)" }}>Frentes</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {depts.map((d) => (
          <button
            key={d.id}
            onClick={() => nav(`/frentes/${d.id}`)}
            style={{ minHeight: 48, width: "100%", textAlign: "left", padding: "13px 14px", borderRadius: 12, border: "1px solid var(--border-1)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 12 }}
          >
            <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", font: "600 14px var(--font-display)", background: "var(--surface-sunken)", color: "var(--ink-muted-1)" }}>
              {d.short.charAt(0)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "500 13.5px/1.3 var(--font-display)", color: "var(--ink)" }}>{d.short}</span>
              <span style={{ display: "block", height: 4, borderRadius: 2, background: "var(--surface-sunken)", marginTop: 8 }}>
                <span style={{ display: "block", height: 4, borderRadius: 2, width: `${Math.max(d.goalProgressPct ?? 0, 2)}%`, background: "var(--brand-green)" }} />
              </span>
            </span>
            <span style={{ font: "500 12px var(--font-mono)", color: "var(--ink-muted-2)" }}>{d.goalProgressPct ?? 0}%</span>
          </button>
        ))}
      </div>

      {kind && id && <ItemDetailSheet kind={kind} id={id} onClose={closeItem} />}
      <NotificationsSheet open={digestOpen} onClose={() => setDigestOpen(false)} />
    </div>
  );
}
