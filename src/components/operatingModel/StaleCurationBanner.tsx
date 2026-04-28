"use client";

import * as React from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { getAssessProgram, subscribe } from "@/lib/localStore";
import {
  getTowerStaleState,
  hasInFlightRows,
} from "@/lib/initiatives/curationHash";
import {
  queuedRowIdsForTower,
  runForRows,
  type RunSummary,
} from "@/lib/assess/curationPipeline";
import { buildSeededAssessProgramV2 } from "@/data/assess/seedAssessProgram";
import { getTowerHref } from "@/lib/towerHref";
import type {
  AssessProgramV2,
  L3WorkforceRow,
  TowerId,
} from "@/data/assess/types";
import { cn } from "@/lib/utils";

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
 * Precondition guard: if any queued row has no L4 activities, the LLM has
 * nothing to score, so the banner switches modes and routes the user back
 * to Step 1's "Generate L4 activities" CTA instead of firing a request
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
    buildSeededAssessProgramV2(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const rows: ReadonlyArray<L3WorkforceRow> = React.useMemo(
    () => program.towers[towerId]?.l3Rows ?? [],
    [program, towerId],
  );

  const queued = React.useMemo(
    () => rows.filter((r) => r.curationStage === "queued"),
    [rows],
  );
  const inFlight = hasInFlightRows(rows);
  const stale = React.useMemo(
    () => getTowerStaleState(program.towers[towerId]),
    [program, towerId],
  );
  const visible = stale.initiativesStale;
  const missingL4ForRefresh = stale.missingL4ForRefresh;

  const [showDiff, setShowDiff] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    if (running) return;
    const { rowIds } = queuedRowIdsForTower(towerId);
    if (rowIds.length === 0) return;
    setRunning(true);
    let summary: RunSummary | undefined;
    try {
      summary = await runForRows({ towerId, rowIds });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      toast.error({
        title: "Couldn't refresh AI guidance",
        description: error,
      });
      setRunning(false);
      return;
    }
    setRunning(false);
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
  }, [running, toast, towerId]);

  if (!visible && !running) return null;

  const queuedCount = queued.length;
  const totalCount = rows.length;
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
              Capability map updated.{" "}
              <span className="font-mono text-accent-amber">
                {queuedCount}
              </span>{" "}
              of{" "}
              <span className="font-mono text-forge-body">{totalCount}</span>{" "}
              {queuedCount === 1 ? "capability has" : "capabilities have"} stale
              AI guidance.
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
            {missingL4ForRefresh
              ? "Some queued capabilities have no L4 activities yet. Generate L4 activities on Step 1 first, then come back to refresh AI guidance."
              : "Refresh runs the Versant-grounded LLM. If the LLM is unavailable, it falls back to the deterministic verdict composer + overlay rubric. Dollars and headcount on Steps 2 and 3 are unaffected."}
          </p>
        </div>
        {missingL4ForRefresh ? (
          <Link
            href={capabilityMapHref}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-accent-amber px-4 py-2 text-sm font-semibold text-near-black transition",
              "hover:bg-accent-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/50",
            )}
            title="Open Step 1 to generate L4 activities for the queued capabilities first."
          >
            <Icons.ListPlus className="h-4 w-4" />
            Generate L4 activities first
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={running || inFlight || queuedCount === 0}
            title={
              running || inFlight
                ? "Refresh in progress"
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
                Refreshing...
              </>
            ) : (
              <>
                <Icons.Sparkles className="h-4 w-4" />
                Refresh AI guidance for {queuedCount} capabilit
                {queuedCount === 1 ? "y" : "ies"}
              </>
            )}
          </button>
        )}
      </div>

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
            {queued.map((row) => (
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
                  {(row.l4Activities ?? []).length}{" "}
                  L4{(row.l4Activities ?? []).length === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
