const API_BASE = import.meta.env.VITE_API_URL || "/api";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const message = typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${status}`;
    super(message);
    this.status = status;
    this.body = body;
  }
}

// The access token cookie is short-lived (15 min) by design (see backend
// auth/tokens.ts) — refresh_token rotation is what makes that tolerable.
// A single in-flight refresh is shared across every caller that hits a
// 401 at once, so a burst of requests after the token expires triggers
// one /auth/refresh call, not N of them.
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Proactive refresh, called on a timer while the app is open — keeps the access token from ever actually expiring during an active session, so sockets and requests don't hit the reactive 401 path in normal use. */
export function refreshAccessToken(): Promise<boolean> {
  return attemptRefresh();
}

async function request<T>(path: string, init?: RequestInit, alreadyRetried = false): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    // /auth/* 401s are real auth failures (bad password, expired refresh
    // token) — retrying those against /auth/refresh would be pointless
    // and could loop.
    if (res.status === 401 && !alreadyRetried && !path.startsWith("/auth/")) {
      const refreshed = await attemptRefresh();
      if (refreshed) return request<T>(path, init, true);
    }
    throw new ApiError(res.status, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Base origin (no /api rewrite) for the raw socket.io connection. */
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined) || "http://localhost:4000";
