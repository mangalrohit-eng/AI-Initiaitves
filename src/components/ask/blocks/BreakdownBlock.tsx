"use client";

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
  CHART_TICK_COLOR,
  CHART_TOOLTIP_CURSOR,
  CHART_TOOLTIP_STYLE,
  ChartSurface,
} from "@/components/charts/ChartSurface";
import { useRedactDollars } from "@/lib/clientMode";
import type { AskBreakdownBlock } from "@/lib/ask/types";

// Predictable color sequence for stacked segments (purple primary → teal → amber → green → red).
const SEGMENT_COLORS = ["#A100FF", "#00BFA5", "#FFB300", "#00C853", "#FF3D00"];

export function BreakdownBlock({ block }: { block: AskBreakdownBlock }) {
  const redact = useRedactDollars();
  const isDollar = block.unit === "$";
  const hideValues = isDollar && redact;

  // Collect unique segment names in stable order.
  const segmentNames: string[] = [];
  for (const row of block.rows) {
    for (const seg of row.segments) {
      if (!segmentNames.includes(seg.name)) segmentNames.push(seg.name);
    }
  }

  // Pivot rows into recharts shape: { name, [segName]: value }.
  const data = block.rows.map((row) => {
    const out: Record<string, string | number> = { name: row.label };
    for (const seg of row.segments) {
      out[seg.name] = seg.value;
    }
    return out;
  });

  const height = Math.max(240, Math.min(560, block.rows.length * 44 + 80));

  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
      <div className="mb-3 text-sm font-semibold tracking-tight text-forge-ink">
        {block.title}
      </div>
      <ChartSurface height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis
            type="number"
            stroke={CHART_AXIS_COLOR}
            tick={{ fill: CHART_TICK_COLOR, fontSize: 11 }}
            tickFormatter={(v) => formatTick(Number(v), block.unit, hideValues)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            stroke={CHART_AXIS_COLOR}
            tick={{ fill: CHART_TICK_COLOR, fontSize: 11 }}
          />
          <Tooltip
            cursor={CHART_TOOLTIP_CURSOR}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value, name) => [
              formatValue(Number(value), block.unit, hideValues),
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: CHART_TICK_COLOR }} />
          {segmentNames.map((name, idx) => (
            <Bar
              key={name}
              dataKey={name}
              stackId="stack"
              fill={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]}
              radius={idx === segmentNames.length - 1 ? [0, 8, 8, 0] : [0, 0, 0, 0]}
              barSize={20}
            />
          ))}
        </BarChart>
      </ChartSurface>
    </div>
  );
}

function formatTick(v: number, unit: AskBreakdownBlock["unit"], hideValues: boolean): string {
  if (hideValues) return "—";
  if (unit === "$") return `$${formatCompact(v)}`;
  if (unit === "%") return `${v.toFixed(0)}%`;
  return formatCompact(v);
}

function formatValue(v: number, unit: AskBreakdownBlock["unit"], hideValues: boolean): string {
  if (hideValues) return "redacted";
  if (unit === "$") return `$${Math.round(v).toLocaleString()}`;
  if (unit === "%") return `${v.toFixed(1)}%`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}
