import * as React from "react";

const toneMap: Record<string, string> = {
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  inactive: "bg-red-50 text-red-700 border-red-200",
  low: "bg-red-50 text-red-700 border-red-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dispatched: "bg-emerald-50 text-emerald-700 border-emerald-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inward: "bg-emerald-50 text-emerald-700 border-emerald-200",
  issued: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  "in progress": "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  outward: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-sky-50 text-sky-700 border-sky-200",
  sent: "bg-sky-50 text-sky-700 border-sky-200",
  quoted: "bg-sky-50 text-sky-700 border-sky-200",
  draft: "bg-stone-50 text-stone-600 border-stone-200",
  open: "bg-stone-50 text-stone-600 border-stone-200",
  planned: "bg-stone-50 text-stone-600 border-stone-200",
  closed: "bg-stone-100 text-stone-500 border-stone-200",
};

function getTone(value: string): string {
  const v = value.toLowerCase().replace(/[-_\s]+/g, "_");
  if (toneMap[v]) return toneMap[v];
  for (const [key, tone] of Object.entries(toneMap)) {
    if (v.includes(key)) return tone;
  }
  return "bg-stone-50 text-stone-600 border-stone-200";
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors duration-150",
        getTone(value),
      ].join(" ")}
    >
      {value}
    </span>
  );
}
