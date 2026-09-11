import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../state/AuthContext";
import { ApiError, API_ORIGIN } from "../api/client";
import { useEffect } from "react";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    const errParam = params.get("error");
    if (errParam) setError(errParam);
    fetch(`${API_ORIGIN}/health`)
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.googleOAuth))
      .catch(() => void 0);
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        nav("/pending");
        return;
      }
      setError("E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "70px 26px 30px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 20, background: "var(--ok-bg)", color: "var(--ok-fg)", font: "500 10.5px var(--font-mono)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-green)", animation: "pulsedot 3s infinite" }} />
          Servidor conectado
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
        <div style={{ marginBottom: 22 }}>
          <BrandMark width={96} height={57} gradientId="ptsMarkLogin" />
        </div>
        <h1 style={{ margin: "0 0 6px", font: "600 30px/1.1 var(--font-display)", letterSpacing: "-.8px" }}>
          Parque Tecnológico
          <br />
          de Saquarema
        </h1>
        <p style={{ margin: "0 0 30px", font: "400 13px/1.5 var(--font-body)", color: "var(--ink-muted-2)" }}>Hub de Operações · acesso da equipe</p>

        {googleEnabled && (
          <>
            <a
              href={`${API_ORIGIN}/auth/google`}
              style={{
                width: "100%",
                minHeight: 52,
                border: "1px solid var(--border-5)",
                borderRadius: 12,
                background: "var(--surface)",
                color: "var(--ink)",
                font: "500 13.5px var(--font-display)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                textDecoration: "none",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 1.9-1.5 4.7-4.4 6.6l6.8 5.3C42.4 35.4 45 30.2 45 24z" />
                <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.8-5.3c-1.9 1.3-4.4 2.2-7.7 2.2-5.9 0-10.9-3.9-12.7-9.2l-7 5.4C7.9 41 15.4 46 24 46z" />
                <path fill="#FBBC05" d="M11.3 28.4A13.6 13.6 0 0 1 10.6 24c0-1.5.3-3 .7-4.4l-7-5.4A22 22 0 0 0 2 24c0 3.5.8 6.9 2.3 9.8z" />
                <path fill="#EA4335" d="M24 10.6c4.2 0 7 1.8 8.6 3.3l6.3-6.1C35 4.2 29.9 2 24 2 15.4 2 7.9 7 4.3 14.2l7 5.4C13.1 14.5 18.1 10.6 24 10.6z" />
              </svg>
              Entrar com o Google corporativo
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <span style={{ flex: 1, height: 1, background: "var(--border-3)" }} />
              <span style={{ font: "400 11px var(--font-body)", color: "var(--ink-muted-5)" }}>ou</span>
              <span style={{ flex: 1, height: 1, background: "var(--border-3)" }} />
            </div>
          </>
        )}

        <form onSubmit={onSubmit}>
          <label style={{ display: "block", font: "500 11px var(--font-display)", color: "var(--ink-muted-1)", marginBottom: 6 }}>E-mail corporativo</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{ width: "100%", minHeight: 50, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-4)", background: "var(--surface)", font: "400 13px var(--font-body)", color: "var(--ink)", outline: "none" }}
          />
          <label style={{ display: "block", font: "500 11px var(--font-display)", color: "var(--ink-muted-1)", margin: "14px 0 6px" }}>Senha</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 8, borderRadius: 12, border: "1px solid var(--border-4)", background: "var(--surface)" }}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              required
              style={{ flex: 1, minWidth: 0, minHeight: 50, padding: "0 14px", border: 0, background: "none", font: "400 13px var(--font-body)", color: "var(--ink)", outline: "none" }}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} style={{ minHeight: 40, padding: "0 10px", border: 0, borderRadius: 8, background: "none", color: "var(--brand-blue)", font: "500 11px var(--font-display)" }}>
              {showPw ? "ocultar" : "mostrar"}
            </button>
          </div>
          {error && <p style={{ margin: "10px 0 0", font: "400 12px var(--font-body)", color: "var(--danger-fg)" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 14, width: "100%", minHeight: 52, border: 0, borderRadius: 12, background: "var(--brand-green)", color: "#08281f", font: "500 13.5px var(--font-display)" }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <Link to="/register" style={{ minHeight: 44, display: "flex", alignItems: "center", font: "400 12.5px var(--font-body)", color: "var(--brand-blue)" }}>
          Primeiro acesso? Criar conta
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 9, font: "400 10.5px var(--font-body)", color: "var(--ink-muted-5)" }}>
          <span>Uma realização</span>
          <span style={{ font: "600 11px var(--font-display)", color: "var(--ink-muted-3)" }}>Agência Inova</span>
        </div>
      </div>
    </div>
  );
}
