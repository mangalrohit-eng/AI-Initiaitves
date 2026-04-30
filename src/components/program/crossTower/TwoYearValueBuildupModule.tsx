"use client";

import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";
import { ValueBuildupChart } from "@/components/charts/ValueBuildupChart";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * 24-month modeled AI run-rate buildup. Fully deterministic — derived from
 * the per-initiative build / 6-month-ramp / at-scale model in
 * `computeBuildScale`. The LLM does not author this surface.
 *
 * The curve is the in-month annualized run-rate, not a cumulative integral.
 * If some P3 initiatives ramp past M24, the run-rate at M24 sits below the
 * full-scale program total — the caption surfaces that gap honestly.
 */
export function TwoYearValueBuildupModule({
  program,
  bare,
}: {
  program: SelectProgramResult;
  /** Drop the outer card frame when rendered inside `<TabGroup>`. */
  bare?: boolean;
}) {
  const redact = useRedactDollars();
  const tail = program.buildScale.tail;
  const showGap = tail.gapAtM24 > 0 && tail.runRateAtFullScale > 0;

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> 24-month modeled AI value buildup
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">
          In-month run-rate — every initiative builds, ramps over 6 months, then runs at full scale. No initiative
          contributes a dollar before its build completes.
        </p>
      </div>
      {!redact ? (
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-xl border border-accent-purple/30 bg-accent-purple/5 px-3 py-2 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark/80">
              Run-rate at month 24
            </div>
            <div className="font-mono text-lg font-semibold text-accent-purple-dark">
              {formatUsdCompact(tail.runRateAtM24, { decimals: 2 })}
            </div>
          </div>
          {showGap ? (
            <div className="text-[10px] text-forge-subtle">
              Full scale:{" "}
              <span className="font-mono text-forge-body">
                {formatUsdCompact(tail.runRateAtFullScale, { decimals: 2 })}
              </span>{" "}
              ·{" "}
              <span className="font-mono text-forge-body">
                {formatUsdCompact(tail.gapAtM24, { decimals: 2 })}
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
      <ValueBuildupChart data={program.valueBuildup} />
    </div>
  );

  const Caption = (
    <p className="mt-3 text-[11px] leading-relaxed text-forge-subtle">
      Build → 6-month adoption ramp → full scale. Build durations come from
      <span className="text-forge-body"> Process.timelineMonths</span> when
      present, otherwise phase-tier defaults. Ramp is a fixed 6 months across
      every initiative — adoption + change-management for Versant&apos;s
      7-entity, multi-brand operating model. Linear ramp is a planning
      convention; downstream effort estimate may refine to S-curve.
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
