"use client";

import * as React from "react";
import { Cpu, Globe2 } from "lucide-react";
import type {
  GlobalAssessAssumptions,
  L4WorkforceRow,
  TowerBaseline,
  TowerId,
} from "@/data/assess/types";
import { rowModeledSaving } from "@/lib/assess/scenarioModel";
import { rowStarterRationale } from "@/data/assess/rowRationale";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import { PercentSlider } from "@/components/ui/PercentSlider";
import { RationalePopover } from "@/components/ui/RationalePopover";
import { cn } from "@/lib/utils";

type Props = {
  row: L4WorkforceRow;
  towerId: TowerId;
  baseline: TowerBaseline;
  global: GlobalAssessAssumptions;
  /**
   * Live update — fires on every drag tick. Caller wires the patch into the
   * shared tower state so the scoreboard above re-renders smoothly.
   */
  onPatch: (patch: Partial<L4WorkforceRow>) => void;
};

/**
 * Cinematic per-L4 lever row for the Assessment module.
 *
 * Replaces the row-of-number-inputs layout with:
 *   - the L4 label and pool $ on the left,
 *   - twin sliders (purple offshore + teal AI) with starter-default tick marks
 *     and "i" rationale popovers,
 *   - the per-row modeled saving on the right, animating live as either
 *     slider drags so the user feels each tick translate into dollars.
 *
 * The per-row math respects the same combine cap as the tower roll-up via
 * `rowModeledSaving`, so the row sum reconciles to the tower scoreboard.
 */
export function AssessmentLeverRow({ row, towerId, baseline, global, onPatch }: Props) {
  const offshorePct = row.l4OffshoreAssessmentPct ?? baseline.baselineOffshorePct;
  const aiPct = row.l4AiImpactAssessmentPct ?? baseline.baselineAIPct;
  const rationale = React.useMemo(
    () => rowStarterRationale(towerId, row),
    [towerId, row],
  );
  const saving = React.useMemo(
    () => rowModeledSaving(row, baseline, global),
    [row, baseline, global],
  );

  const offIsDefault = row.l4OffshoreAssessmentPct == null;
  const aiIsDefault = row.l4AiImpactAssessmentPct == null;

  return (
    <div
      className={cn(
        "grid gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-3 sm:grid-cols-[1.4fr_1fr_1fr_minmax(120px,_0.7fr)] sm:gap-4 sm:p-4",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-forge-hint">
          <span>{row.l2}</span>
          <span>&gt;</span>
          <span>{row.l3}</span>
        </div>
        <div className="mt-0.5 text-sm font-medium text-forge-ink">{row.l4}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
          <span className="font-mono">
            {row.fteOnshore + row.fteOffshore + row.contractorOnshore + row.contractorOffshore} h/c
          </span>
          <span className="text-forge-hint">·</span>
          <span className="font-mono tabular-nums">
            pool {saving.pool > 0 ? formatMoney(saving.pool, { decimals: saving.pool >= 1_000_000 ? 1 : 0 }) : "$—"}
          </span>
        </div>
      </div>

      <LeverColumn
        icon={<Globe2 className="h-3 w-3 text-accent-purple-dark" aria-hidden />}
        label="Offshore"
        hue="purple"
        value={offshorePct}
        defaultValue={baseline.baselineOffshorePct}
        isDefault={offIsDefault}
        rationaleTitle={`Why ${baseline.baselineOffshorePct}% offshore?`}
        rationaleBody={rationale.offshore}
        onChange={(v) => onPatch({ l4OffshoreAssessmentPct: v })}
        onClearOverride={() => onPatch({ l4OffshoreAssessmentPct: undefined })}
      />

      <LeverColumn
        icon={<Cpu className="h-3 w-3 text-accent-teal" aria-hidden />}
        label="AI impact"
        hue="teal"
        value={aiPct}
        defaultValue={baseline.baselineAIPct}
        isDefault={aiIsDefault}
        rationaleTitle={`Why ${baseline.baselineAIPct}% AI?`}
        rationaleBody={rationale.ai}
        onChange={(v) => onPatch({ l4AiImpactAssessmentPct: v })}
        onClearOverride={() => onPatch({ l4AiImpactAssessmentPct: undefined })}
      />

      <div className="flex flex-col items-end justify-between gap-1 text-right">
        <div className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
          Modeled saving
        </div>
        <div className="font-display text-base font-semibold text-accent-green tabular-nums">
          {saving.combined > 0 ? (
            <MoneyCounter
              value={saving.combined}
              decimals={saving.combined >= 1_000_000 ? 1 : 0}
            />
          ) : (
            <span className="text-forge-subtle">$—</span>
          )}
        </div>
        <div className="font-mono text-[10px] text-forge-hint">
          off {formatMoney(saving.offshore, { decimals: 0 })} · AI{" "}
          {formatMoney(saving.ai, { decimals: 0 })}
        </div>
      </div>
    </div>
  );
}

function LeverColumn({
  icon,
  label,
  hue,
  value,
  defaultValue,
  isDefault,
  rationaleTitle,
  rationaleBody,
  onChange,
  onClearOverride,
}: {
  icon: React.ReactNode;
  label: string;
  hue: "purple" | "teal";
  value: number;
  defaultValue: number;
  isDefault: boolean;
  rationaleTitle: string;
  rationaleBody: string;
  onChange: (v: number) => void;
  onClearOverride: () => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {icon}
        <span className="font-medium text-forge-body">{label}</span>
        <RationalePopover hue={hue} title={rationaleTitle} body={rationaleBody} />
        {isDefault ? (
          <span className="ml-auto rounded-full border border-forge-border px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-forge-hint">
            default
          </span>
        ) : (
          <button
            type="button"
            onClick={onClearOverride}
            className="ml-auto font-mono text-[10px] text-forge-subtle underline-offset-2 hover:text-forge-ink hover:underline"
            title="Clear this override and fall back to the tower default"
          >
            reset
          </button>
        )}
      </div>
      <div className="mt-1.5">
        <PercentSlider
          ariaLabel={`${label} percent`}
          value={value}
          onChange={onChange}
          hue={hue}
          defaultMark={defaultValue}
          compact
        />
      </div>
    </div>
  );
}
