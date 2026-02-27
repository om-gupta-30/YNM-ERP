"use client";

import * as React from "react";

type Slice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function PieChart(props: { title: string; subtitle?: string; slices: Slice[] }) {
  const total = props.slices.reduce((s, x) => s + x.value, 0);
  const safeTotal = total > 0 ? total : 1;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;

  const paths = React.useMemo(() => {
    return props.slices
      .filter((s) => s.value > 0)
      .reduce<{ angle: number; out: Array<Slice & { startAngle: number; endAngle: number }> }>(
        (acc, s) => {
          const start = acc.angle;
          const delta = (s.value / safeTotal) * 360;
          const end = start + delta;
          return { angle: end, out: [...acc.out, { ...s, startAngle: start, endAngle: end }] };
        },
        { angle: 0, out: [] },
      ).out;
  }, [props.slices, safeTotal]);

  return (
    <div className="ds-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="ds-h3">{props.title}</div>
          {props.subtitle ? (
            <div className="mt-0.5 ds-caption">{props.subtitle}</div>
          ) : null}
        </div>
        <div className="text-xs tabular-nums text-stone-400">Total: {total}</div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-center">
        <div className="flex justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
            {paths.map((p) => (
              <path key={p.key} d={arcPath(cx, cy, r, p.startAngle, p.endAngle)} fill={p.color} />
            ))}
            <circle cx={cx} cy={cy} r={42} fill="#fff" />
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize={10} fill="#a1a1aa">
              Inventory
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize={16} fontWeight={700} fill="#18181b">
              {total}
            </text>
          </svg>
        </div>

        <div className="space-y-2">
          {props.slices
            .filter((s) => s.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((s) => {
              const pct = Math.round((s.value / safeTotal) * 100);
              return (
                <div key={s.key} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-sm"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    <div className="truncate text-xs font-medium text-stone-600">{s.label}</div>
                  </div>
                  <div className="text-xs tabular-nums text-stone-400">
                    {s.value} ({pct}%)
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
