import * as React from "react";

export function KpiCard(props: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="ds-surface relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-gold-400 to-gold-500" />
      <div className="text-[13px] font-medium text-stone-500">{props.label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-950 tabular-nums">
        {props.value}
      </div>
      {props.hint ? (
        <div className="mt-1.5 text-xs text-stone-400">{props.hint}</div>
      ) : null}
    </div>
  );
}
