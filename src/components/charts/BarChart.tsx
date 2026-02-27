"use client";

import * as React from "react";

type Series = {
  key: string;
  label: string;
  barClass: string;
  swatchClass: string;
  values: number[];
};

export function BarChart(props: {
  title: string;
  subtitle?: string;
  categories: string[];
  series: Series[];
}) {
  const { categories, series } = props;
  const max = React.useMemo(() => {
    const vals = series.flatMap((s) => s.values);
    return Math.max(1, ...vals);
  }, [series]);

  const w = 760;
  const h = 220;
  const padL = 42;
  const padR = 18;
  const padT = 16;
  const padB = 46;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const groupCount = Math.max(1, categories.length);
  const barCount = Math.max(1, series.length);
  const groupW = plotW / groupCount;
  const gap = Math.min(10, groupW * 0.18);
  const inner = groupW - gap;
  const barW = inner / barCount;

  function yScale(v: number) {
    return padT + plotH - (v / max) * plotH;
  }
  function barH(v: number) {
    return (v / max) * plotH;
  }

  const gridLines = 4;
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => (max * i) / gridLines);

  return (
    <div className="ds-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="ds-h3">{props.title}</div>
          {props.subtitle ? (
            <div className="mt-0.5 ds-caption">{props.subtitle}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className={`inline-block size-2 rounded-sm ${s.swatchClass}`} aria-hidden />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[680px]">
          {ticks.map((t, idx) => {
            const y = yScale(t);
            return (
              <g key={idx}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e7e5e4" strokeWidth={1} />
                <text x={padL - 8} y={y + 4} fontSize={10} fill="#a8a29e" textAnchor="end">
                  {Math.round(t)}
                </text>
              </g>
            );
          })}

          {categories.map((cat, gi) => {
            const gx = padL + gi * groupW + gap / 2;
            return (
              <g key={`${gi}-${cat}`}>
                {series.map((s, si) => {
                  const v = s.values[gi] ?? 0;
                  const x = gx + si * barW + 2;
                  const y = yScale(v);
                  const hh = barH(v);
                  return (
                    <rect
                      key={s.key}
                      x={x}
                      y={y}
                      width={Math.max(2, barW - 4)}
                      height={hh}
                      rx={3}
                      className={s.barClass}
                      style={{ transition: "height 0.3s ease-out, y 0.3s ease-out" }}
                    />
                  );
                })}
                <text
                  x={gx + inner / 2}
                  y={padT + plotH + 22}
                  fontSize={10}
                  fill="#78716c"
                  textAnchor="middle"
                >
                  {cat}
                </text>
              </g>
            );
          })}

          <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#d6d3d1" strokeWidth={1} />
          <line x1={padL} x2={w - padR} y1={padT + plotH} y2={padT + plotH} stroke="#d6d3d1" strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}
