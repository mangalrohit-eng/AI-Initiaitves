"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
  CHART_TICK_COLOR,
  CHART_TOOLTIP_CURSOR,
  CHART_TOOLTIP_STYLE,
  ChartSurface,
} from "@/components/charts/ChartSurface";
import { useRedactDollars } from "@/lib/clientMode";
import type { AskRankingBlock } from "@/lib/ask/types";

const PRIMARY = "#A100FF";
const FADE = "#D4A8FF";

export function RankingBlock({ block }: { block: AskRankingBlock }) {
  const redact = useRedactDollars();
  const isDollar = block.unit === "$";
  const hideValues = isDollar && redact;

  const data = block.items.map((it, i) => ({
    name: it.label,
    value: it.value,
    sublabel: it.sublabel ?? "",
    fill: i === 0 ? PRIMARY : FADE,
  }));

  // Dynamic height keeps each row at ~36px so 5-row vs 10-row charts feel right.
  const height = Math.max(220, Math.min(640, data.length * 44 + 32));

  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
      <div className="mb-3 text-sm font-semibold tracking-tight text-forge-ink">
        {block.title}
      </div>
      <ChartSurface height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 8 }}>
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
            formatter={(value, _name, item) => {
              const sub = (item?.payload as { sublabel?: string } | undefined)?.sublabel;
              const formatted = formatValue(Number(value), block.unit, hideValues);
              const label = sub ? `${formatted} (${sub})` : formatted;
              return [label, block.title];
            }}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartSurface>
    </div>
  );
}

function formatTick(v: number, unit: AskRankingBlock["unit"], hideValues: boolean): string {
  if (hideValues) return "—";
  if (unit === "$") return `$${formatCompact(v)}`;
  if (unit === "%") return `${v.toFixed(0)}%`;
  return formatCompact(v);
}

function formatValue(v: number, unit: AskRankingBlock["unit"], hideValues: boolean): string {
  if (hideValues) return "redacted";
  if (unit === "$") return `$${Math.round(v).toLocaleString()}`;
  if (unit === "%") return `${v.toFixed(1)}%`;
  if (unit === "FTE") return `${Math.round(v).toLocaleString()} FTE`;
  if (unit === "rows") return `${Math.round(v).toLocaleString()} rows`;
  return Math.round(v).toLocaleString();
}

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}
