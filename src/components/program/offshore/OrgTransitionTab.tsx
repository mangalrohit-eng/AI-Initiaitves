"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Globe2,
  Home,
  Plane,
  Building2,
} from "lucide-react";
import type { AssessProgramV2 } from "@/data/assess/types";
import type {
  OffshoreL3Row,
  OffshorePlanResult,
  OffshoreTowerSummary,
} from "@/lib/offshore/selectOffshorePlan";
import {
  offshoreLocationLabels,
  type OffshoreLocationLabels,
} from "@/lib/offshore/offshoreLocationLabels";
import {
  Chip,
  carveOutClassAccent,
  carveOutClassLabel,
  carveOutFlagAccent,
  fmtInt,
  usLocationLabel,
} from "./offshoreLabels";

type PlanWithProgram = OffshorePlanResult & { program: AssessProgramV2 };

/**
 * Org transition — the leadership-facing answer to "how many people move,
 * from where, and what stays?"
 *
 * Three nested views, top to bottom:
 *   1. Program-wide flow band (today onshore + today offshore →
 *      retained onshore + GCC India + Manila), all counts deterministic.
 *   2. Per-tower org-transition table, expandable to L3 detail.
 *   3. Stacked-bar visualization for all 13 towers — "who moves, who stays".
 */
export function OrgTransitionTab({ plan }: { plan: PlanWithProgram }) {
  const labels = offshoreLocationLabels(plan.program);
  return (
    <div className="space-y-8">
      <FlowBand plan={plan} labels={labels} />
      <PerTowerTable plan={plan} labels={labels} />
      <StackedBarViz plan={plan} labels={labels} />
    </div>
  );
}

// ===========================================================================
//   1. Program-wide flow band
// ===========================================================================

function FlowBand({
  plan,
  labels,
}: {
  plan: PlanWithProgram;
  labels: OffshoreLocationLabels;
}) {
  return (
    <section>
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Today → Steady state (M24)
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">
          Program-wide. Every count is deterministic — sum of per-L3 movable
          headcount math from Step 2 dials.
          {plan.programEditorialCarveOutCount > 0 ? (
            <>
              {" "}Editorial carve-out is{" "}
              <em className="not-italic">a subset of</em> retained onshore, not
              a separate destination.
            </>
          ) : null}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start">
        {/* LEFT — Today */}
        <div className="space-y-3">
          <FlowCard
            tone="neutral"
            icon={<Building2 className="h-4 w-4" aria-hidden />}
            label="Today · US onshore"
            count={plan.programTodayOnshoreCount}
            sub="FTE + contractors"
          />
          <FlowCard
            tone="neutral"
            icon={<Globe2 className="h-4 w-4" aria-hidden />}
            label="Today · existing offshore"
            count={plan.programTodayOffshoreCount}
            sub="Folds into GCC India under managed-service consolidation"
          />
        </div>

        {/* MIDDLE — Arrows */}
        <div
          aria-hidden
          className="hidden flex-col items-center justify-center gap-3 px-2 lg:flex"
        >
          <div className="flex h-1 w-16 items-center">
            <div className="h-px w-full border-t border-dashed border-forge-border-strong" />
            <ChevronRight className="h-4 w-4 text-forge-hint" />
          </div>
          <div className="flex h-1 w-16 items-center">
            <div className="h-px w-full border-t border-dashed border-forge-border-strong" />
            <ChevronRight className="h-4 w-4 text-forge-hint" />
          </div>
          <div className="flex h-1 w-16 items-center">
            <div className="h-px w-full border-t border-dashed border-forge-border-strong" />
            <ChevronRight className="h-4 w-4 text-forge-hint" />
          </div>
        </div>

        {/* RIGHT — Steady state */}
        <div className="space-y-3">
          <FlowCard
            tone="retained"
            icon={<Home className="h-4 w-4" aria-hidden />}
            label="Retained onshore"
            count={plan.programRetainedOnshore}
            sub={
              plan.programEditorialCarveOutCount > 0
                ? `incl. editorial carve-out: ${fmtInt(plan.programEditorialCarveOutCount)} (Brian Carovillano veto)`
                : "Strategic, judgment, executive layer"
            }
          />
          <FlowCard
            tone="gcc"
            icon={<Plane className="h-4 w-4" aria-hidden />}
            label={`GCC India · ${labels.primaryAndSecondary}`}
            count={plan.programGccIndiaSteadyState}
            sub={`Migrating ${fmtInt(plan.programMigratingToGcc)} + existing offshore ${fmtInt(plan.programTodayOffshoreCount)} — managed service`}
          />
          {plan.programMigratingToManila > 0 && labels.hasHub ? (
            <FlowCard
              tone="manila"
              icon={<Plane className="h-4 w-4" aria-hidden />}
              label={`${labels.hub} · contact-center carve-out`}
              count={plan.programMigratingToManila}
              sub="Multi-brand: CNBC Pro · GolfNow / GolfPass · Fandango · SportsEngine"
            />
          ) : null}
        </div>
      </div>

      <ReconcileFootnote plan={plan} />
    </section>
  );
}

