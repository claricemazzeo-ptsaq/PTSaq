import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { NotificationsSheet } from "./NotificationsSheet";

export function AppShell() {
  const [notifOpen, setNotifOpen] = useState(false);
  return (
    <div className="app-shell">
      <Header onOpenNotifications={() => setNotifOpen(true)} />
      <main className="scroll-y" style={{ flex: 1, minHeight: 0 }}>
        <Outlet />
      </main>
      <BottomNav />
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
