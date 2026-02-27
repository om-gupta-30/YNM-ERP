"use client";

import * as React from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (t: Omit<ToastItem, "id"> & { durationMs?: number }) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const tones: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-stone-200 bg-white text-stone-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback(
    (t: Omit<ToastItem, "id"> & { durationMs?: number }) => {
      const id = `t_${Math.random().toString(36).slice(2, 10)}`;
      const item: ToastItem = {
        id,
        title: t.title,
        message: t.message,
        variant: t.variant,
      };
      setItems((prev) => [...prev, item]);
      const duration = t.durationMs ?? 3000;
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {items.map((t) => (
            <div
              key={t.id}
              className={[
                "pointer-events-auto rounded-xl border px-4 py-3 shadow-lg",
                tones[t.variant],
              ].join(" ")}
              style={{ animation: "fade-in 0.2s ease-out" }}
              role="status"
              aria-live="polite"
            >
              <div className="text-sm font-medium">{t.title}</div>
              {t.message ? (
                <div className="mt-0.5 text-[13px] opacity-80">{t.message}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
