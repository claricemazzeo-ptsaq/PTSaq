import { Link } from "react-router-dom";

export function Pending() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "60px 26px" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--warn-bg)", color: "var(--warn-fg)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 20px var(--font-display)", marginBottom: 20 }}>
        ⏳
      </div>
      <h1 style={{ margin: "0 0 10px", font: "600 26px/1.2 var(--font-display)", letterSpacing: "-.5px" }}>Conta em aprovação</h1>
      <p style={{ margin: "0 0 8px", maxWidth: "32ch", font: "400 13.5px/1.6 var(--font-body)", color: "var(--ink-muted-1)" }}>
        O executivo recebeu o pedido e aprova pelo próprio aplicativo. Você recebe acesso assim que ele for liberado.
      </p>
      <p style={{ margin: "0 0 26px", font: "400 11.5px/1.6 var(--font-body)", color: "var(--ink-muted-5)" }}>Enquanto isso, nenhum dado operacional fica visível.</p>
      <Link
        to="/login"
        style={{ minHeight: 48, display: "flex", alignItems: "center", padding: "0 20px", border: "1px solid var(--border-5)", borderRadius: 12, background: "var(--surface)", color: "var(--ink)", font: "500 12.5px var(--font-display)" }}
      >
        Voltar ao login
      </Link>
    </div>
  );
}
