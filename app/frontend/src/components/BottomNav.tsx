import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Início", icon: "✓" },
  { to: "/frentes", label: "Frentes", icon: "▤" },
  { to: "/painel", label: "Painel", icon: "◵" },
  { to: "/docs", label: "Docs", icon: "❐" },
  { to: "/perfil", label: "Perfil", icon: "⇅" },
];

export function BottomNav() {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 35,
        height: 76,
        background: "var(--brand-paper)",
        borderTop: "1px solid var(--border-1)",
        display: "flex",
        padding: "6px 8px 14px",
      }}
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          style={({ isActive }) => ({
            flex: 1,
            minHeight: 48,
            border: 0,
            background: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            color: isActive ? "var(--brand-blue)" : "var(--ink-muted-4)",
            textDecoration: "none",
          })}
        >
          {({ isActive }) => (
            <>
              <span style={{ fontSize: 17, lineHeight: 1, color: isActive ? "var(--brand-blue)" : "var(--ink-muted-5)" }}>{item.icon}</span>
              <span style={{ font: "500 10px var(--font-display)", letterSpacing: ".01em" }}>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
