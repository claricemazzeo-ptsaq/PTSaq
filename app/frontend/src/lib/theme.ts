import type { CSSProperties } from "react";

export const TASK_STATUS_COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  "Executado": { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-dot)" },
  "Concluída": { bg: "var(--ok-bg)", fg: "var(--ok-fg)", dot: "var(--ok-dot)" },
  "Em execução": { bg: "var(--info-bg)", fg: "var(--info-fg)", dot: "var(--info-dot)" },
  "Em andamento": { bg: "var(--info-bg)", fg: "var(--info-fg)", dot: "var(--info-dot)" },
  "Não iniciado": { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dot: "var(--neutral-dot)" },
  "A iniciar": { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dot: "var(--neutral-dot)" },
  "Justificada": { bg: "var(--danger-bg)", fg: "var(--danger-fg)", dot: "var(--danger-dot)" },
};

export const DOC_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  "Aprovado": { bg: "var(--ok-bg)", fg: "var(--ok-fg)" },
  "Em revisão": { bg: "var(--info-bg)", fg: "var(--info-fg)" },
  "Aguardando assinatura": { bg: "var(--warn-bg)", fg: "var(--warn-fg)" },
};

export const FILE_INK: Record<string, { bg: string; fg: string }> = {
  PDF: { bg: "var(--file-pdf-bg)", fg: "var(--file-pdf-fg)" },
  DOCX: { bg: "var(--file-docx-bg)", fg: "var(--file-docx-fg)" },
  XLSX: { bg: "var(--file-xlsx-bg)", fg: "var(--file-xlsx-fg)" },
  SVG: { bg: "var(--file-other-bg)", fg: "var(--file-other-fg)" },
  PNG: { bg: "var(--file-other-bg)", fg: "var(--file-other-fg)" },
};

export function pillStyle(status: string): CSSProperties {
  const c = TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS["A iniciar"];
  return {
    display: "inline-block",
    flex: "none",
    padding: "4px 9px",
    borderRadius: 20,
    whiteSpace: "nowrap",
    background: c.bg,
    color: c.fg,
    font: "500 10.5px var(--font-display)",
  };
}

export function unlockedPillStyle(): CSSProperties {
  return {
    display: "inline-block",
    flex: "none",
    padding: "4px 9px",
    borderRadius: 20,
    whiteSpace: "nowrap",
    background: "var(--brand-green)",
    color: "#08281f",
    font: "500 10.5px var(--font-display)",
    animation: "pulsedot 1.4s ease-in-out 4",
  };
}

export function docPillStyle(status: string): CSSProperties {
  const c = DOC_STATUS_COLORS[status] || DOC_STATUS_COLORS["Em revisão"];
  return {
    display: "inline-block",
    flex: "none",
    padding: "4px 9px",
    borderRadius: 20,
    whiteSpace: "nowrap",
    background: c.bg,
    color: c.fg,
    font: "500 10.5px var(--font-display)",
  };
}

export function fileTileStyle(ext: string, size: number, fontSize: number): CSSProperties {
  const ink = FILE_INK[ext] || FILE_INK.PDF;
  return {
    width: size,
    height: size,
    flex: "none",
    borderRadius: Math.round(size / 4),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    font: `600 ${fontSize}px var(--font-mono)`,
    letterSpacing: "-.02em",
    background: ink.bg,
    color: ink.fg,
  };
}

export function dueStyle(dueDays: number | null): CSSProperties {
  return { font: "400 11.5px var(--font-body)", color: dueDays != null && dueDays <= 7 ? "var(--danger-dot)" : "var(--ink-muted-3)" };
}

export function dueLabel(dueDate: string | null, dueDays: number | null): string {
  if (!dueDate) return "sem prazo";
  const d = new Date(dueDate);
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return label;
}

export function formatBRL(cents: number | null): string {
  if (cents == null) return "não informado";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} d`;
}
