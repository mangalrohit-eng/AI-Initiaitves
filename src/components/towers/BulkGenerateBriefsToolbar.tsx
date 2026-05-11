"use client";

import * as React from "react";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import {
  getAssessProgram,
  setTowerAssess,
  subscribe,
} from "@/lib/localStore";
import { clientCurateBrief } from "@/lib/assess/assessClientApi";
import { CURATE_BRIEF_PROMPT_VERSION } from "@/lib/assess/curateBriefLLM";
import { feasibilityFromGeneratedProcess } from "@/lib/assess/feasibilityFromSourcing";
import { buildTowerReadinessDigest } from "@/lib/assess/towerReadinessIntake";
import type {
  AssessProgramV2,
  L3Initiative,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import { cn } from "@/lib/utils";

/**
 * Bulk AI-Solution-brief generator.
 *
 * Lives inside `WorkshopToolsDrawer` on the `/tower/[slug]` page and
 * fires the same `clientCurateBrief` call as the per-initiative detail
 * page — one initiative at a time, sequentially, so the per-call LLM
 * timeout stays predictable and a transient failure doesn't poison the
 * whole batch.
 *
 * Three actions in the same toolbar:
 *   1. PRIMARY  — "Generate {N} missing briefs"  (only initiatives
 *                  with no `generatedProcess` cache yet).
 *   2. SECONDARY — "Refresh {K} stale briefs"     (only initiatives
 *                  whose cached prompt version doesn't match the
 *                  current `CURATE_BRIEF_PROMPT_VERSION`; covers the
 *                  legacy four-lens-only caches that need the new
 *                  six-section narrative.)
 *   3. SECONDARY — "Force regenerate all"          (every initiative,
 *                  irrespective of cache state.)
 *
 * Each action surfaces a confirm dialog before kicking off the
 * sequential run, a streaming progress chip during the run, and a
 * cancel button that stops the loop after the in-flight request
 * resolves (we never tear down a fetch mid-flight to avoid leaving
 * the workshop_assess Postgres row in an inconsistent state).
 */
export function BulkGenerateBriefsToolbar({
  towerId,
  /**
   * When true, render the most condensed presentation: drop the outer
   * card chrome, hide the inner "Generate AI Solution briefs in bulk"
   * title block (since the outer step shell already names this step),
   * and stack the action row directly under the summary line. The
   * action buttons, summary chip, progress strip, and confirm dialog
   * stay identical to the standalone presentation.
   */
  compact = false,
}: {
  towerId: TowerId;
  compact?: boolean;
}) {
  const toast = useToast();
  const sync = useAssessSync();
  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const summary = React.useMemo(() => summarizeForTower(program, towerId), [
    program,
    towerId,
  ]);

  // Sequential runner state.
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<{
    completed: number;
    total: number;
    current?: string;
  }>({ completed: 0, total: 0 });
  const cancelRef = React.useRef<boolean>(false);

  // Confirm dialog state — one shared dialog whose copy + handler swap
  // based on the active intent.
  type Intent = "missing" | "stale" | "force-all";
  const [confirmIntent, setConfirmIntent] = React.useState<Intent | null>(null);

  const runBatch = React.useCallback(
    async (intent: Intent) => {
      const fresh = getAssessProgram();
      const targets = pickTargetInitiatives(fresh, towerId, intent);
      if (targets.length === 0) {
        toast.error({
          title: "Nothing to generate",
          description:
            intent === "missing"
              ? "Every AI Solution in this tower already has a cached brief. Use 'Refresh stale' or 'Force regenerate all' to rebuild."
              : intent === "stale"
                ? "No briefs were authored under an older prompt — every cached brief is current."
                : "There are no AI Solutions on this tower yet. Run 'Regenerate AI guidance' first.",
        });
        return;
      }
      cancelRef.current = false;
      setRunning(true);
      setProgress({ completed: 0, total: targets.length });

      const digest = buildTowerReadinessDigest(
        fresh.towers[towerId]?.aiReadinessIntake,
      );

      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];
      for (let i = 0; i < targets.length; i += 1) {
        if (cancelRef.current) break;
        const t = targets[i]!;
        setProgress({
          completed: i,
          total: targets.length,
          current: t.solutionName,
        });
        try {
          const res = await clientCurateBrief({
            towerId,
            l2: t.l2,
            l3: t.l3,
            l4Name: t.solutionName,
            l4Id: t.initiativeId,
            aiRationale: t.aiRationale,
            ...(t.primaryVendor ? { primaryVendor: t.primaryVendor } : {}),
            ...(digest ? { towerIntakeDigest: digest } : {}),
          });
          if (!res.ok) {
            failed += 1;
            errors.push(`${t.solutionName}: ${res.error}`);
            continue;
          }
          // Read-modify-write off the latest snapshot so concurrent
          // mutations from the assess sync provider don't clobber.
          const snap = getAssessProgram().towers[towerId];
          if (!snap || !snap.l3Rows) {
            failed += 1;
            errors.push(`${t.solutionName}: tower state missing`);
            continue;
          }
          const stamped = feasibilityFromGeneratedProcess(
            res.result.generatedProcess,
          );
          setTowerAssess(towerId, {
            l3Rows: snap.l3Rows.map((r) =>
              r.id === t.rowId
                ? {
                    ...r,
                    l3Initiatives: (r.l3Initiatives ?? []).map((it) =>
                      it.id === t.initiativeId
                        ? {
                            ...it,
                            generatedProcess: res.result.generatedProcess,
                            ...(stamped ? { feasibility: stamped } : {}),
                          }
                        : it,
                    ),
                  }
                : r,
            ),
          });
          succeeded += 1;
        } catch (e) {
          failed += 1;
          errors.push(
            `${t.solutionName}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // Make sure the persistence pipeline flushes before the toast
      // claims the batch is "saved" — otherwise a flaky network on the
      // last entry leaves the toast stale.
      if (sync?.canSync) {
        try {
          await sync.flushSave();
        } catch {
          // best-effort; the flush will retry on its own cadence.
        }
      }

      setRunning(false);
      const cancelled = cancelRef.current;
      cancelRef.current = false;
      setProgress({ completed: 0, total: 0 });

      if (cancelled) {
        toast.info({
          title: "Bulk generation cancelled",
          description: `${succeeded} brief${succeeded === 1 ? "" : "s"} saved before cancel; ${
            targets.length - succeeded - failed
          } skipped.`,
        });
        return;
      }
      if (failed > 0) {
        toast.error({
          title: `Bulk generate finished with ${failed} error${failed === 1 ? "" : "s"}`,
          description:
            `${succeeded} brief${succeeded === 1 ? "" : "s"} saved. Failed: ` +
            errors.slice(0, 3).join(" | ") +
            (errors.length > 3 ? ` (+${errors.length - 3} more)` : ""),
        });
        return;
      }
      toast.success({
        title: `${succeeded} brief${succeeded === 1 ? "" : "s"} generated`,
        description:
          intent === "missing"
            ? "Every AI Solution on this tower now has a six-section brief."
            : intent === "stale"
              ? "Stale caches were refreshed under the current prompt version."
              : "Every brief on this tower was regenerated.",
        durationMs: 8000,
      });
    },
    [sync, toast, towerId],
  );

  if (!program) return null;
  if (summary.totalInitiatives === 0) return null;

  const disabled = running;

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-2",
          compact
            ? ""
            : "rounded-xl border border-forge-border bg-near-black/30 p-3 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        {compact ? (
          <div className="text-[11px] leading-relaxed text-forge-subtle">
            {summary.missingCount > 0 ? (
              <>
                <span className="font-mono text-forge-body">
                  {summary.missingCount}
                </span>{" "}
                missing
              </>
            ) : (
              <span className="text-forge-hint">All briefs cached</span>
            )}
            {summary.staleCount > 0 ? (
              <>
                {" · "}
                <span className="font-mono text-forge-body">
                  {summary.staleCount}
                </span>{" "}
                stale
              </>
            ) : null}
            {" · "}
            <span className="font-mono text-forge-body">
              {summary.totalInitiatives}
            </span>{" "}
            total
          </div>
        ) : (
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-forge-ink">
                Generate AI Solution briefs in bulk
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-forge-subtle">
                {summary.missingCount > 0 ? (
                  <>
                    <span className="font-mono text-forge-body">
                      {summary.missingCount}
                    </span>{" "}
                    missing
                  </>
                ) : (
                  <span className="text-forge-hint">All briefs cached</span>
                )}
                {summary.staleCount > 0 ? (
                  <>
                    {" · "}
                    <span className="font-mono text-forge-body">
                      {summary.staleCount}
                    </span>{" "}
                    stale
                  </>
                ) : null}
                {" · "}
                <span className="font-mono text-forge-body">
                  {summary.totalInitiatives}
                </span>{" "}
                total
              </div>
            </div>
          </div>
        )}
        <div className={cn("flex flex-wrap items-center gap-2", compact ? "justify-start" : "justify-end")}>
          <button
            type="button"
            onClick={() => setConfirmIntent("missing")}
            disabled={disabled || summary.missingCount === 0}
            title={
              summary.missingCount === 0
                ? "Every AI Solution already has a brief"
                : `Generate ${summary.missingCount} missing brief${summary.missingCount === 1 ? "" : "s"}`
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-accent-purple/50 bg-accent-purple/10 px-3 py-1.5 text-xs font-semibold text-accent-purple-light transition",
              "hover:border-accent-purple hover:bg-accent-purple/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            {running && progress.total > 0
              ? `Generating ${progress.completed}/${progress.total}…`
              : `Generate ${summary.missingCount} missing`}
          </button>
          {summary.staleCount > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmIntent("stale")}
              disabled={disabled}
              title={`Refresh ${summary.staleCount} brief${summary.staleCount === 1 ? "" : "s"} authored under an older prompt`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-near-black/40 px-2.5 py-1.5 text-[11px] font-medium text-forge-body transition",
                "hover:border-accent-purple/40 hover:text-forge-ink",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Refresh {summary.staleCount} stale
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirmIntent("force-all")}
            disabled={disabled}
            title="Regenerate every brief — replaces existing caches"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-near-black/40 px-2.5 py-1.5 text-[11px] font-medium text-forge-body transition",
              "hover:border-accent-amber/50 hover:text-accent-amber",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            Force regenerate all
          </button>
          {running ? (
            <button
              type="button"
              onClick={() => {
                cancelRef.current = true;
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-red/40 bg-accent-red/10 px-2.5 py-1.5 text-[11px] font-medium text-accent-red transition hover:bg-accent-red/20"
              title="Stop after the in-flight brief finishes"
            >
              <X className="h-3 w-3" aria-hidden />
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {running ? (
        <div
          className="mt-2 flex items-start gap-2 rounded-lg border border-accent-purple/30 bg-near-black/40 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent-purple-light"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="font-mono uppercase tracking-[0.14em] text-accent-purple-light">
              &gt; Generating
            </span>{" "}
            brief {progress.completed + 1} of {progress.total}
            {progress.current ? (
              <span className="text-forge-subtle"> · {progress.current}</span>
            ) : null}
            {". "}Cancellation will stop after the in-flight request finishes.
          </span>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmIntent !== null}
        onClose={() => setConfirmIntent(null)}
        onConfirm={async () => {
          if (!confirmIntent) return;
          const intent = confirmIntent;
          setConfirmIntent(null);
          await runBatch(intent);
        }}
        title={
          confirmIntent === "missing"
            ? `Generate ${summary.missingCount} missing brief${summary.missingCount === 1 ? "" : "s"}?`
            : confirmIntent === "stale"
              ? `Refresh ${summary.staleCount} stale brief${summary.staleCount === 1 ? "" : "s"}?`
              : "Regenerate every brief on this tower?"
        }
        confirmLabel={
          confirmIntent === "missing"
            ? "Generate"
            : confirmIntent === "stale"
              ? "Refresh"
              : "Regenerate all"
        }
        cancelLabel="Cancel"
        description={
          <div className="space-y-2 text-sm leading-relaxed text-forge-body">
            <p>
              Briefs run one at a time so per-call LLM timeouts stay predictable
              and a transient failure won&apos;t poison the whole batch. Typical
              wall-clock is{" "}
              <span className="font-mono text-accent-purple-dark">
                30–90 seconds per brief
              </span>
              .
            </p>
            <p>
              {confirmIntent === "missing"
                ? `Only AI Solutions without a cached brief will be generated. The ${summary.totalInitiatives - summary.missingCount} brief${summary.totalInitiatives - summary.missingCount === 1 ? "" : "s"} already cached will be left alone.`
                : confirmIntent === "stale"
                  ? `Only briefs authored under an older prompt version (${summary.staleCount}) will be refreshed. Current-version caches stay as-is.`
                  : `Every existing brief cache will be replaced. Only run this when the prompt or schema has changed in a way the stale-only refresh can't catch.`}
            </p>
            <p className="text-xs text-forge-subtle">
              You can cancel mid-batch — already-saved briefs persist.
            </p>
          </div>
        }
      />
    </>
  );
}

// ===========================================================================
//   Pure helpers
// ===========================================================================

type Target = {
  rowId: string;
  initiativeId: string;
  solutionName: string;
  l2: string;
  l3: string;
  aiRationale: string;
  primaryVendor?: string;
};

type Summary = {
  totalInitiatives: number;
  missingCount: number;
  staleCount: number;
};

function isStaleInitiative(init: L3Initiative): boolean {
  if (!init.generatedProcess) return false;
  if (init.generatedProcess.source !== "llm") return false;
  return init.generatedProcess.inference?.promptVersion !== CURATE_BRIEF_PROMPT_VERSION;
}

function summarizeForTower(
  program: AssessProgramV2 | null,
  towerId: TowerId,
): Summary {
  if (!program) {
    return { totalInitiatives: 0, missingCount: 0, staleCount: 0 };
  }
  const t = program.towers[towerId];
  const rows: ReadonlyArray<L3WorkforceRowV6> = t?.l3Rows ?? [];
  let total = 0;
  let missing = 0;
  let stale = 0;
  for (const row of rows) {
    for (const init of row.l3Initiatives ?? []) {
      total += 1;
      if (!init.generatedProcess?.process) {
        missing += 1;
      } else if (isStaleInitiative(init)) {
        stale += 1;
      }
    }
  }
  return { totalInitiatives: total, missingCount: missing, staleCount: stale };
}

function pickTargetInitiatives(
  program: AssessProgramV2,
  towerId: TowerId,
  intent: "missing" | "stale" | "force-all",
): Target[] {
  const t = program.towers[towerId];
  if (!t || !t.l3Rows) return [];
  const out: Target[] = [];
  for (const row of t.l3Rows) {
    for (const init of row.l3Initiatives ?? []) {
      if (intent === "missing" && init.generatedProcess?.process) continue;
      if (intent === "stale" && !isStaleInitiative(init)) continue;
      // intent === "force-all" — pass through
      out.push({
        rowId: row.id,
        initiativeId: init.id,
        solutionName: init.solutionName,
        l2: row.l2,
        l3: row.l3,
        aiRationale: init.aiRationale,
        ...(init.primaryVendor ? { primaryVendor: init.primaryVendor } : {}),
      });
    }
  }
  return out;
}

/**
 * Exported for the drawer header badge / auto-open trigger so both
 * pieces of UI stay in sync with a single source of truth.
 */
export function useBulkBriefSummary(towerId: TowerId): Summary {
  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => summarizeForTower(program, towerId), [
    program,
    towerId,
  ]);
}
