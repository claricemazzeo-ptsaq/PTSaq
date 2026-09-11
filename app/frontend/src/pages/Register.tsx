import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { ApiError } from "../api/client";

const DEPTS = [
  { id: "com", label: "Comunicação" },
  { id: "jur", label: "Jurídico" },
  { id: "tec", label: "Tecnologia" },
  { id: "adm", label: "Administrativo" },
];

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dept, setDept] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = name && email && password.length >= 10 && dept;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      await register({ name, email, password, departmentId: dept });
      nav("/pending");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError("Já existe uma conta com esse e-mail.");
      else if (e instanceof ApiError && e.body && (e.body as { error?: string }).error === "domain_not_allowed") setError("Use seu e-mail institucional.");
      else setError("Não foi possível criar a conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ flex: 1, padding: "64px 26px 30px" }}>
      <Link to="/login" style={{ display: "inline-block", minHeight: 40, marginBottom: 16, font: "400 12.5px var(--font-body)", color: "var(--brand-blue)" }}>
        ← Voltar
      </Link>
      <h1 style={{ margin: "0 0 6px", font: "600 26px/1.15 var(--font-display)", letterSpacing: "-.5px" }}>Criar conta</h1>
      <p style={{ margin: "0 0 24px", font: "400 12.5px/1.55 var(--font-body)", color: "var(--ink-muted-2)" }}>
        Contas novas passam por aprovação do executivo antes de ver os dados operacionais.
      </p>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", font: "500 11px var(--font-display)", color: "var(--ink-muted-1)", marginBottom: 6 }}>Nome completo</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como aparece na planilha"
          required
          style={{ width: "100%", minHeight: 50, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-4)", background: "var(--surface)", font: "400 13px var(--font-body)", outline: "none" }}
        />
        <label style={{ display: "block", font: "500 11px var(--font-display)", color: "var(--ink-muted-1)", margin: "14px 0 6px" }}>E-mail corporativo</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="nome@saquarema.rj.gov.br"
          required
          style={{ width: "100%", minHeight: 50, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-4)", background: "var(--surface)", font: "400 13px var(--font-body)", outline: "none" }}
        />
        <p style={{ margin: "6px 0 0", font: "400 10.5px/1.5 var(--font-body)", color: "var(--ink-muted-5)" }}>Só domínios oficiais são aceitos.</p>
        <label style={{ display: "block", font: "500 11px var(--font-display)", color: "var(--ink-muted-1)", margin: "14px 0 6px" }}>Senha</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Mínimo de 10 caracteres"
          required
          minLength={10}
          style={{ width: "100%", minHeight: 50, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-4)", background: "var(--surface)", font: "400 13px var(--font-body)", outline: "none" }}
        />
        <label style={{ display: "block", font: "500 11px var(--font-display)", color: "var(--ink-muted-1)", margin: "18px 0 8px" }}>Frente de atuação</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DEPTS.map((d) => (
            <button
              type="button"
              key={d.id}
              onClick={() => setDept(d.id)}
              style={{
                flex: 1,
                minWidth: "calc(50% - 4px)",
                minHeight: 44,
                borderRadius: 11,
                font: "500 12px var(--font-display)",
                border: `1px solid ${dept === d.id ? "var(--brand-blue)" : "var(--border-4)"}`,
                background: dept === d.id ? "var(--info-bg)" : "var(--surface)",
                color: dept === d.id ? "var(--info-fg)" : "var(--ink-muted-1)",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        {error && <p style={{ margin: "14px 0 0", font: "400 12px var(--font-body)", color: "var(--danger-fg)" }}>{error}</p>}
        <button
          type="submit"
          disabled={!ready || loading}
          style={{ marginTop: 18, width: "100%", minHeight: 52, border: 0, borderRadius: 12, font: "500 13.5px var(--font-display)", background: ready ? "var(--brand-green)" : "var(--surface-sunken)", color: ready ? "#08281f" : "var(--ink-muted-5)" }}
        >
          {loading ? "Enviando…" : "Enviar para aprovação"}
        </button>
      </form>
    </div>
  );
}
