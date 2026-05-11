"use client";

import * as React from "react";
import { Sparkles, Compass, Rocket, Layers } from "lucide-react";
import type { Tower } from "@/data/types";
import { useTowerInitiativesV6 } from "@/lib/initiatives/useTowerInitiativesV6";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars, RedactedAmount } from "@/lib/clientMode";
import { cn } from "@/lib/utils";

type KpiCellProps = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Optional Lucide icon rendered next to the label. */
  Icon?: React.ComponentType<{ className?: string }>;
  /** Optional Tailwind tone class used on the icon + accent border. */
  tone?: string;
};

/**
 * Four-up KPI strip that anchors the page directly under the hero.
 * Pulls every number from the live V6 selector so the KPI strip and
 * the gallery below it stay in lockstep.
 *
 * The strip intentionally does NOT show a "Headline solution" tile —
 * the gallery below ranks every solution; calling one out here would
 * compete with that browse experience.
 */
export function TowerKpiStrip({ tower }: { tower: Tower }) {
  const result = useTowerInitiativesV6(tower);
  const redact = useRedactDollars();

  const totalSolutions = result.diagnostics.initiativesRendered;
  let shipReady = 0;
  let newBuild = 0;
  let pendingBrief = 0;
  for (const row of result.l3Rows) {
    for (const init of row.initiatives) {
      if (init.isPlaceholder) continue;
      if (init.feasibility === "High") shipReady += 1;
      else if (init.feasibility === "Low") newBuild += 1;
      else pendingBrief += 1;
    }
  }
  const totalRows = result.diagnostics.totalRowCount;
  const rowsWithFocus = result.l3Rows.length;

  return (
    <section
      aria-label="Tower AI snapshot"
      className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <KpiCell
        label="Modeled AI prize"
        Icon={Sparkles}
        tone="text-accent-purple-light border-accent-purple/40"
        value={
          redact ? (
            <RedactedAmount className="text-forge-ink" />
          ) : (
            <span className="font-mono tabular-nums text-forge-ink">
              {formatUsdCompact(result.towerAiUsd, { decimals: 1 })}
            </span>
          )
        }
        hint={
          <>
            Across <span className="text-forge-body">{rowsWithFocus}</span>{" "}
            Job Famil{rowsWithFocus === 1 ? "y" : "ies"} with AI dial &gt; 0
          </>
        }
      />
      <KpiCell
        label="AI Solutions"
        Icon={Layers}
        tone="text-accent-purple-light border-accent-purple/40"
        value={
          <span className="font-mono tabular-nums text-forge-ink">
            {totalSolutions}
          </span>
        }
        hint={`Specific products Versant could build or buy in this tower`}
      />
      <KpiCell
        label="Proven / New build / Pending brief"
        Icon={Rocket}
        tone="text-accent-teal border-accent-teal/40"
        value={
          <span className="font-mono tabular-nums text-forge-ink">
            <span className="text-accent-teal">{shipReady}</span>
            <span className="px-1 text-forge-hint">/</span>
            <span className="text-forge-body">{newBuild}</span>
            <span className="px-1 text-forge-hint">/</span>
            <span className="text-forge-subtle">{pendingBrief}</span>
          </span>
        }
        hint={
          <span className="inline-flex items-center gap-1.5">
            <Compass className="h-3 w-3 text-forge-hint" aria-hidden />
            After the AI Solution brief runs, Proven vs New build is locked from
            build/buy/discover. Pending means no brief yet.
          </span>
        }
      />
      <KpiCell
        label="Job Families with AI focus"
        Icon={Layers}
        tone="text-forge-body border-forge-border-strong"
        value={
          <span className="font-mono tabular-nums text-forge-ink">
            {rowsWithFocus}
            <span className="px-1 text-forge-hint">of</span>
            {totalRows}
          </span>
        }
        hint={
          totalRows === 0
            ? "Upload a capability map on Step 1 to populate"
            : "Counted from L3 rows where the AI dial is above zero"
        }
      />
    </section>
  );
}

function KpiCell({ label, value, hint, Icon, tone }: KpiCellProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-forge-border bg-forge-surface/70 p-3.5",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
      )}
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-forge-hint">
        {Icon ? (
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-md border bg-near-black/40",
              tone ?? "text-forge-body border-forge-border",
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-[11px] leading-relaxed text-forge-subtle">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
