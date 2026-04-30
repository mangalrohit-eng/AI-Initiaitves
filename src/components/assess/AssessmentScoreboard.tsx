"use client";

import * as React from "react";
import { CheckCircle2, Cpu, Globe2, TrendingUp } from "lucide-react";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import type { AssessProgramV2, L3WorkforceRow, TowerId } from "@/data/assess/types";
import {
  programImpactSummary,
  rowAnnualCost,
  towerOutcomeForState,
  weightedTowerLevers,
} from "@/lib/assess/scenarioModel";
import { towers } from "@/data/towers";
import { cn } from "@/lib/utils";
import { useRedactDollars, RedactedAmount } from "@/lib/clientMode";

type Props =
  | {
      variant: "program";
      program: AssessProgramV2;
      className?: string;
    }
  | {
      variant: "tower";
      program: AssessProgramV2;
      towerId: TowerId;
      rows: L3WorkforceRow[];
      className?: string;
    };

/**
 * Top-of-page metrics strip for the Configure Impact Levers module.
 *
 * Program variant — average offshore %, average AI %, towers scored, and the
 * live modeled $.
 *
 * Tower variant — pool $, weighted offshore %, weighted AI %, modeled $ for
 * the single tower at its current scenario dials.
 */
export function AssessmentScoreboard(props: Props) {
  const redact = useRedactDollars();
  // useMemo must be called unconditionally; pass null when not the program
  // variant so the hook order is stable across renders.
  const programForSummary = props.variant === "program" ? props.program : null;
  const summary = React.useMemo(
    () => (programForSummary ? programImpactSummary(programForSummary) : null),
    [programForSummary],
  );

  if (props.variant === "program") {
    const { className } = props;
    // summary is non-null whenever variant === "program" (see useMemo above)
    const s = summary!;
    const scored = s.contributingTowers.length;
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-2 rounded-2xl border border-forge-border bg-forge-surface/70 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4",
          className,
        )}
      >
        <Tile
          icon={<Globe2 className="h-3.5 w-3.5" />}
          label="Avg offshore"
          value={`${s.weightedOffshorePct.toFixed(0)}%`}
          subtle="cost-weighted"
          accent="purple"
        />
        <Tile
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="Avg AI impact"
          value={`${s.weightedAiPct.toFixed(0)}%`}
          subtle="cost-weighted"
          accent="teal"
        />
        <Tile
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Towers scored"
          value={`${scored}/${towers.length}`}
          subtle={scored > 0 ? "with dial input" : "none yet"}
        />
        <Tile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Impact"
          subtle={
            redact
              ? "no data"
              : s.totalPool > 0
                ? `pool ${formatMoney(s.totalPool, { decimals: 1 })}`
                : "no data"
          }
          counter={
            redact ? (
              <RedactedAmount className="text-forge-subtle" />
            ) : (
              <MoneyCounter
                value={s.combined}
                decimals={s.combined >= 1_000_000_000 ? 2 : 1}
              />
            )
          }
          accent="green"
        />
      </div>
    );
  }

  const { program, towerId, rows, className } = props;
  const tState = program.towers[towerId];
  const weighted = rows.length && tState ? weightedTowerLevers(rows, tState.baseline, program.global) : null;
  const outcome = towerOutcomeForState(towerId, program);
  const pool = rows.reduce((s, r) => s + rowAnnualCost(r, program.global), 0);

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 rounded-2xl border border-forge-border bg-forge-surface/70 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4",
        className,
      )}
    >
      <Tile
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Tower pool"
        subtle="annual"
        counter={
          redact ? (
            <RedactedAmount className="text-forge-subtle" />
          ) : pool > 0 ? (
            <MoneyCounter value={pool} decimals={1} />
          ) : (
            <span>$—</span>
          )
        }
      />
      <Tile
        icon={<Globe2 className="h-3.5 w-3.5" />}
        label="Offshore (wt avg)"
        value={weighted ? `${weighted.offshorePct.toFixed(0)}%` : "—"}
        subtle="across L3 capabilities"
        accent="purple"
      />
      <Tile
        icon={<Cpu className="h-3.5 w-3.5" />}
        label="AI impact (wt avg)"
        value={weighted ? `${weighted.aiPct.toFixed(0)}%` : "—"}
        subtle="across L3 capabilities"
        accent="teal"
      />
      <Tile
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Impact"
        subtle="at L3 dial settings"
        counter={
          redact ? (
            <RedactedAmount className="text-forge-subtle" />
          ) : outcome ? (
            <MoneyCounter
              value={outcome.combined}
              decimals={outcome.combined >= 1_000_000 ? 1 : 0}
            />
          ) : (
            <span>$—</span>
          )
        }
        accent="green"
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  counter,
  subtle,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  counter?: React.ReactNode;
  subtle?: string;
  accent?: "green" | "purple" | "teal";
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
              : accent === "teal"
                ? "bg-accent-teal/15 text-accent-teal"
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
          {counter ?? value}
        </div>
        {subtle ? <div className="text-[11px] text-forge-subtle">{subtle}</div> : null}
      </div>
    </div>
  );
}
