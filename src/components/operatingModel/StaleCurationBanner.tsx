"use client";

import * as React from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { getAssessProgram, getAssessProgramHydrationSnapshot, subscribe } from "@/lib/localStore";
import {
  getTowerStaleState,
  hasInFlightRows,
} from "@/lib/initiatives/curationHash";
import { shouldShowIntakeStaleBannerCopy } from "@/lib/assess/towerReadinessIntake";
import {
  queuedL3RowIdsForTowerV6,
  queuedRowIdsForTower,
  runForRows,
  type RunSummary,
} from "@/lib/assess/curationPipeline";
import {
  runForL3Rows,
  type RunV6Summary,
} from "@/lib/assess/curationPipelineV6";
import { getTowerHref } from "@/lib/towerHref";
import type {
  AssessProgramV2,
  L3WorkforceRow,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import { cn } from "@/lib/utils";
import { curationProgressLine, llmLoadingCopy } from "@/lib/llm/loadingCopy";
import { IS_V6 } from "@/lib/schemaFlag";

/**
 * Banner that surfaces above the AI Initiatives view (Step 4) whenever an
 * L3's content hash has changed since the last successful pipeline run. The
 * user clicks Refresh AI guidance and the curationPipeline orchestrator
 * fires ONE batched call to `/api/assess/curate-initiatives`. The route
 * runs the Versant-grounded LLM (when `OPENAI_API_KEY` is configured) and
 * falls back to the deterministic verdict composer + overlay rubric on any
 * LLM failure so the program never loses Step 4.
 *
 * Visible only when at least one row in the tower has `curationStage:
 * "queued"`. While a run is in flight, the CTA is disabled with a
 * "Refresh in progress" tooltip — prevents double-fires + race conditions.
 *
 * Precondition guard: if any queued row has no L5 Activities, the LLM has
 * nothing to score, so the banner switches modes and routes the user back
 * to Step 1's "Generate L5 Activities" CTA instead of firing a request
 * that's guaranteed to fail.
 */
export function StaleCurationBanner({
  towerId,
  hideTitle = false,
}: {
  towerId: TowerId;
  hideTitle?: boolean;
}) {
  const toast = useToast();
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const v6Rows: ReadonlyArray<L3WorkforceRowV6> = React.useMemo(
    () => program.towers[towerId]?.l3Rows ?? [],
    [program, towerId],
  );
  const v5Rows: ReadonlyArray<L3WorkforceRow> = React.useMemo(
    () => program.towers[towerId]?.l4Rows ?? [],
    [program, towerId],
  );
  const useV6 = IS_V6 && v6Rows.length > 0;
  const grainNoun = useV6 ? "Job Family" : "Activity Group";

  // Both row types carry the same `curationStage` semantics — the queued
  // list and in-flight predicate just point at whichever array is the
  // dial-bearing layer for the active schema.
  const queuedV6 = React.useMemo(
    () => v6Rows.filter((r) => r.curationStage === "queued"),
    [v6Rows],
  );
  const queuedV5 = React.useMemo(
    () => v5Rows.filter((r) => r.curationStage === "queued"),
    [v5Rows],
  );
  const inFlight = useV6 ? hasInFlightRows(v6Rows) : hasInFlightRows(v5Rows);
  const stale = React.useMemo(
    () => getTowerStaleState(program.towers[towerId]),
    [program, towerId],
  );
  const visible = stale.initiativesStale;
  // L5 Activity precondition only applies to v5 (L4-grain). Under v6 the
  // L3 carries no `l5Activities` field directly — child L4s do, but the
  // L3 curation pipeline pulls them from the row's `childL4RowIds` and
  // tolerates empty L5 lists for early-discovery rows.
  const missingL4ForRefresh = useV6 ? false : stale.missingL4ForRefresh;
  const intakeStaleCopy = shouldShowIntakeStaleBannerCopy(program.towers[towerId]);

  const [showDiff, setShowDiff] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  // Per-row progress while the streaming curation is in flight. `total` is
  // captured at fire-time from `queuedRowIdsForTower` so the banner can
  // render "Scored X of Y" the instant the first `done` event lands.
  const [progress, setProgress] = React.useState<{ scored: number; total: number }>(
    { scored: 0, total: 0 },
  );

  const onRefreshV5 = React.useCallback(async () => {
    const { rowIds } = queuedRowIdsForTower(towerId);
    if (rowIds.length === 0) return;
    setRunning(true);
    setProgress({ scored: 0, total: rowIds.length });
    let summary: RunSummary | undefined;
    try {
      summary = await runForRows({ towerId, rowIds }, (p) => {
        // The pipeline emits one `done` (or `failed`) event per row as the
        // streaming response lands. Both count toward "scored" — the user
        // only cares that this row is no longer pending.
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
        title: "Couldn't refresh AI guidance",
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
      summary.source === "llm"
        ? "Versant-grounded LLM"
        : summary.source === "fallback"
          ? "deterministic verdict composer"
          : null;
    if (summary.failed > 0) {
      toast.error({
        title: `Refresh finished with ${summary.failed} error${summary.failed === 1 ? "" : "s"}`,
        description:
          (summary.warning ? `${summary.warning} ` : "") +
          `${summary.succeeded} capability succeeded; the failed rows kept their previous AI guidance and remain in the queue.`,
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
      title: `${summary.succeeded} capability refreshed`,
      description:
        (sourceLabel ? `Sourced via ${sourceLabel}. ` : "") +
        baseDescription +
        (summary.warning ? ` ${summary.warning}` : ""),
      durationMs: 8000,
    });
  }, [toast, towerId]);

  /**
   * v6 sibling — fires the L3-grain pipeline (`runForL3Rows`) directly
   * for every queued L3 row. No batching layer; per-L3 rows-per-tower
   * is small (~3-30) so a single streaming call is the right grain.
   */
  const onRefreshV6 = React.useCallback(async () => {
    const { rowIds } = queuedL3RowIdsForTowerV6(towerId);
    if (rowIds.length === 0) return;
    setRunning(true);
    setProgress({ scored: 0, total: rowIds.length });
    let summary: RunV6Summary | undefined;
    try {
      summary = await runForL3Rows({ towerId, rowIds }, (p) => {
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
        title: "Couldn't refresh AI guidance",
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
        title: `Refresh finished with ${summary.failed} error${summary.failed === 1 ? "" : "s"}`,
        description:
          (summary.warning ? `${summary.warning} ` : "") +
          `${summary.succeeded} Job Famil${summary.succeeded === 1 ? "y" : "ies"} succeeded; the failed rows kept their previous AI Solutions and remain in the queue.`,
      });
      return;
    }
    toast.success({
      title: `${summary.succeeded} Job Famil${summary.succeeded === 1 ? "y" : "ies"} refreshed`,
      description:
        (sourceLabel ? `Sourced via ${sourceLabel}. ` : "") +
        `${summary.succeeded} now carr${summary.succeeded === 1 ? "ies" : "y"} an updated AI Solutions list.` +
        (summary.warning ? ` ${summary.warning}` : ""),
      durationMs: 8000,
    });
  }, [toast, towerId]);

  const onRefresh = React.useCallback(async () => {
    if (running) return;
    if (useV6) return onRefreshV6();
    return onRefreshV5();
  }, [running, useV6, onRefreshV5, onRefreshV6]);

  if (!visible && !running) return null;

  const queued = useV6 ? queuedV6 : queuedV5;
  const queuedCount = queued.length;
  const totalCount = useV6 ? v6Rows.length : v5Rows.length;
  const capabilityMapHref = getTowerHref(towerId, "capability-map");

  return (
    <section
      id="stale-curation-panel"
      className="rounded-2xl border border-accent-amber/45 bg-gradient-to-br from-accent-amber/12 via-accent-amber/5 to-transparent p-4 sm:p-5"
      aria-label="Capability map updated"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icons.RefreshCw
              className={cn(
                "h-4 w-4 text-accent-amber",
                running ? "animate-spin" : "",
              )}
              aria-hidden
            />
            <h3
              className={cn(
                "font-display text-base font-semibold text-forge-ink",
                hideTitle && "sr-only",
              )}
            >
              {intakeStaleCopy ? (
                <>
                  Tower AI readiness questionnaire updated.{" "}
                  <span className="font-mono text-accent-amber">{queuedCount}</span>{" "}
                  of <span className="font-mono text-forge-body">{totalCount}</span>{" "}
                  {queuedCount === 1 ? `${grainNoun} has` : `${grainNoun}s have`} stale
                  AI guidance.
                </>
              ) : (
                <>
                  Capability map updated.{" "}
                  <span className="font-mono text-accent-amber">{queuedCount}</span>{" "}
                  of <span className="font-mono text-forge-body">{totalCount}</span>{" "}
                  {queuedCount === 1 ? `${grainNoun} has` : `${grainNoun}s have`} stale
                  AI guidance.
                </>
              )}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
            {missingL4ForRefresh
              ? "Some queued Activity Groups have no L5 Activities yet. Generate L5 Activities on Step 1 first, then come back to refresh AI guidance."
              : useV6
                ? "Refresh runs the Versant-grounded LLM at the L3 Job Family grain — one stream, one pass through every queued row. If the LLM is unavailable, each row falls back to a deterministic Versant stub. Until you refresh, AI Solutions and feasibility (Proven pattern / New build) stay out of date for the queued rows. Dollars and headcount on Steps 2 and 3 are unaffected."
                : "Refresh runs the Versant-grounded LLM. If the LLM is unavailable, it falls back to the deterministic verdict composer + overlay rubric. Until you refresh, feasibility (Proven pattern / New build) and eligibility tags on the capability map stay out of date for the queued rows — and the cross-tower 2x2 will tier them off the older signal. Dollars and headcount on Steps 2 and 3 are unaffected."}
          </p>
        </div>
        {missingL4ForRefresh ? (
          <Link
            href={capabilityMapHref}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-accent-amber px-4 py-2 text-sm font-semibold text-near-black transition",
              "hover:bg-accent-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/50",
            )}
            title="Open Step 1 to generate L5 Activities for the queued Activity Groups first."
          >
            <Icons.ListPlus className="h-4 w-4" />
            Generate L5 Activities first
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={running || inFlight || queuedCount === 0}
            title={
              running || inFlight
                ? "Refresh in progress"
                : useV6
                  ? "Re-evaluates AI Solutions for the L3 Job Families whose child Activity Group list changed since the last refresh."
                  : "Re-evaluates AI eligibility for the L3s whose L4 list changed since the last refresh."
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-accent-amber px-4 py-2 text-sm font-semibold text-near-black transition",
              "hover:bg-accent-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/50",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {running || inFlight ? (
              <>
                <Icons.Loader2 className="h-4 w-4 animate-spin" />
                {progress.total > 0 && progress.scored > 0
                  ? `Scoring ${progress.scored}/${progress.total}...`
                  : llmLoadingCopy("curate-initiatives").buttonShort}
              </>
            ) : (
              <>
                <Icons.Sparkles className="h-4 w-4" />
                Refresh AI guidance for {queuedCount} {grainNoun}
                {queuedCount === 1 ? "" : "s"}
              </>
            )}
          </button>
        )}
      </div>

      {running ? (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-near-black/40 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
          role="status"
          aria-live="polite"
        >
            <Icons.Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent-amber" aria-hidden />
          <span className="min-w-0">
            {curationProgressLine(progress.scored, progress.total, grainNoun)}
          </span>
        </div>
      ) : null}

      {queuedCount > 0 ? (
        <details
          className="mt-3 group"
          open={showDiff}
          onToggle={(e) => setShowDiff((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none text-[11px] font-medium text-forge-body hover:text-accent-amber">
            <span className="inline-flex items-center gap-1">
              <span
                className="transition-transform group-open:rotate-90"
                aria-hidden
              >
                ›
              </span>
              Show what changed
            </span>
          </summary>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {useV6
              ? queuedV6.map((row) => {
                  const childCount = row.childL4RowIds.length;
                  return (
                    <li
                      key={row.id}
                      className="flex items-baseline justify-between gap-2 rounded-md border border-forge-border bg-forge-surface/70 px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="min-w-0 truncate text-forge-body">
                        <span className="text-forge-hint">{row.l2}</span>
                        <span className="mx-1 text-forge-hint">›</span>
                        <span className="font-medium text-forge-ink">{row.l3}</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                        {childCount} Activity Group{childCount === 1 ? "" : "s"}
                      </span>
                    </li>
                  );
                })
              : queuedV5.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-baseline justify-between gap-2 rounded-md border border-forge-border bg-forge-surface/70 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0 truncate text-forge-body">
                      <span className="text-forge-hint">{row.l2}</span>
                      <span className="mx-1 text-forge-hint">›</span>
                      <span className="font-medium text-forge-ink">{row.l3}</span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                      {(row.l5Activities ?? []).length}{" "}
                      L4{(row.l5Activities ?? []).length === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
