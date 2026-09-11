import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "./Sheet";
import { useDocument, useTogglePin } from "../hooks/useDocuments";
import { useTasks } from "../hooks/useTasks";
import { useGoals } from "../hooks/useGoals";
import { fileTileStyle, docPillStyle, pillStyle, formatDateTime } from "../lib/theme";
import { useToast } from "../state/ToastContext";

function bytesToSize(n: number | null): string {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export function DocDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const nav = useNavigate();
  const { flash } = useToast();
  const { data: doc } = useDocument(id);
  const { data: tasks } = useTasks();
  const { data: goals } = useGoals();
  const togglePin = useTogglePin();
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!doc) return null;

  const linkedTasks = (tasks || []).filter((t) => doc.linkedTaskIds.includes(t.id));
  const linkedGoals = (goals || []).filter((g) => doc.linkedGoalIds.includes(g.id));

  return (
    <Sheet open onClose={onClose} top={70} kicker={`Repositório · ${doc.departmentId ? doc.departmentId.toUpperCase() : "Global"}`}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        <span style={fileTileStyle(doc.type, 46, 14)}>{doc.type}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", font: "600 18px/1.3 var(--font-display)", color: "var(--ink)", letterSpacing: "-.2px" }}>{doc.title}</span>
          <span style={{ display: "block", font: "400 11.5px/1.5 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 5 }}>
            {doc.version || "—"} · {bytesToSize(doc.sizeBytes)} · atualizado {formatDateTime(doc.driveUpdatedAt)}
          </span>
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <span style={docPillStyle(doc.status)}>{doc.status}</span>
      </div>

      {doc.note && (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--warn-bg)", marginBottom: 18 }}>
          <div style={{ font: "500 10.5px var(--font-mono)", color: "var(--warn-fg)", letterSpacing: ".06em", textTransform: "uppercase" }}>Situação do arquivo</div>
          <div style={{ font: "400 12.5px/1.5 var(--font-body)", color: "var(--warn-fg)", marginTop: 6 }}>{doc.note}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
        <button onClick={() => setPreviewOpen(true)} style={{ minHeight: 48, border: 0, borderRadius: 11, background: "var(--brand-blue)", color: "var(--brand-paper)", font: "500 12px var(--font-display)" }}>
          Prévia rápida
        </button>
        <button
          onClick={() => togglePin.mutate({ id: doc.id, pin: !doc.pinned })}
          style={{
            minHeight: 48,
            borderRadius: 11,
            font: "500 11.5px var(--font-display)",
            border: `1px solid ${doc.pinned ? "var(--brand-green)" : "var(--border-4)"}`,
            background: doc.pinned ? "var(--ok-bg)" : "var(--surface)",
            color: doc.pinned ? "var(--ok-fg)" : "var(--ink-muted-1)",
          }}
        >
          {doc.pinned ? "✓ Fixado offline" : "Fixar offline"}
        </button>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(`${location.origin}/docs?doc=${doc.id}`).catch(() => void 0);
            flash("Link de visualização copiado.");
          }}
          style={{ minHeight: 48, border: "1px solid var(--border-4)", borderRadius: 11, background: "var(--surface)", color: "var(--ink-muted-1)", font: "500 11.5px var(--font-display)" }}
        >
          Compartilhar link
        </button>
        <a
          href={doc.driveFileId ? `https://drive.google.com/file/d/${doc.driveFileId}/view` : "#"}
          target="_blank"
          rel="noreferrer"
          style={{
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border-4)",
            borderRadius: 11,
            background: "var(--surface)",
            color: "var(--ink-muted-1)",
            font: "500 11.5px var(--font-display)",
          }}
        >
          Abrir no Drive ↗
        </a>
      </div>

      {(linkedTasks.length > 0 || linkedGoals.length > 0) && (
        <>
          <h2 style={{ margin: "0 0 9px", font: "600 14px var(--font-display)" }}>Vinculado a</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 22 }}>
            {linkedTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => nav(`/?open=task:${t.id}`)}
                style={{ width: "100%", textAlign: "left", padding: "12px 13px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", display: "flex", gap: 10, alignItems: "center" }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "500 10px var(--font-mono)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Tarefa</span>
                  <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)", color: "var(--ink)", marginTop: 4 }}>{t.title}</span>
                </span>
                <span style={pillStyle(t.status)}>{t.status}</span>
              </button>
            ))}
            {linkedGoals.map((g) => (
              <button
                key={g.id}
                onClick={() => nav(`/?open=goal:${g.id}`)}
                style={{ width: "100%", textAlign: "left", padding: "12px 13px", borderRadius: 11, border: "1px solid var(--border-2)", background: "var(--surface)", display: "flex", gap: 10, alignItems: "center" }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "500 10px var(--font-mono)", color: "var(--ink-muted-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Meta</span>
                  <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)", color: "var(--ink)", marginTop: 4 }}>
                    Meta {g.id} · {g.title}
                  </span>
                </span>
                <span style={pillStyle(g.status)}>{g.status}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ paddingTop: 14, borderTop: "1px solid var(--border-1)", font: "400 11px/1.6 var(--font-body)", color: "var(--ink-muted-5)" }}>
        Origem: <span style={{ fontFamily: "var(--font-mono)" }}>Drive /folders/1rtRecy…QoBM</span>
      </div>

      {previewOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 220, background: "var(--ink)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "20px 18px 12px", color: "var(--brand-paper)" }}>
            <span style={{ font: "500 12.5px/1.3 var(--font-display)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
            <button onClick={() => setPreviewOpen(false)} style={{ minWidth: 48, minHeight: 40, border: 0, background: "none", color: "var(--brand-paper)", font: "400 13px var(--font-body)" }}>
              Fechar
            </button>
          </div>
          <div className="scroll-y" style={{ flex: 1, padding: "0 18px 18px" }}>
            <div style={{ background: "#fff", borderRadius: 6, padding: "34px 30px", minHeight: 400, boxShadow: "0 8px 26px rgba(0,0,0,.4)" }}>
              <div style={{ height: 9, width: "34%", background: "var(--ink)", borderRadius: 1 }} />
              <div style={{ height: 9, width: "52%", background: "var(--ink)", borderRadius: 1, marginTop: 9 }} />
              <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 8 }}>
                {[100, 96, 99, 62].map((w, i) => (
                  <div key={i} style={{ height: 5, width: `${w}%`, background: "#E3E0D5", borderRadius: 1 }} />
                ))}
              </div>
              <p style={{ margin: "26px 0 0", font: "400 11px/1.6 var(--font-body)", color: "var(--ink-muted-5)", textAlign: "center" }}>
                Placeholder de renderização — o visualizador real usa a prévia nativa do Drive.
              </p>
            </div>
          </div>
          <div style={{ padding: "10px 18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "rgba(255,249,231,.62)", font: "400 11px var(--font-mono)" }}>
            <span>
              {doc.type} · {doc.version}
            </span>
          </div>
        </div>
      )}
    </Sheet>
  );
}
