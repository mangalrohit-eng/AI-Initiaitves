"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BuildupPoint } from "@/lib/llm/useCrossTowerPlan";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Cross-Tower AI Plan v3 — project-driven 24-month value buildup curve.
 *
 * The curve sums each live AI Project's per-month contribution under the
 * deterministic build/ramp/at-scale model from `composeProjects`. Each
 * cohort's first build month and build duration come from the program-tier
 * rollup of its L5 constituents (P1 / P2 / P3) plus the Assumptions phase
 * grid (`p*PhaseStartMonth`, `p*BuildMonths`); value begins after build, then
 * a shared linear ramp to full run-rate.
 *
 * Stub projects and Deprioritize-quadrant projects do NOT contribute to
 * the curve.
 */
export function ProjectsValueBuildupModule({
  buildup,
  fullScaleRunRateUsd,
  assumptions,
  bare,
}: {
  buildup: BuildupPoint[];
  fullScaleRunRateUsd: number;
  assumptions: CrossTowerAssumptions;
  bare?: boolean;
}) {
  const redact = useRedactDollars();
  const m24 = buildup[buildup.length - 1]?.cumulativeAiUsd ?? 0;
  const gap = Math.max(0, fullScaleRunRateUsd - m24);
  const showGap = gap > 0 && fullScaleRunRateUsd > 0;

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          24-month modeled AI value buildup
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
          Sum of every live AI Project{"'"}s monthly contribution. Start month
          and build length follow the cohort program tier (P1 / P2 / P3) against
          Assumptions (P1 M{assumptions.p1PhaseStartMonth} /{" "}
          {assumptions.p1BuildMonths}mo build, P2 M{assumptions.p2PhaseStartMonth}{" "}
          / {assumptions.p2BuildMonths}mo, P3 M{assumptions.p3PhaseStartMonth} /{" "}
          {assumptions.p3BuildMonths}mo), then a {assumptions.rampMonths}
          -month linear ramp to full attributed run-rate. No dollar accrues
          before that project{"'"}s build completes.
        </p>
      </div>
      {!redact ? (
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-xl border border-accent-purple/30 bg-accent-purple/5 px-3 py-2 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark/80">
              Run-rate at month 24
            </div>
            <div className="font-mono text-lg font-semibold text-accent-purple-dark">
              {formatUsdCompact(m24, { decimals: 2 })}
            </div>
          </div>
          {showGap ? (
            <div className="text-[10px] text-forge-subtle">
              Full scale:{" "}
              <span className="font-mono text-forge-body">
                {formatUsdCompact(fullScaleRunRateUsd, { decimals: 2 })}
              </span>{" "}
              ·{" "}
              <span className="font-mono text-forge-body">
                {formatUsdCompact(gap, { decimals: 2 })}
              </span>{" "}
              ramps past M24
            </div>
          ) : (
            <div className="text-[10px] text-forge-subtle">
              Reconciles to full-scale program total at M24
            </div>
          )}
        </div>
      ) : null}
    </header>
  );

  const ChartBlock = (
    <div className="mt-4 rounded-xl border border-forge-border bg-forge-surface p-2">
      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={buildup}
            margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
          >
            <defs>
              <linearGradient id="projects-buildup-fill" x1="0" y1="0" x2="0" y2="1">
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
                redact
                  ? ""
                  : formatUsdCompact(v, {
                      decimals: v >= 1_000_000_000 ? 1 : 0,
                    })
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
            <Area
              type="monotone"
              dataKey="cumulativeAiUsd"
              stroke="#A100FF"
              strokeWidth={2}
              fill="url(#projects-buildup-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const Caption = (
    <p className="mt-3 text-[11px] leading-relaxed text-forge-subtle">
      Build → {assumptions.rampMonths}-month adoption ramp → full scale. Phase
      starts and per-tier build windows are editable on the Assumptions tab;
      each L4 cohort picks up P1, P2, or P3 timing from its constituent L5
      program tiers (conservative tie-break: latest phase wins when mixed).
      Adoption is a fixed {assumptions.rampMonths}-month linear ramp per
      project. Stub projects and Deprioritize-quadrant projects are excluded
      from the curve.
    </p>
  );

  if (bare) {
    return (
      <div>
        {Header}
        {ChartBlock}
        {Caption}
      </div>
    );
  }
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card">
      {Header}
      {ChartBlock}
      {Caption}
    </section>
  );
}
