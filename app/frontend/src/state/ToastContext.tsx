import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastState {
  flash: (text: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flash = useCallback((t: string) => {
    clearTimeout(timer.current);
    setText(t);
    timer.current = setTimeout(() => setText(""), 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ flash }}>
      {children}
      {text && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 92,
            zIndex: 200,
            width: "calc(min(480px, 100%) - 40px)",
            padding: "13px 15px",
            borderRadius: 11,
            background: "var(--ink)",
            color: "var(--brand-paper)",
            font: "400 12.5px/1.45 var(--font-body)",
            animation: "rise .2s ease-out",
          }}
        >
          {text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
