"use client";

import * as React from "react";
import type { BuildupPoint } from "@/lib/cross-tower/composeProjects";

const W = 720;
const H = 260;
const PAD_L = 52;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;

type Props = {
  buildup: BuildupPoint[];
  redact: boolean;
};

/**
 * Fixed-size SVG cumulative curve — print-safe (no ResponsiveContainer).
 */
export function DeckValueChart({ buildup, redact }: Props) {
  const { pathD, maxY, ticks } = React.useMemo(() => {
    if (buildup.length === 0) {
      return { pathD: "", maxY: 1, ticks: [0] as number[] };
    }
    const maxY = Math.max(
      ...buildup.map((p) => p.cumulativeAiUsd),
      1,
    );
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const n = buildup.length;
    const pts = buildup.map((p, i) => {
      const x = PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
      const y = PAD_T + innerH - (p.cumulativeAiUsd / maxY) * innerH;
      return { x, y, m: p.month, v: p.cumulativeAiUsd };
    });
    const d = pts
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(" ");
    const tickCount = 5;
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      ticks.push((maxY * i) / (tickCount - 1));
    }
    return { pathD: d, maxY, ticks };
  }, [buildup]);

  const fmtAxis = (v: number) => {
    if (redact) return "—";
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return `${Math.round(v)}`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[720px] text-forge-ink"
      role="img"
      aria-label="24-month cumulative modeled AI value"
    >
      <rect
        x={PAD_L}
        y={PAD_T}
        width={W - PAD_L - PAD_R}
        height={H - PAD_T - PAD_B}
        fill="#FAFAFC"
        stroke="#E0E0E0"
        strokeWidth={1}
        rx={4}
      />
      {ticks.map((tv, i) => {
        const innerH = H - PAD_T - PAD_B;
        const y = PAD_T + innerH - (tv / maxY) * innerH;
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="#E8E8EE"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={PAD_L - 6}
              y={y + 4}
              textAnchor="end"
              className="fill-forge-subtle font-mono text-[10px]"
            >
              {fmtAxis(tv)}
            </text>
          </g>
        );
      })}
      {pathD ? (
        <path
          d={pathD}
          fill="none"
          stroke="#A100FF"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <text
        x={PAD_L}
        y={H - 8}
        className="fill-forge-subtle font-mono text-[10px]"
      >
        Month 1 → 24
      </text>
      {redact ? (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          className="fill-forge-subtle font-sans text-sm"
        >
          Values redacted
        </text>
      ) : null}
    </svg>
  );
}
