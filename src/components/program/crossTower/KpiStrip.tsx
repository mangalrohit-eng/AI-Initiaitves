"use client";

import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Six-tile executive KPI strip — fully deterministic.
 *
 * Two $ tiles surface the timing reality of the new build/ramp/at-scale
 * model:
 *
 *   - Tile 1 — *Program AI run-rate · at full scale* (`programImpact.ai`)
 *   - Tile 2 — *Modeled · M24 run-rate* (`buildScale.tail.runRateAtM24`)
 *
 * When some P3 initiatives ramp past M24, the gap caption underneath the two
 * tiles surfaces the difference. Every value flows through the same
 * `computeBuildScale` output that drives the Gantt and the run-rate chart, so
 * the page reconciles end-to-end.
 *
 * The LLM is not allowed to author this strip.
 */
export function KpiStrip({ program }: { program: SelectProgramResult }) {
  const redact = useRedactDollars();
  const totalInitiatives = program.initiatives.length;
  const phases = program.phases;
  const tail = program.buildScale.tail;
  const t = program.threshold;
  const thresholdActive = t.aiUsdThreshold > 0;
  const showGap = tail.gapAtM24 > 0 && tail.runRateAtFullScale > 0;
  const showOpportunisticCaption =
    thresholdActive && t.excludedCount > 0 && !redact;

  const diag = program.programTierDiagnostics;
  const showDeprioritizedCaption =
    diag.deprioritizedCount > 0 && !redact;

  const initiativesSubtitle =
    totalInitiatives === 0
      ? "2x2 + L4 Activity Group prize threshold filter out every initiative"
      : `${phases.p1.initiatives.length} Quick Wins · ${phases.p2.initiatives.length} Fill-ins · ${phases.p3.initiatives.length} Strategic Builds`;

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Tile
          label={thresholdActive ? "In-plan AI run-rate" : "Program AI run-rate"}
          value={
            redact ? "—" : formatUsdCompact(tail.runRateAtFullScale, { decimals: 2 })
          }
          subtitle={
            thresholdActive
              ? `At full scale · L4 Activity Group prize ≥ ${formatUsdCompact(t.aiUsdThreshold)}`
              : "At full scale, all initiatives ramped"
          }
          emphasis
        />
        <Tile
          label="Modeled · M24 run-rate"
          value={redact ? "—" : formatUsdCompact(tail.runRateAtM24, { decimals: 2 })}
          subtitle={
            totalInitiatives === 0
              ? "No initiatives in plan"
              : tail.initiativesRampingPastM24 > 0
                ? `${tail.initiativesRampingPastM24} initiative${tail.initiativesRampingPastM24 === 1 ? "" : "s"} ramp past M24`
                : "Every initiative at full scale by M24"
          }
        />
        <Tile
          label="Towers in plan"
          value={String(program.towersInScope.length)}
          subtitle={
            t.excludedTowerCount > 0
              ? `of 13 Versant towers · ${t.excludedTowerCount} below L4 Activity Group prize threshold`
              : `of ${"13"} Versant towers`
          }
        />
        <Tile
          label="Initiatives in plan"
          value={String(totalInitiatives)}
          subtitle={initiativesSubtitle}
        />
        <Tile
          label="Agents architected"
          value={String(program.architecture.totalAgents)}
          subtitle={
            program.architecture.orchestrationMix.length > 0
              ? `across ${program.architecture.orchestrationMix.length} orchestration patterns`
              : "No agent fleet in plan"
          }
        />
        <Tile
          label="Cost-weighted AI dial"
          value={`${Math.round(program.programImpact.weightedAiPct)}%`}
          subtitle="Across contributing towers"
        />
      </div>

      {showDeprioritizedCaption ? (
        <p className="mt-2 text-[11px] text-forge-subtle">
          <span className="font-mono text-forge-body">
            {diag.deprioritizedCount} initiative{diag.deprioritizedCount === 1 ? "" : "s"}
          </span>{" "}
          ·{" "}
          <span className="font-mono text-forge-body">
            {formatUsdCompact(diag.deprioritizedAiUsd, { decimals: 2 })}
          </span>{" "}
          below the line by 2x2 — low feasibility AND low parent-L4 Activity
          Group business impact (median ≈{" "}
          <span className="font-mono text-forge-body">
            {formatUsdCompact(diag.medianL3Usd)}
          </span>
          , floor{" "}
          <span className="font-mono text-forge-body">
            {formatUsdCompact(diag.floorUsd)}
          </span>
          {diag.medianVolatilityWarning ? "; median volatile at small N" : ""}
          ).
        </p>
      ) : null}

      {showOpportunisticCaption ? (
        <p className="mt-2 text-[11px] text-forge-subtle">
          <span className="font-mono text-forge-body">
            {t.excludedCount} initiative{t.excludedCount === 1 ? "" : "s"}
          </span>{" "}
          ·{" "}
          <span className="font-mono text-forge-body">
            {formatUsdCompact(t.excludedAiUsd, { decimals: 2 })}
          </span>{" "}
          above the 2x2 line but rolling up to an L4 Activity Group prize below the{" "}
          <span className="font-mono text-forge-body">
            {formatUsdCompact(t.aiUsdThreshold)}
          </span>{" "}
          inclusion threshold — opportunistic, addressed inside the tower
          roadmaps. Lower the threshold to bring them into plan.
        </p>
      ) : null}

      {showGap && !redact ? (
        <p className="mt-1 text-[11px] text-forge-subtle">
          <span className="font-mono text-forge-body">
            {formatUsdCompact(tail.gapAtM24, { decimals: 2 })}
          </span>{" "}
          of in-plan total ramps beyond M24 — late-horizon initiatives still in
          adoption when the 24-month plan window closes.
        </p>
      ) : null}
    </section>
  );
}

function Tile({
  label,
  value,
  subtitle,
  emphasis,
}: {
  label: string;
  value: string;
  subtitle?: string;
  emphasis?: boolean;
}) {
  if (emphasis) {
    return (
      <div className="rounded-2xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-forge-surface p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-accent-purple-dark/80">{label}</div>
        <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">{value}</div>
        {subtitle ? <p className="mt-1 text-xs text-forge-subtle">{subtitle}</p> : null}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-forge-hint">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-forge-ink">{value}</div>
      {subtitle ? <p className="mt-1 text-xs text-forge-subtle">{subtitle}</p> : null}
    </div>
  );
}
