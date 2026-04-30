"use client";

import * as React from "react";
import { Cpu, Globe2 } from "lucide-react";
import type {
  GlobalAssessAssumptions,
  L3WorkforceRow,
  TowerBaseline,
  TowerId,
} from "@/data/assess/types";
import { rowModeledSaving } from "@/lib/assess/scenarioModel";
import { rowStarterRationale } from "@/data/assess/rowRationale";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import { PercentSlider } from "@/components/ui/PercentSlider";
import { RationalePopover } from "@/components/ui/RationalePopover";
import { cn } from "@/lib/utils";
import { useRedactDollars, RedactedAmount } from "@/lib/clientMode";

type Props = {
  /** The L3 capability row — one slider card per row. */
  row: L3WorkforceRow;
  towerId: TowerId;
  baseline: TowerBaseline;
  global: GlobalAssessAssumptions;
  onPatch: (patch: Partial<L3WorkforceRow>) => void;
};

/**
 * Per-L3 lever card for the Configure Impact Levers module.
 *
 * Tower leads dial offshore + AI on the L3 capability — Versant's preferred
 * granularity for impact-lever inputs (L4 was too granular). The card shows:
 *
 *   - L2 > L3 breadcrumb so the lead always sees where the row sits.
 *   - Headcount + pool $ + a small list of reference L4 activities (display
 *     only; the activities don't drive the math).
 *   - Twin sliders (purple offshore + teal AI) writing directly to the
 *     L3 row's `offshoreAssessmentPct` / `aiImpactAssessmentPct`.
 *   - Modeled saving = offshore + AI (sequential combine), matching
 *     `rowModeledSaving` in `scenarioModel.ts` exactly.
 */
