"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import { hasInFlightRows } from "@/lib/initiatives/curationHash";
import {
  runForRows,
  type RunSummary,
} from "@/lib/assess/curationPipeline";
import {
  runForL3Rows,
  type RunV6Summary,
} from "@/lib/assess/curationPipelineV6";
import {
  aggregateRunSummaries,
  chunkRowsForCurationApi,
  regenerableRowsForStep4,
} from "@/lib/assess/curationRegenerateBatch";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { getTowerHref } from "@/lib/towerHref";
import { cn } from "@/lib/utils";
import { curationProgressLine, llmLoadingCopy } from "@/lib/llm/loadingCopy";
import { IS_V6 } from "@/lib/schemaFlag";

function applyRegenerateToast(toast: ReturnType<typeof useToast>, summary: RunSummary) {
  const sourceLabel =
    summary.source === "llm"
      ? "Versant-grounded LLM"
      : summary.source === "fallback"
        ? "deterministic verdict composer"
        : null;
  if (summary.failed > 0) {
    toast.error({
      title: `Regenerate finished with ${summary.failed} error${summary.failed === 1 ? "" : "s"}`,
      description:
        (summary.warning ? `${summary.warning} ` : "") +
        `${summary.succeeded} capability succeeded; failed rows kept their previous AI guidance.`,
    });
    return;
  }
  const eligibleNote = summary.eligibleRows === 1 ? "is" : "are";
  const reviewNote = summary.needReviewRows === 1 ? "still needs" : "still need";
  const baseDescription =
    summary.needReviewRows === 0
      ? `All ${summary.succeeded} ${summary.eligibleRows === 1 ? "is" : "are"} now AI-eligible.`
      : `${summary.eligibleRows} ${eligibleNote} now AI-eligible. ${summary.needReviewRows} ${reviewNote} manual review (no AI candidates surfaced — see the placeholder rows for next steps).`;
  toast.success({
    title: `${summary.succeeded} capability rescored`,
    description:
      (sourceLabel ? `Sourced via ${sourceLabel}. ` : "") +
      baseDescription +
      (summary.warning ? ` ${summary.warning}` : ""),
    durationMs: 8000,
  });
}

/**
 * Secondary Step 4 action: re-run AI curation for all L4 Activity Group rows
 * that appear on AI Initiatives (modeled AI dial &gt; 0) with L5 Activities,
 * without requiring a new capability map upload. Lives below StaleCurationBanner,
 * above sub-tabs.
 */
