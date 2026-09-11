import { useNavigate } from "react-router-dom";
import { useDepartments } from "../hooks/useDepartments";

export function Departments() {
  const nav = useNavigate();
  const { data: depts = [] } = useDepartments();

  return (
    <div style={{ padding: "18px 20px 28px" }}>
      <div style={{ font: "400 11px var(--font-body)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>PTSaq</div>
      <h1 style={{ margin: "8px 0 4px", font: "600 25px/1.15 var(--font-display)", letterSpacing: "-.4px" }}>Frentes</h1>
      <p style={{ margin: "0 0 18px", font: "400 13px/1.5 var(--font-body)", color: "var(--ink-muted-2)" }}>As quatro frentes operacionais do parque.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {depts.map((d) => (
          <button
            key={d.id}
            onClick={() => nav(`/frentes/${d.id}`)}
            style={{
              minHeight: 48,
              width: "100%",
              textAlign: "left",
              padding: "13px 14px",
              borderRadius: 12,
              border: "1px solid var(--border-1)",
              background: "var(--surface)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                flex: "none",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "600 14px var(--font-display)",
                background: "var(--surface-sunken)",
                color: "var(--ink-muted-1)",
              }}
            >
              {d.short.charAt(0)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "500 13.5px/1.3 var(--font-display)", color: "var(--ink)" }}>{d.short}</span>
              <span style={{ display: "block", font: "400 11px/1.4 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 2 }}>{d.name}</span>
              <span style={{ display: "block", height: 4, borderRadius: 2, background: "var(--surface-sunken)", marginTop: 8 }}>
                <span style={{ display: "block", height: 4, borderRadius: 2, width: `${Math.max(d.goalProgressPct ?? 0, 2)}%`, background: "var(--brand-green)" }} />
              </span>
            </span>
            <span style={{ font: "500 12px var(--font-mono)", color: "var(--ink-muted-2)" }}>{d.goalProgressPct ?? 0}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