export function L3LeverRow({ row, towerId, baseline, global, onPatch }: Props) {
  const redact = useRedactDollars();
  const saving = React.useMemo(
    () => rowModeledSaving(row, baseline, global),
    [row, baseline, global],
  );

  const headcount =
    row.fteOnshore + row.fteOffshore + row.contractorOnshore + row.contractorOffshore;

  const displayedOffshore = row.offshoreAssessmentPct ?? baseline.baselineOffshorePct;
  const displayedAi = row.aiImpactAssessmentPct ?? baseline.baselineAIPct;
  const offshoreOverridden = row.offshoreAssessmentPct != null;
  const aiOverridden = row.aiImpactAssessmentPct != null;

  // Per-row rationales are sourced in priority order:
  //   1. LLM/heuristic-stamped strings on the row itself (`offshoreRationale`
  //      / `aiImpactRationale`) — written by `applyDefaults` after a Step 2
  //      "Re-score" run, or by the seed loader for sample-loaded rows.
  //   2. Deterministic `rowStarterRationale` text — used when the row hasn't
  //      been scored yet (post-upload, before "Re-score every L3").
  // The provenance chip surfaces which path produced the rationale so tower
  // leads see "AI-scored" vs "heuristic" vs "starter" at a glance.
  const starter = React.useMemo(
    () => rowStarterRationale(towerId, row),
    [towerId, row],
  );
  const rationale = {
    offshore: row.offshoreRationale ?? starter.offshore,
    ai: row.aiImpactRationale ?? starter.ai,
  };
  const rationaleSource = row.dialsRationaleSource;

  const activities = row.l4Activities ?? [];
  const visibleActivities = activities.slice(0, 4);
  const hiddenCount = Math.max(0, activities.length - visibleActivities.length);

  return (
    <div
      id={`l3-${row.id}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-forge-border bg-forge-surface/70 p-3 sm:p-4",
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_minmax(120px,_0.7fr)] sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-forge-hint">
            <span>{row.l2}</span>
            <span className="text-forge-subtle">›</span>
            <span className="text-forge-body">{row.l3}</span>
          </div>
          <div className="mt-0.5 text-sm font-medium text-forge-ink">{row.l3}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
            <span className="font-mono">{headcount} h/c</span>
            <span className="text-forge-hint">·</span>
            <span className="font-mono tabular-nums">
              pool{" "}
              {redact ? (
                <RedactedAmount />
              ) : saving.pool > 0 ? (
                formatMoney(saving.pool, { decimals: saving.pool >= 1_000_000 ? 1 : 0 })
              ) : (
                "$—"
              )}
            </span>
          </div>
          {visibleActivities.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {visibleActivities.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-forge-border/60 bg-forge-well/40 px-2 py-0.5 text-[10px] text-forge-subtle"
                >
                  {name}
                </span>
              ))}
              {hiddenCount > 0 ? (
                <span
                  className="rounded-full border border-forge-border/40 px-1.5 py-0.5 font-mono text-[10px] text-forge-hint"
                  title={`${hiddenCount} more activity${hiddenCount === 1 ? "" : "ies"} on the Capability Map page.`}
                >
                  +{hiddenCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <LeverColumn
          icon={<Globe2 className="h-3 w-3 text-accent-purple-dark" aria-hidden />}
          label="Offshore"
          hue="purple"
          value={displayedOffshore}
          defaultValue={baseline.baselineOffshorePct}
          isDefault={!offshoreOverridden}
          rationaleTitle={`Why ${displayedOffshore}% offshore?`}
          rationaleBody={rationale.offshore}
          rationaleSource={rationaleSource}
          onChange={(v) => onPatch({ offshoreAssessmentPct: v })}
          onClearOverride={() => onPatch({ offshoreAssessmentPct: undefined })}
        />

        <LeverColumn
          icon={<Cpu className="h-3 w-3 text-accent-teal" aria-hidden />}
          label="AI impact"
          hue="teal"
          value={displayedAi}
          defaultValue={baseline.baselineAIPct}
          isDefault={!aiOverridden}
          rationaleTitle={`Why ${displayedAi}% AI?`}
          rationaleBody={rationale.ai}
          rationaleSource={rationaleSource}
          onChange={(v) => onPatch({ aiImpactAssessmentPct: v })}
          onClearOverride={() => onPatch({ aiImpactAssessmentPct: undefined })}
        />

        <div className="flex flex-col items-end justify-between gap-1 text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
            Impact
          </div>
          <div className="font-display text-base font-semibold text-accent-green tabular-nums">
            {redact ? (
              <RedactedAmount className="text-forge-subtle" />
            ) : saving.combined > 0 ? (
              <MoneyCounter
                value={saving.combined}
                decimals={saving.combined >= 1_000_000 ? 1 : 0}
              />
            ) : (
              <span className="text-forge-subtle">$—</span>
            )}
          </div>
          <div className="font-mono text-[10px] text-forge-hint">
            {redact ? (
              <>off — · AI —</>
            ) : (
              <>
                off {formatMoney(saving.offshore, { decimals: 0 })} · AI{" "}
                {formatMoney(saving.ai, { decimals: 0 })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type RationaleSource = "llm" | "heuristic" | "starter" | undefined;

function LeverColumn({
  icon,
  label,
  hue,
  value,
  defaultValue,
  isDefault,
  rationaleTitle,
  rationaleBody,
  rationaleSource,
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
  rationaleSource: RationaleSource;
  onChange: (v: number) => void;
  onClearOverride: () => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {icon}
        <span className="font-medium text-forge-body">{label}</span>
        <RationalePopover hue={hue} title={rationaleTitle} body={rationaleBody} />
        <ProvenanceChip source={rationaleSource} />
        {isDefault ? (
          <span
            className="ml-auto rounded-full border border-forge-border px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-forge-hint"
            title="No override yet — using the tower baseline."
          >
            default
          </span>
        ) : (
          <button
            type="button"
            onClick={onClearOverride}
            className="ml-auto font-mono text-[10px] text-forge-subtle underline-offset-2 hover:text-forge-ink hover:underline"
            title="Clear the override and fall back to the tower default."
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

/**
 * Provenance chip rendered next to the rationale popover. Communicates
 * which path produced the dial value:
 *   - "AI-scored"  → LLM-backed (purple, premium tone).
 *   - "heuristic"  → deterministic fallback (when the LLM was unavailable).
 *   - "starter"    → seeded sample data, never explicitly scored.
 *   - undefined    → no chip; the StaleDialsBanner above is already telling
 *                    the user the dials need a refresh.
 */
function ProvenanceChip({ source }: { source: RationaleSource }) {
  if (!source) return null;
  if (source === "llm") {
    return (
      <span
        className="rounded-full border border-accent-purple/40 bg-accent-purple/10 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-accent-purple"
        title="Scored with the Versant-grounded LLM. Click the chevron for the full rationale."
      >
        &gt; AI-scored
      </span>
    );
  }
  if (source === "heuristic") {
    return (
      <span
        className="rounded-full border border-forge-border px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-forge-subtle"
        title="LLM was unavailable; rationale falls back to the deterministic Versant heuristic."
      >
        &gt; heuristic
      </span>
    );
  }
  return (
    <span
      className="rounded-full border border-forge-border/60 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-forge-hint"
      title="Sample-loaded starter value — re-score with AI to refresh."
    >
      &gt; starter
    </span>
  );
}
