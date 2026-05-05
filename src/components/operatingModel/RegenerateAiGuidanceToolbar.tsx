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
  aggregateRunSummaries,
  chunkRowsForCurationApi,
  regenerableRowsForStep4,
} from "@/lib/assess/curationRegenerateBatch";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { getTowerHref } from "@/lib/towerHref";
import { cn } from "@/lib/utils";
import { curationProgressLine, llmLoadingCopy } from "@/lib/llm/loadingCopy";

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

  const rows = program.towers[towerId]?.l4Rows ?? [];
  const inFlight = hasInFlightRows(rows);
  const { rowIds } = regenerableRowsForStep4(program, towerId);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  // Streaming progress tracker: increments once per row as the curation
  // route emits its `done` / `failed` events. Drives the inline "Scoring
  // X of Y" status line below the button.
  const [progress, setProgress] = React.useState<{ scored: number; total: number }>(
    { scored: 0, total: 0 },
  );

  const impactLeversHref = getTowerHref(towerId, "impact-levers");

  const onRegenerate = React.useCallback(async () => {
    if (running || inFlight) return;
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
  }, [running, inFlight, toast, towerId]);

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
                : `Re-run Versant-grounded AI scoring for the eligible Activity Groups (typically ${curateCopy.timeWindow} for a tower)`
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
              {curationProgressLine(progress.scored, progress.total)}
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
              This re-runs Versant-grounded AI eligibility and priority scoring for{" "}
              <span className="font-mono text-accent-purple-dark">{rowIds.length}</span>{" "}
              Activity Groups where the AI dial is above zero and L5 Activities
              exist. Cached L5 verdicts for those rows are replaced.
            </p>
            <p>
              When the amber banner shows a capability map change, use{" "}
              <span className="font-semibold text-forge-ink">Refresh AI guidance</span>{" "}
              first. Regenerate skips Activity Groups at zero AI dial — open{" "}
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
