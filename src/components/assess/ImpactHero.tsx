"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Building2, TrendingUp } from "lucide-react";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import type { AssessProgramV2 } from "@/data/assess/types";
import {
  programImpactSummary,
  programSensitivityDeltas,
} from "@/lib/assess/scenarioModel";
import { towers } from "@/data/towers";
import { cn } from "@/lib/utils";

type Variant = "hero" | "compact";

type Props = {
  program: AssessProgramV2;
  variant?: Variant;
  /** Show "+10pts offshore = $YM | +10pts AI = $ZM" sensitivity ribbon. */
  showSensitivity?: boolean;
  /** Override the headline label. Defaults to "Modeled annual OpEx reduction". */
  label?: string;
  className?: string;
};

/**
 * Live program-wide modeled impact in dollar terms — the hero on Program Home
 * and the Assessment Summary, and a compact variant inside the Assessment hub.
 *
 * The headline animates via `MoneyCounter` so dial drags on any tower tick the
 * number live. The sensitivity ribbon below explains the marginal value of an
 * additional 10 pts on either lever — the answer to "is this worth pushing
 * for?" without leaving the page.
 */
export function ImpactHero({
  program,
  variant = "hero",
  showSensitivity = true,
  label = "Modeled annual OpEx reduction",
  className,
}: Props) {
  const summary = React.useMemo(() => programImpactSummary(program), [program]);
  const sens = React.useMemo(() => programSensitivityDeltas(program), [program]);

  const noData = summary.contributingTowers.length === 0;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/8 via-forge-surface to-forge-surface px-4 py-3",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-purple/15 text-accent-purple-dark">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              Live program impact
            </div>
            <div className="font-display text-xl font-semibold text-forge-ink">
              {noData ? (
                <span className="text-forge-subtle">$—</span>
              ) : (
                <MoneyCounter value={summary.scenarioCombined} />
              )}
            </div>
          </div>
        </div>
        {!noData && showSensitivity ? (
          <div className="flex items-center gap-3 text-[11px] font-mono text-forge-subtle">
            <SensitivityChip label="+10pts off" delta={sens.dOff10} />
            <SensitivityChip label="+10pts AI" delta={sens.dAi10} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/12 via-forge-surface/95 to-forge-surface px-6 py-7 sm:px-8 sm:py-9",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
            <span className="font-mono">&gt;</span>
            {label}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <div className="font-display text-5xl font-semibold tracking-tight text-forge-ink sm:text-6xl">
              {noData ? (
                <span className="text-forge-subtle">$—</span>
              ) : (
                <MoneyCounter value={summary.scenarioCombined} decimals={2} />
              )}
            </div>
            {!noData ? (
              <div className="font-mono text-xs text-forge-subtle">
                pool {formatMoney(summary.totalPool, { decimals: 1 })} ·{" "}
                {summary.contributingTowers.length}/{towers.length} towers
              </div>
            ) : null}
          </div>
          {!noData ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <SplitChip
                label="Offshore"
                value={summary.scenarioOffshore}
                pct={
                  summary.scenarioCombined > 0
                    ? (summary.scenarioOffshore / summary.scenarioCombined) * 100
                    : 0
                }
                hue="purple"
              />
              <SplitChip
                label="AI"
                value={summary.scenarioAi}
                pct={
                  summary.scenarioCombined > 0
                    ? (summary.scenarioAi / summary.scenarioCombined) * 100
                    : 0
                }
                hue="teal"
              />
              <span className="font-mono text-[11px] text-forge-hint">
                wt avg {summary.weightedScenarioOffshorePct.toFixed(0)}% off ·{" "}
                {summary.weightedScenarioAiPct.toFixed(0)}% AI
              </span>
            </div>
          ) : (
            <p className="mt-2 max-w-md text-sm text-forge-subtle">
              Confirm the capability map, set headcount, and dial offshore + AI per L4 — the
              modeled value lights up here as you go.
            </p>
          )}
        </div>
        <div
          className="hidden h-16 w-16 items-center justify-center rounded-2xl border border-accent-purple/30 bg-forge-surface/60 text-accent-purple-dark sm:flex"
          aria-hidden
        >
          <Building2 className="h-7 w-7" />
        </div>
      </div>
      {!noData && showSensitivity ? (
        <div className="mt-5 flex flex-wrap gap-3 border-t border-forge-border pt-4 text-xs">
          <span className="font-mono uppercase tracking-wider text-forge-hint">
            Sensitivity
          </span>
          <SensitivityChip label="+10pts offshore" delta={sens.dOff10} hue="purple" pill />
          <SensitivityChip label="+10pts AI" delta={sens.dAi10} hue="teal" pill />
          <span className="text-forge-subtle">
            (marginal annual $ if every tower gained 10 pts)
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SensitivityChip({
  label,
  delta,
  hue = "purple",
  pill,
}: {
  label: string;
  delta: number;
  hue?: "purple" | "teal";
  pill?: boolean;
}) {
  const positive = delta >= 0;
  const dollar = formatMoney(Math.abs(delta), { decimals: delta >= 1_000_000 ? 1 : 0 });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono",
        pill
          ? hue === "purple"
            ? "rounded-full border border-accent-purple/30 bg-accent-purple/10 px-2.5 py-1 text-accent-purple-dark"
            : "rounded-full border border-accent-teal/30 bg-accent-teal/10 px-2.5 py-1 text-accent-teal"
          : "",
      )}
    >
      <span>{label}</span>
      {positive ? (
        <ArrowUpRight className="h-3 w-3" aria-hidden />
      ) : (
        <ArrowDownRight className="h-3 w-3" aria-hidden />
      )}
      <span className={cn("tabular-nums", positive ? "text-accent-green" : "text-accent-amber")}>
        {positive ? "+" : "-"}
        {dollar}
      </span>
    </span>
  );
}

function SplitChip({
  label,
  value,
  pct,
  hue,
}: {
  label: string;
  value: number;
  pct: number;
  hue: "purple" | "teal";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono",
        hue === "purple"
          ? "border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark"
          : "border border-accent-teal/30 bg-accent-teal/10 text-accent-teal",
      )}
    >
      {label}
      <span className="text-forge-ink">{formatMoney(value, { decimals: 1 })}</span>
      <span className="text-forge-hint">{pct.toFixed(0)}%</span>
    </span>
  );
}
