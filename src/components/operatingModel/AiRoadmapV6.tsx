"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Compass, Rocket } from "lucide-react";
import type { Feasibility, Tower } from "@/data/types";
import { cn } from "@/lib/utils";
import { feasibilityChip } from "@/lib/feasibilityChip";
import { useTowerInitiativesV6 } from "@/lib/initiatives/useTowerInitiativesV6";
import type {
  V6InitiativeCard,
  V6L3Row,
} from "@/lib/initiatives/selectV6";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { L3_FTE_DATA_MISSING_LABEL } from "@/lib/initiatives/attributeL3AiUsd";

/**
 * Per-tower feasibility roster — v6 sibling of `AiRoadmap.tsx`.
 *
 * Step 4 deliberately does NOT show P1/P2/P3 priority chips. Program
 * priority is owned by the cross-tower 2x2 (feasibility × business
 * impact) and lives on the Cross-Tower AI Plan page. Here we surface
 * the binary feasibility signal so a tower lead can scan Proven
 * pattern bets vs. those that need a New build.
 *
 * Under v6 the roster is cards-per-AI-Solution, not per-L5-Activity —
 * each card carries the specific solution name + its parent L3 Job
 * Family for context.
 */
type RoadmapItem = {
  init: V6InitiativeCard;
  row: V6L3Row;
};

type FeasibilityColumn = {
  key: Feasibility;
  title: string;
  subtitle: string;
  items: RoadmapItem[];
  iconBg: string;
  Icon: typeof Rocket;
};

type Applicability = "Retained" | "Offshored" | "Both";

const APPLICABILITY_VALUES: Applicability[] = ["Retained", "Offshored", "Both"];

