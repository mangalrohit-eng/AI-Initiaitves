"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ValueBuildupPoint } from "@/lib/initiatives/selectProgram";
import { PHASE_START_MONTHS } from "@/lib/initiatives/buildScaleModel";
import { TIER_HEX } from "@/lib/priority";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * 24-month modeled AI run-rate chart for the Cross-Tower AI Plan.
 *
 * Fully deterministic — driven by `computeBuildScale(...).monthly` which sums
 * each initiative's per-month contribution under the build / 6-month-ramp /
 * at-scale model. The LLM has no influence on this surface.
 *
 * Reference lines mark P2 / P3 phase build-start months from
 * `PHASE_START_MONTHS` (defaults M6 / M12) so the executive read aligns to the
 * three-horizon narrative. The curve does not change shape strictly at those
 * boundaries — initiatives ramp asynchronously based on each row's build
 * duration, so the inflection markers are guidance, not hard transitions.
 */
export function ValueBuildupChart({ data }: { data: ValueBuildupPoint[] }) {
  const redact = useRedactDollars();
  const p2Start = PHASE_START_MONTHS.P2;
  const p3Start = PHASE_START_MONTHS.P3;
  return (
    <div className="h-[320px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
        >
          <defs>
            <linearGradient id="value-buildup-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A100FF" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#A100FF" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(26,26,46,0.06)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            type="number"
            domain={[1, 24]}
            ticks={[1, 6, 12, 18, 24]}
            tickLine={false}
            axisLine={{ stroke: "rgba(26,26,46,0.12)" }}
            stroke="rgba(26,26,46,0.55)"
            tickFormatter={(m) => `m${m}`}
            label={{
              value: "Months from program kickoff",
              position: "insideBottom",
              offset: -2,
              fill: "rgba(26,26,46,0.55)",
              fontSize: 11,
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={{ stroke: "rgba(26,26,46,0.12)" }}
            stroke="rgba(26,26,46,0.55)"
            tickFormatter={(v: number) =>
              redact ? "" : formatUsdCompact(v, { decimals: v >= 1_000_000_000 ? 1 : 0 })
            }
            width={redact ? 0 : 64}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d5c8e2",
              borderRadius: 12,
              color: "#1a1a2e",
              boxShadow: "0 8px 24px rgba(26,26,46,0.08)",
            }}
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value ?? 0);
              return redact
                ? ["—", "Modeled AI run-rate"]
                : [formatUsdCompact(n), "Modeled AI run-rate"];
            }}
            labelFormatter={(label) => `Month ${label}`}
          />
          <ReferenceLine
            x={p2Start}
            stroke={TIER_HEX.P2.solid}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: "P2 build start",
              position: "top",
              fill: TIER_HEX.P2.deep,
              fontSize: 10,
            }}
          />
          <ReferenceLine
            x={p3Start}
            stroke={TIER_HEX.P3.solid}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: "P3 build start",
              position: "top",
              fill: TIER_HEX.P3.deep,
              fontSize: 10,
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeAiUsd"
            stroke="#A100FF"
            strokeWidth={2}
            fill="url(#value-buildup-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
