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
  runForL3Rows,
  type RunV6Summary,
} from "@/lib/assess/curationPipelineV6";
import { CURATE_L3_PROMPT_VERSION } from "@/lib/assess/curateL3InitiativesLLM";
import type {
  AssessProgramV2,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import { getTowerHref } from "@/lib/towerHref";
import { cn } from "@/lib/utils";
import { curationProgressLine, llmLoadingCopy } from "@/lib/llm/loadingCopy";

/**
 * Count L3 rows in this tower whose cached AI Solutions were authored
 * under an older prompt version than the current `CURATE_L3_PROMPT_VERSION`.
 * Used to surface a "AI naming was upgraded — refresh to apply" hint
 * directly on the Regenerate button so legacy cache (e.g. the old
 * brand-codename naming, or initiatives missing `iconKey`) doesn't
 * persist silently.
 */
function legacyPromptVersionRowCount(
  rows: ReadonlyArray<L3WorkforceRowV6>,
): number {
  let count = 0;
  for (const row of rows) {
    if (!row.l3Initiatives || row.l3Initiatives.length === 0) continue;
    const stale = row.l3Initiatives.some(
      (init) => init.promptVersion !== CURATE_L3_PROMPT_VERSION,
    );
    if (stale) count += 1;
  }
  return count;
}

/**
 * Secondary Step 4 action: re-run AI curation for all L3 Job Family rows
 * with AI dial > 0, without requiring a new capability map upload. Lives
 * below StaleCurationBanner, above sub-tabs.
 *
 * Drives the L3-grain pipeline (`runForL3Rows`) directly. No batching
 * layer: the per-L3 pipeline streams one row at a time, and L3
 * rows-per-tower is small enough (~3-30) that a single streaming request
 * is the right granularity.
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

  // Dial-bearing rows are L3 Job Families. Regenerable rows are every L3
  // with `aiPct > 0` (effective dial after baseline fallback). Child L4
  // Activity Groups are passed in as context to the LLM, not scored
  // individually.
  const v6L3Rows = React.useMemo(
    () => program.towers[towerId]?.l3Rows ?? [],
    [program, towerId],
  );

  const inFlight = hasInFlightRows(v6L3Rows);

  const rowIds = React.useMemo(() => {
    const t = program.towers[towerId];
    if (!t) return [] as string[];
    const baseline = t.baseline;
    return v6L3Rows
      .filter((r) => {
        const ai = r.aiImpactAssessmentPct ?? baseline.baselineAIPct;
        return ai > 0;
      })
      .map((r) => r.id);
  }, [program, towerId, v6L3Rows]);

  const legacyCount = React.useMemo(
    () => legacyPromptVersionRowCount(v6L3Rows),
    [v6L3Rows],
  );

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
    const t = fresh.towers[towerId];
    if (!t || !t.l3Rows) {
      toast.error({
        title: "Nothing to regenerate",
        description:
          "L3 Job Family rows haven't derived yet. Re-import the capability map.",
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
                : `Re-run Versant-grounded AI scoring for the eligible Job Families (typically ${curateCopy.timeWindow} for a tower)`
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
        {!running && legacyCount > 0 ? (
          <div
            className="flex max-w-md items-start gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
            role="note"
          >
            <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-accent-amber/60 bg-accent-amber/20 font-mono text-[9px] font-bold text-accent-amber">
              i
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-forge-ink">
                AI naming was upgraded.
              </span>{" "}
              {legacyCount} Job Famil{legacyCount === 1 ? "y" : "ies"} still
              hold AI Solutions written under the older prompt — refresh to
              apply the new descriptive titles and visual icons.
            </span>
          </div>
        ) : null}
        {running ? (
          <div
            className="flex max-w-md items-start gap-2 rounded-lg border border-accent-purple/30 bg-near-black/40 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent-purple" aria-hidden />
            <span className="min-w-0">
              {curationProgressLine(progress.scored, progress.total, "Job Family")}
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
              This re-runs Versant-grounded AI Solution scoring for{" "}
              <span className="font-mono text-accent-purple-dark">{rowIds.length}</span>{" "}
              Job Famil{rowIds.length === 1 ? "y" : "ies"} where the AI dial is
              above zero. Cached AI Solutions for those rows are replaced.
            </p>
            <p>
              When the amber banner shows a capability map change, use{" "}
              <span className="font-semibold text-forge-ink">Refresh AI guidance</span>{" "}
              first. Regenerate skips Job Families at zero AI dial — open{" "}
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
