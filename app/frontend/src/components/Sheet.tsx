import type { ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  top?: number; // px from the top of the shell where the sheet begins
  kicker?: string;
  title?: string;
  closeLabel?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, top = 100, kicker, title, closeLabel = "Fechar", children }: SheetProps) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 56, background: "rgba(20,32,28,.42)" }} onClick={onClose}>
      <div
        className="scroll-y"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top,
          background: "var(--brand-paper)",
          borderRadius: "22px 22px 0 0",
          animation: "rise .24s ease-out",
          boxShadow: "var(--shadow-sheet)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "var(--brand-paper)",
            padding: "10px 20px 12px",
            borderBottom: "1px solid var(--border-1)",
            zIndex: 2,
          }}
        >
          <div style={{ width: 38, height: 4, borderRadius: 2, background: "#D9D6C7", margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ minWidth: 0 }}>
              {kicker && (
                <span
                  style={{
                    display: "block",
                    font: "500 10.5px var(--font-mono)",
                    color: "var(--ink-muted-3)",
                    letterSpacing: ".07em",
                    textTransform: "uppercase",
                  }}
                >
                  {kicker}
                </span>
              )}
              {title && <span style={{ display: "block", font: "600 16px var(--font-display)", marginTop: kicker ? 2 : 0 }}>{title}</span>}
            </span>
            <button
              onClick={onClose}
              style={{ flex: "none", minWidth: 48, minHeight: 36, border: 0, background: "none", font: "400 13px var(--font-body)", color: "var(--brand-blue)" }}
            >
              {closeLabel}
            </button>
          </div>
        </div>
        <div style={{ padding: "16px 20px 32px" }}>{children}</div>
      </div>
    </div>
  );
}
