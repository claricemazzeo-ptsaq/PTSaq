import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/AuthContext";
import { AppShell } from "./components/AppShell";
import { AuthShell } from "./components/AuthShell";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Pending } from "./pages/Pending";
import { Home } from "./pages/Home";
import { Departments } from "./pages/Departments";
import { DepartmentDetail } from "./pages/DepartmentDetail";
import { Dashboard } from "./pages/Dashboard";
import { Docs } from "./pages/Docs";
import { Profile } from "./pages/Profile";

function Splash() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted-3)", font: "400 13px var(--font-body)" }}>
      Carregando…
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, pendingApproval } = useAuth();
  if (loading) return <Splash />;
  if (pendingApproval) return <Navigate to="/pending" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><AuthShell><Login /></AuthShell></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><AuthShell><Register /></AuthShell></PublicOnly>} />
      <Route path="/pending" element={<AuthShell><Pending /></AuthShell>} />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/frentes" element={<Departments />} />
        <Route path="/frentes/:id" element={<DepartmentDetail />} />
        <Route path="/painel" element={<Dashboard />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