function FlowCard({
  tone,
  icon,
  label,
  count,
  sub,
}: {
  tone: "neutral" | "retained" | "gcc" | "manila";
  icon: React.ReactNode;
  label: string;
  count: number;
  sub: string;
}) {
  const styleByTone: Record<typeof tone, string> = {
    neutral: "border-forge-border bg-forge-surface",
    retained: "border-accent-amber/30 bg-accent-amber/5",
    gcc: "border-accent-purple/30 bg-accent-purple/5",
    manila: "border-accent-teal/30 bg-accent-teal/5",
  };
  const labelByTone: Record<typeof tone, string> = {
    neutral: "text-forge-hint",
    retained: "text-accent-amber",
    gcc: "text-accent-purple-dark",
    manila: "text-accent-teal",
  };
  const valueByTone: Record<typeof tone, string> = {
    neutral: "text-forge-ink",
    retained: "text-accent-amber",
    gcc: "text-accent-purple-dark",
    manila: "text-accent-teal",
  };
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${styleByTone[tone]}`}
    >
      <div
        className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${labelByTone[tone]}`}
      >
        {icon}
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-2xl font-semibold ${valueByTone[tone]}`}
      >
        {fmtInt(count)}
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-forge-subtle">
        {sub}
      </p>
    </div>
  );
}

function ReconcileFootnote({ plan }: { plan: OffshorePlanResult }) {
  return (
    <p className="mt-4 text-[11px] leading-relaxed text-forge-subtle">
      <span className="font-mono text-forge-body">RECONCILES:</span>{" "}
      Today onshore <span className="font-mono">{fmtInt(plan.programTodayOnshoreCount)}</span> ={" "}
      Migrating <span className="font-mono">{fmtInt(plan.programMigratingToGcc + plan.programMigratingToManila)}</span> +{" "}
      Retained <span className="font-mono">{fmtInt(plan.programRetainedOnshore)}</span>.
      GCC India steady state <span className="font-mono">{fmtInt(plan.programGccIndiaSteadyState)}</span> ={" "}
      Migrating <span className="font-mono">{fmtInt(plan.programMigratingToGcc)}</span> +{" "}
      Existing offshore <span className="font-mono">{fmtInt(plan.programTodayOffshoreCount)}</span>.
    </p>
  );
}

// ===========================================================================
//   2. Per-tower table with expandable L3 detail
// ===========================================================================

function PerTowerTable({
  plan,
  labels,
}: {
  plan: PlanWithProgram;
  labels: OffshoreLocationLabels;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const showHubColumn = labels.hasHub && plan.programMigratingToManila > 0;
  const showEditorialColumn = plan.programEditorialCarveOutCount > 0;
  const detailColSpan = 4 + (showHubColumn ? 1 : 0) + (showEditorialColumn ? 1 : 0);

  return (
    <section>
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Per-tower org transition
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">
          Click a tower to drill into its L3 rows — the lane assignment,
          provenance, and the LLM justification when the offshore plan has
          been generated.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-forge-border bg-forge-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-forge-well/60 text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
            <tr>
              <th className="px-3 py-2.5 text-left">Tower · From</th>
              <th className="px-3 py-2.5 text-right">Today (US / Off)</th>
              <th className="px-3 py-2.5 text-right">→ GCC</th>
              {showHubColumn && (
                <th className="px-3 py-2.5 text-right">→ {labels.hub}</th>
              )}
              <th className="px-3 py-2.5 text-right">⌂ Retained</th>
              {showEditorialColumn && (
                <th className="px-3 py-2.5 text-right">Editorial subset</th>
              )}
            </tr>
          </thead>
          <tbody>
            {plan.towerSummaries.map((t) => {
              const isOpen = expanded === t.towerId;
              return (
                <React.Fragment key={t.towerId}>
                  <tr
                    className="cursor-pointer border-t border-forge-border align-top hover:bg-forge-well/30"
                    onClick={() => setExpanded(isOpen ? null : t.towerId)}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-forge-hint">
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-display font-semibold text-forge-ink">
                            {t.towerName}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {t.primaryUsLocations.map((loc) => (
                              <Chip
                                key={loc}
                                border="border-forge-border-strong"
                                bg="bg-forge-well"
                                text="text-forge-body"
                              >
                                {usLocationLabel(loc)}
                              </Chip>
                            ))}
                            {t.carveOutFlags.map((flag) => {
                              const a = carveOutFlagAccent(flag);
                              return (
                                <Chip
                                  key={flag}
                                  border={a.border}
                                  bg={a.bg}
                                  text={a.text}
                                >
                                  ● {flag}
                                </Chip>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-forge-ink">
                      {fmtInt(t.todayOnshoreCount)}
                      <span className="ml-1 text-[11px] text-forge-hint">/{" "}{fmtInt(t.todayOffshoreCount)}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      <span
                        className={
                          t.migratingToGcc > 0
                            ? "font-semibold text-accent-purple-dark"
                            : "text-forge-hint"
                        }
                      >
                        {fmtInt(t.migratingToGcc)}
                      </span>
                    </td>
                    {showHubColumn && (
                      <td className="px-3 py-3 text-right font-mono">
                        <span
                          className={
                            t.migratingToManila > 0
                              ? "font-semibold text-accent-teal"
                              : "text-forge-hint"
                          }
                        >
                          {fmtInt(t.migratingToManila)}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3 text-right font-mono text-forge-ink">
                      {fmtInt(t.retainedOnshore)}
                    </td>
                    {showEditorialColumn && (
                      <td className="px-3 py-3 text-right font-mono">
                        <span
                          className={
                            t.editorialCarveOutCount > 0
                              ? "font-semibold text-accent-red"
                              : "text-forge-hint"
                          }
                        >
                          {fmtInt(t.editorialCarveOutCount)}
                        </span>
                      </td>
                    )}
                  </tr>

                  {isOpen ? (
                    <tr className="border-t border-forge-border bg-forge-well/20">
                      <td colSpan={detailColSpan} className="px-3 py-3">
                        <ExpandedTowerDetail tower={t} />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExpandedTowerDetail({ tower }: { tower: OffshoreTowerSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-forge-border bg-forge-surface p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            GCC scope
          </div>
          <div className="mt-1 text-sm text-forge-body">
            {tower.recommendedScope}
          </div>
        </div>
        <div className="rounded-xl border border-forge-border bg-forge-surface p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            Onshore retained spine
          </div>
          <div className="mt-1 text-sm text-forge-body">
            {tower.retainedSpineSummary}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-forge-border bg-forge-surface">
        <table className="min-w-full text-xs">
          <thead className="bg-forge-well/60 text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
            <tr>
              <th className="px-3 py-2 text-left">L2 · L3</th>
              <th className="px-3 py-2 text-left">Lane</th>
              <th className="px-3 py-2 text-right">Movable HC</th>
              <th className="px-3 py-2 text-right">Retained HC</th>
              <th className="px-3 py-2 text-left">Rationale · provenance</th>
            </tr>
          </thead>
          <tbody>
            {tower.rows.map((r) => (
              <L3Row key={r.rowId} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function L3Row({ row }: { row: OffshoreL3Row }) {
  const a = carveOutClassAccent(row.carveOut);
  const movable = row.movableFte + row.movableContractor;
  const retained = row.retainedFte + row.retainedContractor;
  const provenance = renderProvenance(row);
  return (
    <tr className="border-t border-forge-border align-top">
      <td className="px-3 py-2">
        <div className="font-medium text-forge-ink">{row.l3}</div>
        <div className="mt-0.5 text-[10px] text-forge-subtle">{row.l2}</div>
      </td>
      <td className="px-3 py-2">
        <div className="space-y-1">
          <Chip border={a.border} bg={a.bg} text={a.text}>
            <span className={`mr-1 inline-block h-1 w-1 rounded-full ${a.dot}`} aria-hidden />
            {carveOutClassLabel(row.carveOut)}
          </Chip>
          {row.carveOutReason && (
            <div className="text-[10px] uppercase tracking-wider text-forge-subtle">
              reason: {row.carveOutReason}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono">
        <span className={movable > 0 ? "text-accent-purple-dark" : "text-forge-hint"}>
          {fmtInt(movable)}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-forge-body">
        {fmtInt(retained)}
      </td>
      <td className="px-3 py-2 text-[11px]">
        <p className="leading-relaxed text-forge-body">
          {row.justification ?? row.offshoreRationale ?? "—"}
        </p>
        <div className="mt-1">{provenance}</div>
      </td>
    </tr>
  );
}

function renderProvenance(row: OffshoreL3Row): React.ReactNode {
  const tone = (() => {
    switch (row.classificationSource) {
      case "user-carve-out":
        return {
          border: "border-accent-purple/30",
          bg: "bg-accent-purple/5",
          text: "text-accent-purple-dark",
          label: "User carve-out",
        };
      case "seeded-carve-out":
        return {
          border: "border-forge-border",
          bg: "bg-forge-well/60",
          text: "text-forge-subtle",
          label: "Pre-seeded carve-out",
        };
      case "llm":
        return {
          border: "border-accent-teal/30",
          bg: "bg-accent-teal/5",
          text: "text-accent-teal",
          label: "LLM",
        };
      case "heuristic":
        return {
          border: "border-forge-border",
          bg: "bg-forge-well/60",
          text: "text-forge-subtle",
          label: "Heuristic",
        };
    }
  })();
  return (
    <Chip border={tone.border} bg={tone.bg} text={tone.text}>
      {tone.label}
    </Chip>
  );
}

// ===========================================================================
//   3. Stacked-bar visualization
// ===========================================================================

function StackedBarViz({
  plan,
  labels,
}: {
  plan: PlanWithProgram;
  labels: OffshoreLocationLabels;
}) {
  const programTotal =
    plan.programTodayOnshoreCount + plan.programTodayOffshoreCount;
  if (programTotal <= 0) return null;

  const hasEditorialCarveOut = plan.programEditorialCarveOutCount > 0;

  return (
    <section>
      <header className="mb-3">
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Who moves, who stays
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">
          One horizontal bar per tower. The thicker top bar is the program
          total.{" "}
          {hasEditorialCarveOut
            ? "Editorial carve-out is rendered as a darker overlay on top of retained — it’s a subset, not a parallel band."
            : "No editorial carve-outs are configured, so retained onshore renders as a single band."}
        </p>
      </header>

      <Legend labels={labels} hasEditorialCarveOut={hasEditorialCarveOut} />

      <div className="mt-3 space-y-2">
        <BarRow
          name="Program total"
          retained={plan.programRetainedOnshore}
          editorial={plan.programEditorialCarveOutCount}
          gcc={plan.programMigratingToGcc}
          manila={plan.programMigratingToManila}
          existing={plan.programTodayOffshoreCount}
          total={programTotal}
          emphasis
        />
        <div className="my-2 h-px bg-forge-border" aria-hidden />
        {plan.towerSummaries.map((t) => {
          const total = t.todayOnshoreCount + t.todayOffshoreCount;
          if (total <= 0) return null;
          return (
            <BarRow
              key={t.towerId}
              name={t.towerName}
              retained={t.retainedOnshore}
              editorial={t.editorialCarveOutCount}
              gcc={t.migratingToGcc}
              manila={t.migratingToManila}
              existing={t.todayOffshoreCount}
              total={total}
            />
          );
        })}
      </div>
    </section>
  );
}

function Legend({
  labels,
  hasEditorialCarveOut,
}: {
  labels: OffshoreLocationLabels;
  hasEditorialCarveOut: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-forge-subtle">
      <Swatch className="bg-accent-amber/40" /> Retained onshore
      {hasEditorialCarveOut && (
        <>
          <Swatch className="bg-accent-red/60" /> Editorial carve-out (subset)
        </>
      )}
      <Swatch className="bg-accent-purple" /> Migrating to GCC India
      {labels.hasHub && (
        <>
          <Swatch className="bg-accent-teal" /> Migrating to {labels.hub}
        </>
      )}
      <Swatch className="bg-forge-border-strong" /> Existing offshore
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`mr-1 inline-block h-2 w-3 rounded-sm ${className}`}
    />
  );
}

function BarRow({
  name,
  retained,
  editorial,
  gcc,
  manila,
  existing,
  total,
  emphasis,
}: {
  name: string;
  retained: number;
  editorial: number;
  gcc: number;
  manila: number;
  existing: number;
  total: number;
  emphasis?: boolean;
}) {
  if (total <= 0) return null;
  const pct = (n: number) => (n / total) * 100;
  // Editorial is a subset of retained — render as a darker layer on top.
  const retainedPct = pct(retained);
  const editorialPct = pct(editorial);
  const gccPct = pct(gcc);
  const manilaPct = pct(manila);
  const existingPct = pct(existing);
  return (
    <div className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)_minmax(0,80px)] items-center gap-3">
      <div
        className={`text-[12px] ${emphasis ? "font-display font-semibold text-forge-ink" : "text-forge-body"}`}
      >
        {name}
      </div>
      <div
        className={`relative ${emphasis ? "h-5" : "h-3.5"} overflow-hidden rounded-full bg-forge-well`}
        aria-label={`${name}: retained ${retained}, migrating ${gcc + manila}, existing offshore ${existing}`}
      >
        {/* Layer 1 — Retained (amber) */}
        <div
          className="absolute inset-y-0 left-0 bg-accent-amber/40"
          style={{ width: `${retainedPct}%` }}
        />
        {/* Layer 2 — Editorial subset overlay (darker red, anchored at left of retained) */}
        {editorialPct > 0 ? (
          <div
            className="absolute inset-y-0 left-0 bg-accent-red/60"
            style={{ width: `${editorialPct}%` }}
            title="Editorial carve-out (subset of retained)"
          />
        ) : null}
        {/* Layer 3 — Migrating to GCC India (purple), starts after retained */}
        <div
          className="absolute inset-y-0 bg-accent-purple"
          style={{
            left: `${retainedPct}%`,
            width: `${gccPct}%`,
          }}
        />
        {/* Layer 4 — Manila (teal), after GCC */}
        <div
          className="absolute inset-y-0 bg-accent-teal"
          style={{
            left: `${retainedPct + gccPct}%`,
            width: `${manilaPct}%`,
          }}
        />
        {/* Layer 5 — Existing offshore (mid-tone), at far right */}
        <div
          className="absolute inset-y-0 bg-forge-border-strong"
          style={{
            left: `${retainedPct + gccPct + manilaPct}%`,
            width: `${existingPct}%`,
          }}
        />
      </div>
      <div className="text-right font-mono text-[11px] text-forge-subtle">
        {fmtInt(total)}
      </div>
    </div>
  );
}
