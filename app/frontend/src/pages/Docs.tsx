import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDocuments, useRefreshDocuments } from "../hooks/useDocuments";
import { DocDetailSheet } from "../components/DocDetailSheet";
import { fileTileStyle, docPillStyle, formatDateTime } from "../lib/theme";
import { useToast } from "../state/ToastContext";

const SCOPES = [
  { id: "all", label: "Todos" },
  { id: "com", label: "Comunicação" },
  { id: "jur", label: "Jurídico" },
  { id: "tec", label: "Tecnologia" },
  { id: "adm", label: "Administrativo" },
  { id: "glo", label: "Global" },
];
const TYPES = ["Todos", "PDF", "DOCX", "XLSX", "SVG"];

export function Docs() {
  const [params, setParams] = useSearchParams();
  const { flash } = useToast();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [type, setType] = useState("Todos");
  const { data: docs = [] } = useDocuments({ scope, type, q });
  const refresh = useRefreshDocuments();

  const docId = params.get("doc");
  const pinnedCount = docs.filter((d) => d.pinned).length;

  async function fetchNew() {
    const res = await refresh.mutateAsync();
    flash(res.mock ? "Lendo a pasta mestra do Drive… (modo local: nada de novo para buscar)" : "Lendo a pasta mestra do Drive…");
  }

  return (
    <div style={{ padding: "18px 20px 28px" }}>
      <div style={{ font: "400 11px var(--font-body)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Pasta mestra no Drive</div>
      <h1 style={{ margin: "8px 0 14px", font: "600 25px/1.15 var(--font-display)", letterSpacing: "-.4px" }}>Repositório</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 13px", minHeight: 48, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-3)", marginBottom: 12 }}>
        <span style={{ color: "var(--ink-muted-5)", fontSize: 14 }}>⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título ou tipo…"
          style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "none", font: "400 13.5px var(--font-body)", color: "var(--ink)" }}
        />
      </div>

      <div className="scroll-x" style={{ display: "flex", gap: 7, margin: "0 -20px 9px", padding: "2px 20px" }}>
        {SCOPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            style={{
              flex: "none",
              minHeight: 34,
              padding: "0 12px",
              borderRadius: 18,
              font: "500 11.5px var(--font-display)",
              border: `1px solid ${scope === s.id ? "var(--brand-blue)" : "var(--border-4)"}`,
              background: scope === s.id ? "var(--brand-blue)" : "var(--surface)",
              color: scope === s.id ? "var(--brand-paper)" : "var(--ink-muted-1)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="scroll-x" style={{ display: "flex", gap: 6, margin: "0 -20px 14px", padding: "2px 20px" }}>
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: "none",
              minHeight: 32,
              padding: "0 11px",
              borderRadius: 8,
              font: "500 11px var(--font-mono)",
              border: 0,
              background: type === t ? "var(--ink)" : "var(--surface-sunken)",
              color: type === t ? "var(--brand-paper)" : "var(--ink-muted-1)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <span style={{ font: "400 11.5px var(--font-body)", color: "var(--ink-muted-3)" }}>{docs.length} documento(s)</span>
        <span style={{ font: "400 11.5px var(--font-body)", color: "var(--ok-fg)" }}>⤓ {pinnedCount} offline</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((f) => (
          <button
            key={f.id}
            onClick={() => setParams({ doc: f.id })}
            style={{ width: "100%", textAlign: "left", padding: 13, borderRadius: 12, border: "1px solid var(--border-1)", background: "var(--surface)", display: "flex", gap: 12, alignItems: "flex-start" }}
          >
            <span style={fileTileStyle(f.type, 42, 12.5)}>{f.type}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "500 13.5px/1.4 var(--font-display)", color: "var(--ink)", textWrap: "pretty" }}>{f.title}</span>
              <span style={{ display: "block", font: "400 11px/1.45 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 4 }}>
                {f.version} · {formatDateTime(f.driveUpdatedAt)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                <span style={docPillStyle(f.status)}>{f.status}</span>
                {f.linkedTaskIds.length + f.linkedGoalIds.length > 0 && (
                  <span style={{ font: "400 10.5px var(--font-mono)", color: "var(--brand-blue)" }}>↔ {f.linkedTaskIds.length + f.linkedGoalIds.length} vínculo(s)</span>
                )}
                {f.pinned && <span style={{ font: "400 10.5px var(--font-mono)", color: "var(--ok-fg)" }}>⤓ offline</span>}
              </span>
            </span>
          </button>
        ))}
      </div>

      {docs.length === 0 && <p style={{ margin: 0, padding: "22px 0", font: "400 12.5px/1.6 var(--font-body)", color: "var(--ink-muted-3)" }}>Nenhum documento com esses filtros.</p>}

      <button
        onClick={fetchNew}
        disabled={refresh.isPending}
        style={{ marginTop: 16, width: "100%", minHeight: 48, border: "1px solid var(--border-4)", borderRadius: 12, background: "var(--surface)", color: "var(--brand-blue)", font: "500 12.5px var(--font-display)" }}
      >
        Buscar documentos novos
      </button>
      <p style={{ margin: "12px 0 0", font: "400 11px/1.6 var(--font-body)", color: "var(--ink-muted-5)" }}>
        Espelha <span style={{ fontFamily: "var(--font-mono)" }}>/folders/1rtRecy…QoBM</span> em segundo plano. O app lê o Drive; nunca altera nem apaga arquivo.
      </p>

      {docId && <DocDetailSheet id={docId} onClose={() => setParams({})} />}
    </div>
  );
}
