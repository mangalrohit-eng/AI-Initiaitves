"use client";

import { CalendarClock, Flag, ShieldAlert } from "lucide-react";
import type {
  OffshorePlanResult,
  OffshoreWaveBucket,
  TsaTag,
  WaveNumber,
} from "@/lib/offshore/selectOffshorePlan";
import { fmtInt, tierAccent } from "./offshoreLabels";

const TOTAL_MONTHS = 24;
const MONTH_GUARDRAILS: { month: number; tag: TsaTag; label: string }[] = [
  { month: 9, tag: "Hr-Payroll", label: "HR-Payroll TSA expires" },
  { month: 18, tag: "Tech-Infra", label: "Tech-infra TSA expires" },
  { month: 24, tag: "Finance", label: "Finance TSA expires" },
];

/**
 * Wave roadmap — three stacked horizontal bands across M0-M24, with TSA
 * expirations as vertical guardrail lines spanning all three bands. Per-wave
 * card summarizes scope, headcount, gate criteria, and named gatekeeper.
 *
 * Wave headcount sums reconcile to the "Migrating to GCC India" KPI tile —
 * deterministic from per-L3 wave assignment in `selectOffshorePlan`.
 */
export function WaveRoadmapTab({ plan }: { plan: OffshorePlanResult }) {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          24-month wave timeline · TSA-paced
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-forge-subtle">
          Three waves, sequenced against NBCU TSA expirations and the BB-
          credit covenant. Wave 1 front-loads the savings the rating story
          needs; Wave 2 is gated on Wave-1 SLAs + savings floor; Wave 3 is
          gated on the first SOX clean opinion.
        </p>
      </header>

      <Timeline waves={plan.waves} />

      <div className="grid gap-4 lg:grid-cols-3">
        {plan.waves.map((w) => (
          <WaveCard key={w.wave} wave={w} />
        ))}
      </div>

      <ReconcileFooter plan={plan} />
    </div>
  );
}

// ===========================================================================
//   Visual timeline
// ===========================================================================

