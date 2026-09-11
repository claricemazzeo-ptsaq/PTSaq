import type { ReactNode } from "react";

/** Same phone-width frame as AppShell, without the header/nav chrome — for login/register/pending. */
export function AuthShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>;
}
