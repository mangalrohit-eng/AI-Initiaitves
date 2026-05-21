"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import { hasInFlightRows } from "@/lib/initiatives/curationHash";
import {
  clearManualInitiativesForTower,
  countAllManualInitiatives,
  countManualInitiativesForRows,
  runForL3Rows,
  unstickInterruptedCurationRows,
  type RunV6Summary,
} from "@/lib/assess/curationPipelineV6";
import { CURATE_L3_PROMPT_VERSION } from "@/lib/assess/curateL3InitiativesLLM";
import type {
  AssessProgramV2,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import type { TowerInitiativeMode } from "@/lib/initiatives/towerMode";
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
export function RegenerateAiGuidanceToolbar({
  towerId,
  initiativeMode = "empty",
}: {
  towerId: TowerId;
  /**
   * Source-exclusivity mode for the tower. When `"user-uploaded"`,
   * the Regenerate button is hard-greyed and a "Clear uploaded"
   * affordance is surfaced so the lead can switch into discovery
   * mode explicitly. Defaults to `"empty"` so the toolbar still
   * works when rendered outside the WorkshopToolsDrawer.
   */
  initiativeMode?: TowerInitiativeMode;
}) {
  const toast = useToast();
  const sync = useAssessSync();
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  // One-shot recovery on mount: clear any orphaned `running-*` rows from
  // a previous interrupted run (server crash, dev-server restart, tab
  // closed mid-stream). The boot-time migration in localStore.ts already
  // catches most cases; this belt-and-suspenders pass also handles the
  // intra-session case where a fetch failure left the persisted flag
  // behind. Idempotent.
  const [interruptedRecovered, setInterruptedRecovered] = React.useState(0);
  React.useEffect(() => {
    const { unstuck } = unstickInterruptedCurationRows(towerId);
    if (unstuck > 0) setInterruptedRecovered(unstuck);
  }, [towerId]);

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

  const manualInitiativeCount = React.useMemo(
    () => countManualInitiativesForRows(towerId, rowIds),
    [towerId, rowIds],
  );
  // Total manual cards on the tower (across every L3 row, not just
  // eligible ones). Used by the user-uploaded-mode banner so the
  // count there matches `UploadInitiativesPanel.manualCount`.
  const towerManualCount = React.useMemo(() => {
    void program;
    return countAllManualInitiatives(towerId);
  }, [program, towerId]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [clearUploadedOpen, setClearUploadedOpen] = React.useState(false);
  const [clearingUploaded, setClearingUploaded] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const modeBlocked = initiativeMode === "user-uploaded";
  // Streaming progress tracker: increments once per row as the curation
  // route emits its `done` / `failed` events. Drives the inline "Scoring
  // X of Y" status line below the button.
  const [progress, setProgress] = React.useState<{ scored: number; total: number }>(
    { scored: 0, total: 0 },
  );

  const impactLeversHref = getTowerHref(towerId, "impact-levers");

  const onClearUploaded = React.useCallback(async () => {
    setClearingUploaded(true);
    let removed = 0;
    try {
      removed = clearManualInitiativesForTower(towerId);
      if (sync?.flushSave) {
        try {
          await sync.flushSave();
        } catch {
          // best-effort; debounce will retry.
        }
      }
    } finally {
      setClearingUploaded(false);
      setClearUploadedOpen(false);
    }
    if (removed > 0) {
      toast.success({
        title: `${removed} uploaded card${removed === 1 ? "" : "s"} cleared`,
        description:
          "Tower is now empty. Click Regenerate AI guidance to discover a fresh slate from the LLM.",
        durationMs: 8000,
      });
    } else {
      toast.info({
        title: "Nothing to clear",
        description: "This tower has no uploaded initiatives.",
      });
    }
  }, [towerId, sync, toast]);

  const onRegenerate = React.useCallback(async () => {
    if (running || inFlight || modeBlocked) return;
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
  }, [running, inFlight, modeBlocked, toast, towerId]);

  if (rowIds.length === 0) return null;

  const disabled = running || inFlight || modeBlocked;

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
                : modeBlocked
                  ? `Disabled — tower has ${towerManualCount} uploaded card${towerManualCount === 1 ? "" : "s"}. Clear uploads first to switch into LLM-discovered mode.`
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
        {modeBlocked && !running ? (
          <div
            className="flex max-w-md items-start gap-2.5 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
            role="status"
          >
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-forge-ink">
                Regenerate disabled — tower is in user-uploaded mode
              </div>
              <div className="mt-0.5 text-forge-subtle">
                <span className="font-mono text-forge-body">{towerManualCount}</span>{" "}
                uploaded card{towerManualCount === 1 ? "" : "s"} on this tower.
                LLM-discovered and uploaded initiatives can&rsquo;t coexist —
                clear the uploads first to switch modes.
              </div>
              <button
                type="button"
                onClick={() => setClearUploadedOpen(true)}
                disabled={clearingUploaded}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-accent-amber/50 bg-accent-amber/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-amber transition hover:border-accent-amber hover:bg-accent-amber/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {clearingUploaded ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-3 w-3" aria-hidden />
                )}
                Clear uploaded
                <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-amber/20 px-1 font-mono text-[10px] text-accent-amber">
                  {towerManualCount}
                </span>
              </button>
            </div>
          </div>
        ) : null}
        {!running && interruptedRecovered > 0 ? (
          <div
            className="flex max-w-md items-start gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
            role="status"
            aria-live="polite"
          >
            <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-accent-amber/60 bg-accent-amber/20 font-mono text-[9px] font-bold text-accent-amber">
              i
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-forge-ink">
                A previous run was interrupted.
              </span>{" "}
              Cleared {interruptedRecovered} stuck Job Famil
              {interruptedRecovered === 1 ? "y" : "ies"} — Regenerate is ready
              again.
            </span>
            <button
              type="button"
              className="ml-2 shrink-0 font-mono text-[10px] uppercase tracking-wider text-forge-subtle hover:text-forge-ink"
              onClick={() => setInterruptedRecovered(0)}
            >
              dismiss
            </button>
          </div>
        ) : null}
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
            {manualInitiativeCount > 0 ? (
              <p className="rounded-lg border border-accent-teal/40 bg-accent-teal/5 px-3 py-2 text-xs text-forge-body">
                <span className="font-semibold text-accent-teal">
                  {manualInitiativeCount} uploaded initiative
                  {manualInitiativeCount === 1 ? "" : "s"}
                </span>{" "}
                on these Job Families will be preserved across the regenerate —
                only LLM-discovered cards are replaced.
              </p>
            ) : null}
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

      <ConfirmDialog
        open={clearUploadedOpen}
        onClose={() => setClearUploadedOpen(false)}
        onConfirm={onClearUploaded}
        title="Clear all uploaded initiatives on this tower?"
        confirmLabel="Clear uploaded"
        cancelLabel="Cancel"
        variant="destructive"
        busy={clearingUploaded}
        description={
          <div className="space-y-2 text-sm leading-relaxed text-forge-body">
            <p>
              This hard-deletes{" "}
              <span className="font-mono text-accent-red">{towerManualCount}</span>{" "}
              uploaded initiative{towerManualCount === 1 ? "" : "s"} across
              every Job Family on this tower, along with any approve/reject
              decisions on those cards.
            </p>
            <p className="text-xs text-forge-subtle">
              Use this to switch the tower into LLM-discovered mode. After
              clearing, click{" "}
              <span className="font-semibold text-forge-ink">
                Regenerate AI guidance
              </span>{" "}
              to populate a fresh slate from the LLM.
            </p>
          </div>
        }
      />
    </>
  );
}