function Timeline({ waves }: { waves: OffshoreWaveBucket[] }) {
  const waveColors: Record<WaveNumber, string> = {
    1: "bg-accent-purple/85",
    2: "bg-accent-teal/85",
    3: "bg-accent-amber/85",
  };
  const waveBorder: Record<WaveNumber, string> = {
    1: "border-accent-purple",
    2: "border-accent-teal",
    3: "border-accent-amber",
  };
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      {/* Month axis */}
      <div className="relative h-6">
        <div className="absolute inset-0 flex items-end justify-between px-1 font-mono text-[10px] text-forge-hint">
          {Array.from({ length: 9 }, (_, i) => i * 3).map((m) => (
            <span key={m}>M{m}</span>
          ))}
        </div>
      </div>

      <div className="relative mt-2 space-y-2">
        {/* Vertical TSA guardrails — span all three wave rows */}
        {MONTH_GUARDRAILS.map((g) => (
          <div
            key={g.month}
            className="pointer-events-none absolute top-0 bottom-0 z-0 flex flex-col items-center"
            style={{ left: `${(g.month / TOTAL_MONTHS) * 100}%` }}
          >
            <div className="h-full w-px border-l border-dashed border-accent-red/40" />
          </div>
        ))}

        {([1, 2, 3] as WaveNumber[]).map((waveN) => {
          const w = waves.find((x) => x.wave === waveN);
          if (!w) return null;
          const leftPct = (w.windowStart / TOTAL_MONTHS) * 100;
          const widthPct = ((w.windowEnd - w.windowStart) / TOTAL_MONTHS) * 100;
          return (
            <div
              key={waveN}
              className="relative h-9"
              aria-label={`Wave ${waveN} runs ${w.windowMonths}`}
            >
              <div className="absolute inset-y-0 left-0 right-0 rounded-md bg-forge-well/60" />
              <div
                className={`absolute inset-y-0 z-10 flex items-center justify-between rounded-md border-2 ${waveBorder[waveN]} ${waveColors[waveN]} px-3 text-white shadow-sm`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <span className="font-display text-xs font-semibold">
                  Wave {waveN} · {w.title}
                </span>
                <span className="font-mono text-xs">
                  {w.windowMonths} · {fmtInt(w.rolesEnteringGcc)} HC
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* TSA legend chips */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {MONTH_GUARDRAILS.map((g) => (
          <span
            key={g.month}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent-red/30 bg-accent-red/5 px-2.5 py-1 text-[10px] font-medium text-accent-red"
          >
            <span className="font-mono">M{g.month}</span>
            {g.label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ===========================================================================
//   Wave cards
// ===========================================================================

function WaveCard({ wave }: { wave: OffshoreWaveBucket }) {
  const tierBadge: Record<typeof wave.transitionCostTier, string> = {
    HIGH: "border-accent-red/40 bg-accent-red/5 text-accent-red",
    MEDIUM: "border-accent-amber/40 bg-accent-amber/5 text-accent-amber",
    LOW: "border-accent-teal/40 bg-accent-teal/5 text-accent-teal",
  };
  return (
    <article className="flex h-full flex-col rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            Wave {wave.wave} · {wave.windowMonths}
          </div>
          <h3 className="mt-1 font-display text-base font-semibold text-forge-ink">
            {wave.title}
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tierBadge[wave.transitionCostTier]}`}
        >
          ● {wave.transitionCostTier}
        </span>
      </header>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold text-accent-purple-dark">
          {fmtInt(wave.rolesEnteringGcc)}
        </span>
        <span className="text-[11px] text-forge-subtle">
          roles entering GCC India this wave
        </span>
      </div>

      {wave.scopeTowers.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            Scope · top towers
          </div>
          <ul className="mt-1 space-y-0.5 text-[11px] text-forge-body">
            {wave.scopeTowers.slice(0, 5).map((s) => (
              <li
                key={s.towerId}
                className="flex items-center justify-between gap-2"
              >
                <span>{s.towerName}</span>
                <span className="font-mono text-forge-subtle">
                  {fmtInt(s.movable)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {wave.tsaDependenciesCleared.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            TSA dependencies cleared
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {wave.tsaDependenciesCleared.map((tsa) => (
              <span
                key={tsa}
                className="inline-flex items-center gap-1 rounded-full border border-accent-red/30 bg-accent-red/5 px-2 py-0.5 text-[10px] font-medium text-accent-red"
              >
                {tsa}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-auto pt-3">
        <div className="rounded-xl border border-forge-border bg-forge-well/40 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            <Flag className="h-3 w-3" aria-hidden />
            Gate criteria
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-forge-body">
            {wave.gateCriteria}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            <ShieldAlert className="h-3 w-3" aria-hidden />
            Gatekeeper
          </div>
          <p className="mt-1 text-[11px] font-medium text-forge-ink">
            {wave.versantGatekeeper}
          </p>
        </div>
      </div>
    </article>
  );
}

// ===========================================================================
//   Reconciliation footer
// ===========================================================================

function ReconcileFooter({ plan }: { plan: OffshorePlanResult }) {
  const sumWaves = plan.waves.reduce((s, w) => s + w.rolesEnteringGcc, 0);
  return (
    <section className="rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-forge-body">
        <span className="font-display font-semibold uppercase tracking-wider text-accent-purple-dark">
          Reconciliation
        </span>
        <span>
          Total to GCC India by M24:{" "}
          <span className="font-mono font-semibold text-accent-purple-dark">
            {fmtInt(sumWaves)}
          </span>{" "}
          (sum of waves) ={" "}
          <span className="font-mono font-semibold text-accent-purple-dark">
            {fmtInt(
              plan.programMigratingToGcc + plan.programMigratingToManila,
            )}
          </span>{" "}
          (KPI tile &quot;Migrating to GCC India&quot;)
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-forge-subtle">
        All three waves carry the Brian Carovillano editorial veto on any
        newsroom-adjacent scope expansion — not just Wave 3. The{" "}
        <span className={tierAccent("HIGH")}>HIGH</span> stand-up cost tier on
        Wave 1 reflects multi-tower, multi-TSA, BB- newly-public exposure;
        Wave 2 / Wave 3 step down to{" "}
        <span className={tierAccent("MEDIUM")}>MEDIUM</span> as Wave-1
        infrastructure carries.
      </p>
    </section>
  );
}