export function AiRoadmapV6({ tower }: { tower: Tower }) {
  const result = useTowerInitiativesV6(tower);
  const [activeApplicability, setActiveApplicability] = React.useState<
    Set<Applicability>
  >(() => new Set(APPLICABILITY_VALUES));

  const allItems: RoadmapItem[] = [];
  for (const row of result.l3Rows) {
    for (const init of row.initiatives) {
      if (init.isPlaceholder) continue;
      if (!init.feasibility) continue;
      allItems.push({ init, row });
    }
  }

  // Counts across the full set drive the chip badges, regardless of filter.
  const totalCounts: Record<Applicability, number> = {
    Retained: 0,
    Offshored: 0,
    Both: 0,
  };
  for (const item of allItems) totalCounts[item.init.applicability] += 1;

  const filteredItems = allItems.filter((item) =>
    activeApplicability.has(item.init.applicability),
  );

  const grouped: Record<Feasibility, RoadmapItem[]> = { High: [], Low: [] };
  for (const item of filteredItems) grouped[item.init.feasibility!].push(item);

  const totalAi = grouped.High.length + grouped.Low.length;
  const hasAnyApplicability = totalCounts.Retained + totalCounts.Offshored + totalCounts.Both > 0;

  if (totalAi === 0) {
    const { queuedRowCount, totalRowCount } = result.diagnostics;
    const allQueued = totalRowCount > 0 && queuedRowCount === totalRowCount;
    const noRows = totalRowCount === 0;
    if (allQueued) {
      return (
        <div className="rounded-2xl border border-accent-amber/40 bg-accent-amber/5 px-5 py-8 text-center">
          <p className="font-display text-sm font-semibold text-forge-ink">
            Roster is queued for refresh.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-forge-subtle">
            Click{" "}
            <span className="font-semibold text-accent-amber">
              Refresh AI guidance
            </span>{" "}
            in the banner above to score every Job Family. The roster populates
            once each AI Solution carries a feasibility verdict.
          </p>
        </div>
      );
    }
    if (noRows) {
      return (
        <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
          No capability map uploaded yet. Open{" "}
          <span className="font-semibold text-forge-body">
            Step 1 (Capability Map)
          </span>{" "}
          and upload the tower&rsquo;s L1–L4 hierarchy + headcount file to begin.
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
        No AI Solutions have been scored for feasibility yet. Open{" "}
        <span className="font-semibold text-forge-body">
          Step 3 (Configure Impact Levers)
        </span>{" "}
        and raise the AI dial on the Job Families you want surfaced into
        the cross-tower 2x2.
      </div>
    );
  }

  const columns: FeasibilityColumn[] = [
    {
      key: "High",
      title: "Proven pattern",
      subtitle:
        "Leverages a proven Versant platform or pattern; estimated first-half-year landing once funded.",
      items: grouped.High,
      iconBg: "from-accent-teal to-emerald-500",
      Icon: Rocket,
    },
    {
      key: "Low",
      title: "New build",
      subtitle:
        "No existing pattern at Versant — needs platform stand-up, deeper integration, or change management.",
      items: grouped.Low,
      iconBg: "from-slate-500 to-slate-700",
      Icon: Compass,
    },
  ];

  const allFiltersOff = activeApplicability.size === 0;

  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-forge-border bg-forge-well/40 px-3 py-2 text-[11px] leading-relaxed text-forge-subtle">
        <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
        Per-tower roster groups by{" "}
        <span className="font-semibold text-forge-body">feasibility</span>.
        Final program priority (P1 / P2 / P3) is set on the{" "}
        <span className="font-semibold text-forge-body">Cross-Tower AI Plan</span>{" "}
        via the feasibility × business-impact 2x2 — that view reconciles
        sequencing across all 14 towers.
      </p>

      {hasAnyApplicability ? (
        <ApplicabilityFilterBar
          counts={totalCounts}
          active={activeApplicability}
          onToggle={(value) => {
            setActiveApplicability((prev) => {
              const next = new Set(prev);
              if (next.has(value)) next.delete(value);
              else next.add(value);
              return next;
            });
          }}
          onReset={() => setActiveApplicability(new Set(APPLICABILITY_VALUES))}
        />
      ) : null}

      {allFiltersOff ? (
        <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
          No applicability filter is selected. Tap a chip above (or{" "}
          <button
            type="button"
            onClick={() => setActiveApplicability(new Set(APPLICABILITY_VALUES))}
            className="font-semibold text-accent-purple-dark underline-offset-2 hover:underline"
          >
            reset
          </button>
          ) to see initiatives again.
        </div>
      ) : null}

      <div className={cn("grid gap-4 lg:grid-cols-2", allFiltersOff && "hidden")}>
        {columns.map((col) => {
          const chip = feasibilityChip(col.key);
          const Icon = col.Icon;
          return (
            <div
              key={col.key}
              className="flex flex-col rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                      col.iconBg,
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <div className="font-display text-sm font-semibold text-forge-ink">
                      {col.title}
                    </div>
                    <div className="text-[11px] text-forge-subtle">
                      {col.subtitle}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums",
                    chip.badge,
                  )}
                >
                  {col.items.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {col.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-forge-border bg-forge-surface/60 p-4 text-center text-xs text-forge-hint">
                    No solutions in this band yet.
                  </div>
                ) : (
                  col.items.map((item, i) => (
                    <RoadmapCardV6
                      key={item.init.id}
                      item={item}
                      index={i}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const APPLICABILITY_CHIP_LABEL: Record<Applicability, string> = {
  Retained: "Retained org",
  Offshored: "Offshored",
  Both: "Both",
};

const APPLICABILITY_CHIP_TOOLTIP: Record<Applicability, string> = {
  Retained:
    "Initiatives that target work staying onshore after the GCC build-out (OnshoreRetained / EditorialCarveOut).",
  Offshored:
    "Initiatives that target work moving to the GCC (GccEligible / GccWithOverlay).",
  Both: "Initiatives that span both retained and offshored work — or sit on rows not yet classified.",
};

function ApplicabilityFilterBar({
  counts,
  active,
  onToggle,
  onReset,
}: {
  counts: Record<Applicability, number>;
  active: ReadonlySet<Applicability>;
  onToggle: (value: Applicability) => void;
  onReset: () => void;
}) {
  const showReset = active.size !== APPLICABILITY_VALUES.length;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forge-border bg-forge-surface/60 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
        &gt; Filter by applicability
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {APPLICABILITY_VALUES.map((value) => {
          const isActive = active.has(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggle(value)}
              title={APPLICABILITY_CHIP_TOOLTIP[value]}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition",
                isActive
                  ? "border-accent-purple/45 bg-accent-purple/10 text-accent-purple-dark"
                  : "border-forge-border bg-forge-surface text-forge-subtle hover:border-accent-purple/35 hover:text-forge-body",
              )}
            >
              {APPLICABILITY_CHIP_LABEL[value]}
              <span className="rounded-full bg-forge-well/60 px-1.5 py-0 font-mono text-[10px] tabular-nums text-forge-subtle">
                {counts[value]}
              </span>
            </button>
          );
        })}
      </div>
      {showReset ? (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto font-mono text-[10px] text-forge-subtle underline-offset-2 hover:text-accent-purple-dark hover:underline"
        >
          reset
        </button>
      ) : null}
    </div>
  );
}

function RoadmapCardV6({
  item,
  index,
}: {
  item: RoadmapItem;
  index: number;
}) {
  const redact = useRedactDollars();
  const { init, row } = item;
  const isLink = Boolean(init.initiativeHref);

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm transition",
        isLink ? "hover:border-accent-purple/50 hover:shadow-card" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-forge-ink group-hover:text-accent-purple-dark">
            {init.solutionName}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-forge-hint">
            {row.l2} · {row.l3}
          </div>
        </div>
        {isLink ? (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-forge-hint transition group-hover:text-accent-purple" />
        ) : null}
      </div>

      {init.tagline ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-forge-body">
          {init.tagline}
        </p>
      ) : null}
      {init.aiRationale ? (
        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-forge-subtle">
          {init.aiRationale}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
        {!redact ? (
          init.l3FteDataMissing && init.attributedAiUsd <= 0 ? (
            <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono text-[10px] text-forge-body">
              {L3_FTE_DATA_MISSING_LABEL}
            </span>
          ) : (
            <span
              className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono tabular-nums text-forge-ink"
              title={`Job Family modeled AI $: ${formatUsdCompact(row.aiUsd, { decimals: 1 })}`}
            >
              {formatUsdCompact(init.attributedAiUsd, { decimals: 1 })} Attributed AI $
            </span>
          )
        ) : null}
        {init.primaryVendor ? (
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5">
            {init.primaryVendor}
          </span>
        ) : null}
        {init.coversL4RowIds.length > 0 ? (
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono">
            covers {init.coversL4RowIds.length} AG
          </span>
        ) : null}
      </div>
    </motion.div>
  );

  if (init.initiativeHref) {
    return (
      <Link href={init.initiativeHref} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
