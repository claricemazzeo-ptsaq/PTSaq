import { useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { useAuth } from "../state/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { SyncStatusBar } from "./SyncStatusBar";

export function Header({ onOpenNotifications }: { onOpenNotifications: () => void }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const nav = useNavigate();
  if (!user) return null;

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--brand-paper)", borderBottom: "1px solid var(--border-1)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <BrandMark width={30} height={18} gradientId="ptsMarkHeader" />
          <div>
            <div style={{ font: "600 15px/1 var(--font-display)", letterSpacing: "-.2px" }}>PTSaq</div>
            <div style={{ font: "400 10px/1.3 var(--font-body)", color: "var(--ink-muted-3)" }}>Hub de Operações</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onOpenNotifications}
            style={{ position: "relative", width: 36, height: 36, border: 0, borderRadius: "50%", background: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Avisos"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted-2)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
              <path d="M10.5 20a2 2 0 0 0 3 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  minWidth: 15,
                  height: 15,
                  padding: "0 4px",
                  borderRadius: 8,
                  background: "var(--danger-dot)",
                  color: "#fff",
                  font: "600 9px/15px var(--font-display)",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => nav("/perfil")}
            style={{
              width: 34,
              height: 34,
              flex: "none",
              borderRadius: "50%",
              border: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "600 13px var(--font-display)",
              background: user.role === "admin" ? "var(--ink)" : "var(--brand-blue)",
              color: "var(--brand-paper)",
            }}
            aria-label="Perfil"
          >
            {user.name.charAt(0)}
          </button>
        </div>
      </div>
      <SyncStatusBar />
    </div>
  );
}
