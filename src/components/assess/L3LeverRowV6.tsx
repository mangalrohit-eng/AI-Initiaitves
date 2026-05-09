"use client";

import * as React from "react";
import { Cpu, Globe2 } from "lucide-react";
import type {
  L3WorkforceRowV6,
  L4WorkforceRow,
  TowerBaseline,
  TowerId,
  TowerRates,
} from "@/data/assess/types";
import { rowModeledSaving } from "@/lib/assess/scenarioModel";
import { rowStarterRationale } from "@/data/assess/rowRationale";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import { PercentSlider } from "@/components/ui/PercentSlider";
import { RationalePopover } from "@/components/ui/RationalePopover";
import { cn } from "@/lib/utils";
import { useRedactDollars, RedactedAmount } from "@/lib/clientMode";

type Props = {
  /** The L3 Job Family row — one slider card per row under v6. */
  row: L3WorkforceRowV6;
  /**
   * Child L4 Activity Group rows for context. Rendered as compact chips
   * inside the L3 card so the user sees "what's inside this L3 Job Family"
   * without leaving Step 2. Order is preserved — chips render in
   * `row.childL4RowIds` order.
   */
  childL4Rows: L4WorkforceRow[];
  towerId: TowerId;
  baseline: TowerBaseline;
  /**
   * Tower-owned cost rates. Used to size the row's pool $ and to value
   * the offshore wage gap. Each tower owns its own copy on
   * `TowerAssessState.rates` — pass that here, never a program-level
   * global.
   */
  rates: TowerRates;
  onPatch: (patch: Partial<L3WorkforceRowV6>) => void;
};

/**
 * Per-L3-Job-Family lever card for the Configure Impact Levers module
 * (v6).
 *
 * Tower leads dial offshore + AI on the L3 Job Family — the v6 grain.
 * The card shows:
 *
 *   - L2 Job Grouping > L3 Job Family breadcrumb so the lead always
 *     sees where the row sits in the 5-layer map.
 *   - Aggregate headcount + pool $ (sums of child L4 rows) and a
 *     compact list of child L4 Activity Group chips for context.
 *   - Twin sliders (purple offshore + teal AI) writing directly to the
 *     L3 row's `offshoreAssessmentPct` / `aiImpactAssessmentPct`.
 *   - Modeled saving = offshore + AI (sequential combine), matching
 *     `rowModeledSaving` in `scenarioModel.ts` exactly.
 *
 * Sibling to `L4LeverRow.tsx` (v5) — kept in a separate file so the
 * v5 surface stays untouched through the cutover. Phase 7 cleanup
 * deletes the v5 component and renames this back to `L3LeverRow.tsx`
 * once the schema flag is retired.
 */
export function L3LeverRowV6({
  row,
  childL4Rows,
  towerId,
  baseline,
  rates,
  onPatch,
}: Props) {
  const redact = useRedactDollars();
  const saving = React.useMemo(
    () => rowModeledSaving(row, baseline, rates),
    [row, baseline, rates],
  );

  const headcount =
    row.fteOnshore + row.fteOffshore + row.contractorOnshore + row.contractorOffshore;

  const displayedOffshore = row.offshoreAssessmentPct ?? baseline.baselineOffshorePct;
  const displayedAi = row.aiImpactAssessmentPct ?? baseline.baselineAIPct;
  const offshoreOverridden = row.offshoreAssessmentPct != null;
  const aiOverridden = row.aiImpactAssessmentPct != null;

  // Per-row rationales — same priority order as the v5 L4LeverRow.
  // `rowStarterRationale` is keyed off (towerId, row) where the row only
  // needs to expose `l2`/`l3` strings; the L3 row carries those directly.
  const starter = React.useMemo(
    () =>
      rowStarterRationale(towerId, {
        // The starter helper reads `l2`/`l3`/`l4` to look up the keyword
        // dictionary; under v6 the L3 row's `l3` IS the dial-bearing
        // label, so we pass it as both `l3` and `l4` to satisfy the v5
        // signature without inventing a new helper for this one call.
        l2: row.l2,
        l3: row.l3,
        l4: row.l3,
      } as L4WorkforceRow),
    [towerId, row.l2, row.l3],
  );
  const rationale = {
    offshore: row.offshoreRationale ?? starter.offshore,
    ai: row.aiImpactRationale ?? starter.ai,
  };
  const rationaleSource = row.dialsRationaleSource;

  // Show up to 4 child L4 Activity Group names as chips. Same UI shape
  // as the v5 L5 Activities chip strip on `L4LeverRow`, just one level
  // up in the hierarchy.
  const visibleChildren = childL4Rows.slice(0, 4);
  const hiddenChildrenCount = Math.max(0, childL4Rows.length - visibleChildren.length);

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
            <span className="text-forge-hint">·</span>
            <span className="font-mono">
              {childL4Rows.length} L4 Activity Group{childL4Rows.length === 1 ? "" : "s"}
            </span>
          </div>
          {visibleChildren.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {visibleChildren.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full border border-forge-border/60 bg-forge-well/40 px-2 py-0.5 text-[10px] text-forge-subtle"
                  title={`Activity Group: ${c.l4}`}
                >
                  {c.l4}
                </span>
              ))}
              {hiddenChildrenCount > 0 ? (
                <span
                  className="rounded-full border border-forge-border/40 px-1.5 py-0.5 font-mono text-[10px] text-forge-hint"
                  title={`${hiddenChildrenCount} more Activity Group${hiddenChildrenCount === 1 ? "" : "s"} on the Capability Map page.`}
                >
                  +{hiddenChildrenCount}
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
