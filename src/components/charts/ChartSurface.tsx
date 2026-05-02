"use client";

import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Shared wrapper for every recharts chart in the app: fixed-height container,
 * `min-w-0` so it co-exists with grid columns, and a `ResponsiveContainer`
 * around the actual chart. Extracted from the original copy-paste pattern in
 * `HoursSavedBar.tsx` / `ValueBuildupChart.tsx` etc. when Ask Forge needed a
 * consistent surface for `RankingBlock` / `BreakdownBlock`.
 *
 * Usage:
 *   <ChartSurface height={320}>
 *     <BarChart data={...}>...</BarChart>
 *   </ChartSurface>
 */
export function ChartSurface({
  height = 320,
  className,
  children,
}: {
  height?: number;
  className?: string;
  /** Single recharts root element (BarChart, LineChart, PieChart, etc.). */
  children: ReactElement;
}) {
  return (
    <div className={`w-full min-w-0 ${className ?? ""}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Shared tooltip styling used across every Forge chart. Apply via:
 *   <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_TOOLTIP_CURSOR} />
 */
export const CHART_TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #d5c8e2",
  borderRadius: 12,
  color: "#1a1a2e",
  boxShadow: "0 8px 24px rgba(26,26,46,0.08)",
} as const;

export const CHART_TOOLTIP_CURSOR = { fill: "rgba(161,0,255,0.08)" } as const;

export const CHART_GRID_COLOR = "rgba(26, 26, 46, 0.08)";
export const CHART_AXIS_COLOR = "rgba(26, 26, 46, 0.35)";
export const CHART_TICK_COLOR = "#45405C";
