"use client";

import * as React from "react";

export function FormModal(props: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="fixed inset-0 bg-stone-950/30 backdrop-blur-sm" aria-hidden />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl shadow-stone-300/30"
        style={{ animation: "fade-in 0.2s ease-out" }}
      >
        <div className="border-b border-stone-100 px-6 py-4">
          <div className="ds-h2">{props.title}</div>
          {props.description ? (
            <div className="mt-1 ds-subtitle">{props.description}</div>
          ) : null}
        </div>
        <div className="px-6 py-5">{props.children}</div>
        {props.footer ? (
          <div className="border-t border-stone-100 bg-stone-50/50 px-6 py-4">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
