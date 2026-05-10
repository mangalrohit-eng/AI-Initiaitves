"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { getAssessProgram, getAssessProgramHydrationSnapshot, subscribe } from "@/lib/localStore";
import {
  getTowerStaleState,
  hasInFlightRows,
} from "@/lib/initiatives/curationHash";
import { shouldShowIntakeStaleBannerCopy } from "@/lib/assess/towerReadinessIntake";
import {
  queuedL3RowIdsForTower,
  runForL3Rows,
  type RunV6Summary,
} from "@/lib/assess/curationPipelineV6";
import type {
  AssessProgramV2,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import { cn } from "@/lib/utils";
import { curationProgressLine, llmLoadingCopy } from "@/lib/llm/loadingCopy";

/**
 * Banner that surfaces above the AI Initiatives view (Step 4) whenever an
 * L3 Job Family's content hash has changed since the last successful
 * pipeline run. The user clicks Refresh AI guidance and the
 * `curationPipelineV6` orchestrator fires a streaming call to
 * `/api/assess/curate-l3-initiatives`. The route runs the Versant-grounded
 * LLM (when `OPENAI_API_KEY` is configured) and falls back to a
 * deterministic Versant stub on any LLM failure so the program never loses
 * Step 4.
 *
 * Visible only when at least one row in the tower has `curationStage:
 * "queued"`. While a run is in flight, the CTA is disabled with a
 * "Refresh in progress" tooltip — prevents double-fires + race conditions.
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

  const queuedV6 = React.useMemo(
    () => v6Rows.filter((r) => r.curationStage === "queued"),
    [v6Rows],
  );
  const inFlight = hasInFlightRows(v6Rows);
  const stale = React.useMemo(
    () => getTowerStaleState(program.towers[towerId]),
    [program, towerId],
  );
  const visible = stale.initiativesStale;
  const intakeStaleCopy = shouldShowIntakeStaleBannerCopy(program.towers[towerId]);

  const [showDiff, setShowDiff] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  // Per-row progress while the streaming curation is in flight. `total` is
  // captured at fire-time so the banner can render "Scored X of Y" the
  // instant the first `done` event lands.
  const [progress, setProgress] = React.useState<{ scored: number; total: number }>(
    { scored: 0, total: 0 },
  );

  /**
   * Fires the L3-grain pipeline (`runForL3Rows`) directly for every queued
   * L3 row. No batching layer; per-L3 rows-per-tower is small (~3-30) so a
   * single streaming call is the right grain.
   */
  const onRefresh = React.useCallback(async () => {
    if (running) return;
    const { rowIds } = queuedL3RowIdsForTower(towerId);
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
  }, [running, toast, towerId]);

  if (!visible && !running) return null;

  const queuedCount = queuedV6.length;
  const totalCount = v6Rows.length;

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
                  {queuedCount === 1 ? "Job Family has" : "Job Families have"} stale
                  AI guidance.
                </>
              ) : (
                <>
                  Capability map updated.{" "}
                  <span className="font-mono text-accent-amber">{queuedCount}</span>{" "}
                  of <span className="font-mono text-forge-body">{totalCount}</span>{" "}
                  {queuedCount === 1 ? "Job Family has" : "Job Families have"} stale
                  AI guidance.
                </>
              )}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
            Refresh runs the Versant-grounded LLM at the L3 Job Family
            grain — one stream, one pass through every queued row. If the
            LLM is unavailable, each row falls back to a deterministic
            Versant stub. Until you refresh, AI Solutions and feasibility
            (Proven pattern / New build) stay out of date for the queued
            rows. Dollars and headcount on Steps 2 and 3 are unaffected.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={running || inFlight || queuedCount === 0}
          title={
            running || inFlight
              ? "Refresh in progress"
              : "Re-evaluates AI Solutions for the L3 Job Families whose child Activity Group list changed since the last refresh."
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
              Refresh AI guidance for {queuedCount} Job Famil
              {queuedCount === 1 ? "y" : "ies"}
            </>
          )}
        </button>
      </div>

      {running ? (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-near-black/40 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
          role="status"
          aria-live="polite"
        >
          <Icons.Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent-amber" aria-hidden />
          <span className="min-w-0">
            {curationProgressLine(progress.scored, progress.total, "Job Family")}
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
            {queuedV6.map((row) => {
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
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
