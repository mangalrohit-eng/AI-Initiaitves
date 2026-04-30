"use client";

import type { BuildScaleResult } from "@/lib/initiatives/buildScaleModel";
import { HORIZON_MONTHS } from "@/lib/initiatives/buildScaleModel";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Deterministic chip strip surfacing the key Build & Scale facts above the
 * Gantt. Every value comes from `computeBuildScale` — single source of truth
 * shared with the Gantt, the run-rate chart, and the KPI strip M24 tile.
 */
export function BuildScaleSummary({ buildScale }: { buildScale: BuildScaleResult }) {
  const redact = useRedactDollars();
  const rows = buildScale.rows;
  const tail = buildScale.tail;

  const inBuildAtM6 = rows.filter(
    (r) => r.phaseStartMonth <= 6 && r.endBuildMonth >= 6,
  ).length;
  const rampingAtM12 = rows.filter(
    (r) => r.rampStartMonth <= 12 && r.fullScaleMonth >= 12,
  ).length;
  const atScaleByM24 = rows.filter((r) => r.fullScaleMonth <= HORIZON_MONTHS).length;

  const m12 = buildScale.monthly.find((p) => p.month === 12)?.runRateAiUsd ?? 0;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <Chip
        label="Initiatives in plan"
        value={String(rows.length)}
        sub={`${rows.filter((r) => r.phase === "P1").length} P1 · ${rows.filter((r) => r.phase === "P2").length} P2 · ${rows.filter((r) => r.phase === "P3").length} P3`}
      />
      <Chip
        label="In build at M6"
        value={String(inBuildAtM6)}
        sub="P1 cohort still constructing"
      />
      <Chip
        label="Ramping at M12"
        value={String(rampingAtM12)}
        sub="Adoption window active"
      />
      <Chip
        label="At full scale by M24"
        value={String(atScaleByM24)}
        sub={
          tail.initiativesRampingPastM24 > 0
            ? `${tail.initiativesRampingPastM24} still ramping past M24`
            : "Every initiative at scale by M24"
        }
      />
      <Chip
        label="Run-rate · M12 / M24"
        value={
          redact
            ? "—"
            : `${formatUsdCompact(m12)} / ${formatUsdCompact(tail.runRateAtM24)}`
        }
        sub={
          tail.gapAtM24 > 0
            ? `Full scale: ${redact ? "—" : formatUsdCompact(tail.runRateAtFullScale)}`
            : "Reconciles to program full-scale total"
        }
      />
    </div>
  );
}

function Chip({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
        {label}
      </div>
      <div className="mt-1 font-mono text-base font-semibold text-forge-ink">
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[10px] text-forge-subtle">{sub}</div> : null}
    </div>
  );
}
