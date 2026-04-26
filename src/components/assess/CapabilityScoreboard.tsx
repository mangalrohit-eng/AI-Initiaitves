"use client";

import * as React from "react";
import { CheckCircle2, ListTree, MapPin, Network, Users } from "lucide-react";
import type { AssessProgramV2, L3WorkforceRow, TowerId } from "@/data/assess/types";
import {
  programCapabilityCounts,
  programHeadcountTotals,
  towerCapabilityCounts,
  towerFootprintCoverage,
  type CapabilityCounts,
} from "@/lib/assess/capabilityCounts";
import { VERSANT_REPORTED_FTE } from "@/data/assess/seedAssessProgram";
import { towers } from "@/data/towers";
import { cn } from "@/lib/utils";

type Props = {
  /** "program" — sums L1/L2/L3/L4 across the 13 towers. "tower" — single tower. */
  variant: "program" | "tower";
  program: AssessProgramV2;
  /** Required when variant is "tower". */
  towerId?: TowerId;
  /** Required when variant is "tower". */
  rows?: L3WorkforceRow[];
  className?: string;
};

/**
 * Top-of-page metrics strip for the Capability Map module.
 *
 * Program variant — used on the hub: sums L1/L2/L3/L4 across contributing
 * towers and shows confirmation progress.
 *
 * Tower variant — used on each tower page: shows the same counts for that
 * tower plus footprint coverage (how many L3 capabilities have any headcount
 * or spend).
 */
export function CapabilityScoreboard(props: Props) {
  const { variant, program, towerId, rows, className } = props;

  // useMemo must be called unconditionally; compute even when not "program" so
  // hook order is stable. The result is only consumed in the program branch.
  const programCounts = React.useMemo(
    () => (variant === "program" ? programCapabilityCounts(program) : null),
    [variant, program],
  );
  const programHeadcount = React.useMemo(
    () => (variant === "program" ? programHeadcountTotals(program) : null),
    [variant, program],
  );

  if (variant === "program") {
    // programCounts and programHeadcount are non-null whenever variant === "program"
    const counts = programCounts!;
    const headcount = programHeadcount!;
    const completed = towers.filter(
      (t) => program.towers[t.id]?.status === "complete",
    ).length;
    const versantGap = headcount.fte - VERSANT_REPORTED_FTE;
    const versantSubtle =
      headcount.fte === 0
        ? `vs Versant ${VERSANT_REPORTED_FTE.toLocaleString()} — load sample`
        : versantGap === 0
          ? `matches Versant ${VERSANT_REPORTED_FTE.toLocaleString()}`
          : `${versantGap > 0 ? "+" : "−"}${Math.abs(versantGap).toLocaleString()} vs Versant ${VERSANT_REPORTED_FTE.toLocaleString()}`;
    const headcountAccent: "green" | undefined =
      headcount.fte > 0 && Math.abs(versantGap) <= 50 ? "green" : undefined;
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-2 rounded-2xl border border-forge-border bg-forge-surface/70 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-5",
          className,
        )}
      >
        <Tile
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Towers covered"
          value={`${counts.contributingTowers}/${towers.length}`}
          subtle={`L1 in scope`}
        />
        <Tile
          icon={<Users className="h-3.5 w-3.5" />}
          label="Headcount (FTE)"
          value={headcount.fte.toLocaleString()}
          subtle={versantSubtle}
          accent={headcountAccent}
        />
        <Tile
          icon={<ListTree className="h-3.5 w-3.5" />}
          label="L2 capabilities"
          value={counts.l2}
          subtle="across program"
        />
        <Tile
          icon={<Network className="h-3.5 w-3.5" />}
          label="L3 + L4 nodes"
          value={
            <span className="inline-flex items-baseline gap-1.5">
              <span>{counts.l3.toLocaleString()}</span>
              <span className="text-xs font-medium text-forge-hint">L3</span>
              <span className="text-forge-hint">·</span>
              <span>{counts.l4.toLocaleString()}</span>
              <span className="text-xs font-medium text-forge-hint">L4</span>
            </span>
          }
          subtle="in current scope"
        />
        <Tile
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Towers reviewed"
          value={`${completed}/${towers.length}`}
          subtle={completed > 0 ? "signed off by tower lead" : "awaiting tower lead review"}
          accent={completed > 0 ? "green" : undefined}
        />
      </div>
    );
  }

  if (!towerId || !rows) return null;
  const counts = towerCapabilityCounts(towerId, rows);
  const coverage = towerFootprintCoverage(towerId, rows);
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 rounded-2xl border border-forge-border bg-forge-surface/70 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4",
        className,
      )}
    >
      <Tile
        icon={<MapPin className="h-3.5 w-3.5" />}
        label="L1"
        value={counts.l1}
        subtle={counts.l1 > 0 ? "tower in scope" : "no map yet"}
      />
      <Tile
        icon={<ListTree className="h-3.5 w-3.5" />}
        label="L2 + L3 capabilities"
        value={
          <span className="inline-flex items-baseline gap-1.5">
            <span>{counts.l2}</span>
            <span className="text-xs font-medium text-forge-hint">L2</span>
            <span className="text-forge-hint">·</span>
            <span>{counts.l3}</span>
            <span className="text-xs font-medium text-forge-hint">L3</span>
          </span>
        }
        subtle="assessed unit"
      />
      <Tile
        icon={<Network className="h-3.5 w-3.5" />}
        label="L4 activities"
        value={counts.l4}
        subtle="display only"
      />
      <Tile
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label="Headcount coverage"
        value={`${coverage.confirmedL3s}/${coverage.totalL3s || counts.l3}`}
        subtle={coverage.confirmedL3s > 0 ? "with headcount or spend" : "upload a capability map"}
        accent={coverage.confirmedL3s > 0 ? "green" : undefined}
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  subtle,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | React.ReactNode;
  subtle?: string;
  accent?: "green" | "purple";
}) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          accent === "green"
            ? "bg-accent-green/15 text-accent-green"
            : accent === "purple"
              ? "bg-accent-purple/15 text-accent-purple-dark"
              : "bg-forge-well/60 text-forge-subtle",
        )}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
          {label}
        </div>
        <div className="font-display text-lg font-semibold tabular-nums text-forge-ink">
          {value}
        </div>
        {subtle ? <div className="text-[11px] text-forge-subtle">{subtle}</div> : null}
      </div>
    </div>
  );
}

export type { CapabilityCounts };