export function RegenerateAiGuidanceToolbar({ towerId }: { towerId: TowerId }) {
  const toast = useToast();
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  // v6 — dial-bearing rows are L3 Job Families. Regenerable rows are
  // every L3 with `aiPct > 0` (effective dial after baseline fallback).
  // The L5-Activity gate doesn't apply at L3 grain — child L4 Activity
  // Groups are passed in as context to the LLM, not scored individually.
  const v6L3Rows = React.useMemo(
    () => program.towers[towerId]?.l3Rows ?? [],
    [program, towerId],
  );
  const l4Rows = React.useMemo(
    () => program.towers[towerId]?.l4Rows ?? [],
    [program, towerId],
  );
  const useV6 = IS_V6 && v6L3Rows.length > 0;

  const inFlight = useV6
    ? hasInFlightRows(v6L3Rows)
    : hasInFlightRows(l4Rows);

  const v6RegenerableRowIds = React.useMemo(() => {
    if (!useV6) return [] as string[];
    const t = program.towers[towerId];
    if (!t) return [];
    const baseline = t.baseline;
    // L3 Job Families need AI dial > 0 to be worth scoring AI Solutions
    // for. Offshore-only rows (no AI headroom) are skipped — the
    // Versant model has nothing to design against.
    return v6L3Rows
      .filter((r) => {
        const ai = r.aiImpactAssessmentPct ?? baseline.baselineAIPct;
        return ai > 0;
      })
      .map((r) => r.id);
  }, [useV6, program, towerId, v6L3Rows]);

  const v5RowIds = React.useMemo(
    () => regenerableRowsForStep4(program, towerId).rowIds,
    [program, towerId],
  );

  const rowIds = useV6 ? v6RegenerableRowIds : v5RowIds;
  const grainNoun = useV6 ? "Job Family" : "Activity Group";

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  // Streaming progress tracker: increments once per row as the curation
  // route emits its `done` / `failed` events. Drives the inline "Scoring
  // X of Y" status line below the button.
  const [progress, setProgress] = React.useState<{ scored: number; total: number }>(
    { scored: 0, total: 0 },
  );

  const impactLeversHref = getTowerHref(towerId, "impact-levers");

  const onRegenerateV5 = React.useCallback(async () => {
    const fresh = getAssessProgram();
    const { rows: freshRows } = regenerableRowsForStep4(fresh, towerId);
    if (freshRows.length === 0) {
      toast.error({
        title: "Nothing to regenerate",
        description:
          "No Activity Groups with AI dial above zero and L5 Activities. Open Configure Impact Levers to raise the dial.",
      });
      setConfirmOpen(false);
      return;
    }
    const plan = chunkRowsForCurationApi(freshRows);
    if (plan.oversizeRowIds.length > 0) {
      toast.error({
        title: "Some Activity Groups exceed the batch limit",
        description: `${plan.oversizeRowIds.length} Activity Group row(s) have more than 100 L5 Activities and cannot be rescored in one request. Shorten the L5 Activity list on Step 1 (Capability Map) or split the row.`,
      });
    }
    if (plan.batches.length === 0) {
      setConfirmOpen(false);
      return;
    }
    const totalRows = plan.batches.reduce((sum, b) => sum + b.length, 0);
    // Close the modal BEFORE the long-running LLM call so the user can
    // see the toolbar's "Scoring X/Y" progress chip + the AI Initiative
    // cards hydrating row-by-row behind it. Native <dialog> blurs
    // everything behind the backdrop, so leaving it open during the
    // 30-90s call hides every streaming signal we wired up.
    setConfirmOpen(false);
    setRunning(true);
    setProgress({ scored: 0, total: totalRows });
    const summaries: RunSummary[] = [];
    try {
      for (const batchIds of plan.batches) {
        const s = await runForRows({ towerId, rowIds: batchIds }, (p) => {
          if (p.stage === "done" || p.stage === "failed") {
            setProgress((prev) => ({
              scored: Math.min(prev.scored + 1, prev.total),
              total: prev.total,
            }));
          }
        });
        summaries.push(s);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      toast.error({
        title: "Couldn't regenerate AI guidance",
        description: error,
      });
      setRunning(false);
      setProgress({ scored: 0, total: 0 });
      return;
    }
    setRunning(false);
    setProgress({ scored: 0, total: 0 });
    const summary = aggregateRunSummaries(summaries);
    applyRegenerateToast(toast, summary);
  }, [toast, towerId]);

  /**
   * v6 sibling — drives the L3-grain pipeline (`runForL3Rows`) directly.
   * No batching layer: the per-L3 pipeline streams one row at a time,
   * and L3 rows-per-tower is small enough (~3-30) that a single
   * streaming request is the right granularity.
   */
  const onRegenerateV6 = React.useCallback(async () => {
    const fresh = getAssessProgram();
    const t = fresh.towers[towerId];
    if (!t || !t.l3Rows) {
      toast.error({
        title: "Nothing to regenerate",
        description: "L3 Job Family rows haven't derived yet. Re-import the capability map.",
      });
      setConfirmOpen(false);
      return;
    }
    const baseline = t.baseline;
    const ids = t.l3Rows
      .filter((r) => {
        const ai = r.aiImpactAssessmentPct ?? baseline.baselineAIPct;
        return ai > 0;
      })
      .map((r) => r.id);
    if (ids.length === 0) {
      toast.error({
        title: "Nothing to regenerate",
        description:
          "No Job Families with AI dial above zero. Open Configure Impact Levers to raise the dial.",
      });
      setConfirmOpen(false);
      return;
    }
    setConfirmOpen(false);
    setRunning(true);
    setProgress({ scored: 0, total: ids.length });
    let summary: RunV6Summary | undefined;
    try {
      summary = await runForL3Rows({ towerId, rowIds: ids }, (p) => {
        if (p.stage === "done" || p.stage === "failed") {
          setProgress((prev) => ({
            scored: Math.min(prev.scored + 1, prev.total),
            total: prev.total,
          }));
        }
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      toast.error({
        title: "Couldn't regenerate AI guidance",
        description: error,
      });
      setRunning(false);
      setProgress({ scored: 0, total: 0 });
      return;
    }
    setRunning(false);
    setProgress({ scored: 0, total: 0 });
    if (!summary) return;
    const sourceLabel =
      summary.source === "llm" || summary.source === "mixed"
        ? "Versant-grounded LLM"
        : summary.source === "fallback"
          ? "deterministic stub"
          : null;
    if (summary.failed > 0) {
      toast.error({
        title: `Regenerate finished with ${summary.failed} error${summary.failed === 1 ? "" : "s"}`,
        description:
          (summary.warning ? `${summary.warning} ` : "") +
          `${summary.succeeded} Job Famil${summary.succeeded === 1 ? "y" : "ies"} succeeded; failed rows kept their previous AI Solutions.`,
      });
      return;
    }
    toast.success({
      title: `${summary.succeeded} Job Famil${summary.succeeded === 1 ? "y" : "ies"} rescored`,
      description:
        (sourceLabel ? `Sourced via ${sourceLabel}. ` : "") +
        `${summary.succeeded} now carr${summary.succeeded === 1 ? "ies" : "y"} an updated AI Solutions list.` +
        (summary.warning ? ` ${summary.warning}` : ""),
      durationMs: 8000,
    });
  }, [toast, towerId]);

  const onRegenerate = React.useCallback(async () => {
    if (running || inFlight) return;
    if (useV6) return onRegenerateV6();
    return onRegenerateV5();
  }, [running, inFlight, useV6, onRegenerateV5, onRegenerateV6]);

  if (rowIds.length === 0) return null;

  const disabled = running || inFlight;

  const curateCopy = llmLoadingCopy("curate-initiatives");

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={disabled}
            title={
              inFlight
                ? "Curation in progress"
                : `Re-run Versant-grounded AI scoring for the eligible ${grainNoun}s (typically ${curateCopy.timeWindow} for a tower)`
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-accent-purple/50 bg-transparent px-4 py-2 text-sm font-semibold text-forge-body transition",
              "hover:border-accent-purple hover:bg-accent-purple/5 hover:text-forge-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent-purple" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4 text-accent-purple" aria-hidden />
            )}
            {running && progress.total > 0 && progress.scored > 0
              ? `Scoring ${progress.scored}/${progress.total}...`
              : "Regenerate AI guidance"}
          </button>
        </div>
        {running ? (
          <div
            className="flex max-w-md items-start gap-2 rounded-lg border border-accent-purple/30 bg-near-black/40 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent-purple" aria-hidden />
            <span className="min-w-0">
              {curationProgressLine(progress.scored, progress.total, grainNoun)}
            </span>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onRegenerate}
        title="Regenerate AI guidance for this tower?"
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        description={
          <div className="space-y-2 text-sm leading-relaxed text-forge-body">
            <p>
              This re-runs Versant-grounded AI {useV6 ? "Solution" : "eligibility and priority"} scoring
              for{" "}
              <span className="font-mono text-accent-purple-dark">{rowIds.length}</span>{" "}
              {grainNoun}
              {rowIds.length === 1 ? "" : "s"} where the AI dial is above zero
              {useV6 ? "" : " and L5 Activities exist"}. Cached{" "}
              {useV6 ? "AI Solutions" : "L5 verdicts"} for those rows are
              replaced.
            </p>
            <p>
              When the amber banner shows a capability map change, use{" "}
              <span className="font-semibold text-forge-ink">Refresh AI guidance</span>{" "}
              first. Regenerate skips {grainNoun}s at zero AI dial — open{" "}
              <Link
                href={impactLeversHref}
                className="font-semibold text-accent-purple-dark underline-offset-2 hover:underline"
              >
                Configure Impact Levers
              </Link>{" "}
              to raise the dial.
            </p>
          </div>
        }
      />
    </>
  );
}
