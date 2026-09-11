import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, refreshAccessToken } from "../api/client";
import type { Department, User } from "../api/types";

// The access token cookie lives 15 minutes (see backend auth/tokens.ts);
// refreshing every 10 keeps an open, active tab from ever actually
// hitting that expiry — the reactive 401-triggered refresh in api/client.ts
// is the fallback for tabs that were idle/suspended past that window.
const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

interface AuthState {
  user: User | null;
  department: Department | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; departmentId: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  pendingApproval: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: User; department: Department | null }>("/me");
      setUser(res.user);
      setDepartment(res.department);
      setPendingApproval(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && (e.body as { status?: string })?.status) {
        setPendingApproval((e.body as { status?: string }).status === "pending");
      }
      setUser(null);
      setDepartment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshAccessToken();
    }, PROACTIVE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post("/auth/login", { email, password });
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(async (data: { name: string; email: string; password: string; departmentId: string }) => {
    await api.post("/auth/register", data);
    setPendingApproval(true);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
    setDepartment(null);
  }, []);

  const value = useMemo(
    () => ({ user, department, loading, login, register, logout, refresh, pendingApproval }),
    [user, department, loading, login, register, logout, refresh, pendingApproval],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
