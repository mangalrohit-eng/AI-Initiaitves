"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock, Sparkles, Unlock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { Term } from "@/components/help/Term";
import { L4LeverRow } from "@/components/assess/L3LeverRow";
import { AssessmentScoreboard } from "@/components/assess/AssessmentScoreboard";
import { StaleDialsBanner } from "@/components/assess/StaleDialsBanner";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";
import { useGuidanceImpactLevers } from "@/lib/guidance/useJourneyGuidance";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useTowerAssessOps } from "@/lib/assess/useTowerAssessOps";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  clientInferTowerDefaults,
  type InferDefaultsSource,
} from "@/lib/assess/assessClientApi";
import { applyTowerStarterDefaults } from "@/data/assess/seedAssessmentDefaults";
import { rowStarterRationale } from "@/data/assess/rowRationale";
import {
  rowAnnualCost,
  weightedTowerLevers,
} from "@/lib/assess/scenarioModel";
import { getAssessProgram, setTowerAssess } from "@/lib/localStore";
import { getTowerStaleState } from "@/lib/initiatives/curationHash";
import type { L3WorkforceRow, TowerId } from "@/data/assess/types";
import { getTowerHref } from "@/lib/towerHref";
import { isCapabilityMapJourneyStepDone } from "@/lib/assess/capabilityMapStepStatus";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { TowerDataExports } from "@/components/assess/TowerDataExports";
import { towers } from "@/data/towers";
import { useRedactDollars } from "@/lib/clientMode";

type Props = { towerId: TowerId; towerName: string };

/**
 * Tower-scoped Configure Impact Levers page. Step 2 of the assessment:
 *
 *   - One slider card per L4 Activity Group (offshore + AI sliders, live
 *     modeled $). Tower leads dial impact at L4 Activity Group granularity
 *     — that's where the math runs in the 5-layer V5 capability map.
 *   - Top-of-page scoreboard (pool, weighted dials, modeled $).
 *   - Single tower-lead sign-off button to anchor the impact estimate summary.
 *
 * Reuses `useTowerAssessOps` so saves and toasts stay in lock-step with the
 * Capability Map sibling page.
 */
export function AssessmentTowerClient({ towerId, towerName }: Props) {
  const sync = useAssessSync();
  const toast = useToast();
  const ops = useTowerAssessOps(towerId, towerName);
  const redact = useRedactDollars();
  const {
    program,
    tState,
    rows,
    global,
    blanks,
    isComplete,
    doMarkComplete,
    doUnmarkComplete,
  } = ops;

  const completedModules: ReadonlyArray<"capability-map" | "impact-levers"> = (() => {
    const arr: Array<"capability-map" | "impact-levers"> = [];
    if (isCapabilityMapJourneyStepDone(tState)) arr.push("capability-map");
    if (isComplete) arr.push("impact-levers");
    return arr;
  })();

  /** Patch a single L4 Activity Group row by id. */
  const patchL3 = React.useCallback(
    (rowId: string, patch: Partial<L3WorkforceRow>) => {
      const cur = getAssessProgram().towers[towerId];
      if (!cur) return;
      setTowerAssess(towerId, {
        l4Rows: cur.l4Rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
        status: cur.status === "empty" ? "data" : cur.status,
      });
    },
    [towerId],
  );

  // Defaults inference (LLM-first, heuristic fallback).
  type ApplyDefaultsOutcome = {
    changedRows: number;
    changedCells: number;
    source: InferDefaultsSource;
    warning?: string;
  };

  const applyDefaults = React.useCallback(
    async (mode: "fillBlanks" | "overwriteAll"): Promise<ApplyDefaultsOutcome> => {
      if (!rows.length) throw new Error("Load a capability map & headcount first.");
      // Dials live on L4 (Activity Group). Send the full L2/L3/L4 path so
      // the LLM has both Job Family and Activity Group context.
      const apiInputs = rows.map((r) => ({
        l2: r.l2,
        l3: r.l3,
        l4: r.l4,
      }));
      const apiRes = await clientInferTowerDefaults(towerId, apiInputs);

      // `inferred` carries one tuple per row: the new dial values plus the
      // optional Versant-grounded rationales (LLM only). Heuristic and "wrong
      // length" fallbacks substitute the deterministic `rowStarterRationale`
      // text and tag the row with `dialsRationaleSource: "heuristic"` so the
      // L4LeverRow chip reads "heuristic" — never "AI-scored".
      let source: InferDefaultsSource;
      let warning: string | undefined;
      let inferred: {
        offshorePct: number;
        aiPct: number;
        offshoreRationale?: string;
        aiRationale?: string;
      }[];
      if (apiRes.ok && apiRes.result.defaults.length === rows.length) {
        source = apiRes.result.source;
        warning = apiRes.result.warning;
        inferred = apiRes.result.defaults;
      } else {
        source = "heuristic";
        warning = apiRes.ok
          ? "Server returned the wrong number of defaults; used local heuristic."
          : `Inference API unavailable (${apiRes.error}); used local heuristic.`;
        const local = applyTowerStarterDefaults(rows, towerId, "overwriteAll");
        inferred = local.rows.map((r) => ({
          offshorePct: r.offshoreAssessmentPct ?? 0,
          aiPct: r.aiImpactAssessmentPct ?? 0,
        }));
      }

      const nowIso = new Date().toISOString();
      const provenanceTag: "llm" | "heuristic" =
        source === "llm" ? "llm" : "heuristic";

      let changedCells = 0;
      let changedRows = 0;
      const nextRows = rows.map((r, i) => {
        const d = inferred[i];
        let nextOff = r.offshoreAssessmentPct;
        let nextAi = r.aiImpactAssessmentPct;
        let touched = false;
        if (mode === "overwriteAll" || nextOff == null) {
          if (nextOff !== d.offshorePct) {
            nextOff = d.offshorePct;
            changedCells += 1;
            touched = true;
          }
        }
        if (mode === "overwriteAll" || nextAi == null) {
          if (nextAi !== d.aiPct) {
            nextAi = d.aiPct;
            changedCells += 1;
            touched = true;
          }
        }

        // Resolve rationale text. Prefer the LLM strings; fall back to the
        // deterministic `rowStarterRationale` when they're missing (heuristic
        // path or LLM omission). A row's rationale pair is rewritten when
        // either dial is touched OR when the source is upgraded from
        // `undefined` / `"starter"` → `"llm"`/`"heuristic"`.
        const starter = rowStarterRationale(towerId, r);
        const offshoreRationale =
          d.offshoreRationale && d.offshoreRationale.trim()
            ? d.offshoreRationale.trim()
            : starter.offshore;
        const aiRationale =
          d.aiRationale && d.aiRationale.trim()
            ? d.aiRationale.trim()
            : starter.ai;
        const rationaleSourceChanged = r.dialsRationaleSource !== provenanceTag;

        if (touched) changedRows += 1;
        if (touched || rationaleSourceChanged) {
          return {
            ...r,
            offshoreAssessmentPct: nextOff,
            aiImpactAssessmentPct: nextAi,
            offshoreRationale,
            aiImpactRationale: aiRationale,
            dialsRationaleSource: provenanceTag,
            dialsRationaleAt: nowIso,
          };
        }
        return r;
      });

      if (mode === "fillBlanks" && changedCells === 0) {
        throw new Error("No blanks to fill — every row already has explicit values.");
      }

      const w = weightedTowerLevers(nextRows, tState.baseline, global);
      setTowerAssess(towerId, {
        l4Rows: nextRows,
        baseline: {
          baselineOffshorePct: Math.round(w.offshorePct),
          baselineAIPct: Math.round(w.aiPct),
        },
        status: tState.status === "empty" ? "data" : tState.status,
      });
      if (sync?.canSync) await sync.flushSave();
      return { changedRows, changedCells, source, warning };
    },
    [rows, towerId, tState.baseline, tState.status, global, sync],
  );

  const sourceLabel = (source: InferDefaultsSource) =>
    source === "llm" ? "AI inference" : "deterministic heuristic";

  const fillBlanksOp = useAsyncOp<ApplyDefaultsOutcome, []>({
    run: () => applyDefaults("fillBlanks"),
    messages: {
      loadingTitle: "Scoring blank L3 groups...",
      loadingDescription: "Trying AI inference, falling back to heuristic if unavailable.",
      successTitle: ({ changedCells, changedRows }) =>
        `Filled ${changedCells} cell${changedCells === 1 ? "" : "s"} across ${changedRows} row${changedRows === 1 ? "" : "s"}`,
      successDescription: ({ source, warning }) =>
        warning
          ? `${warning} Filled blanks only.`
          : `Sourced via ${sourceLabel(source)}. Dialed at L3 — existing explicit values were preserved.`,
      errorTitle: "Couldn't apply defaults",
    },
  });

  const overwriteAllOp = useAsyncOp<ApplyDefaultsOutcome, []>({
    run: () => applyDefaults("overwriteAll"),
    messages: {
      loadingTitle: "Re-scoring every L4 Activity Group...",
      loadingDescription: "Trying AI inference, falling back to heuristic if unavailable.",
      successTitle: ({ changedRows, changedCells }) =>
        `Re-seeded ${changedRows} row${changedRows === 1 ? "" : "s"} (${changedCells} cell${changedCells === 1 ? "" : "s"})`,
      successDescription: ({ source, warning }) =>
        warning
          ? `${warning} All explicit overrides were replaced.`
          : `Sourced via ${sourceLabel(source)}. Dialed at L3 — all explicit overrides were replaced.`,
      errorTitle: "Couldn't re-apply defaults",
    },
  });

  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState(false);
  const [confirmUnmarkOpen, setConfirmUnmarkOpen] = React.useState(false);
  const [reseedDialogOpen, setReseedDialogOpen] = React.useState(false);
  const [completeBusy, setCompleteBusy] = React.useState(false);

  const handleMarkComplete = async () => {
    setCompleteBusy(true);
    try {
      const ok = await doMarkComplete();
      if (ok) setConfirmCompleteOpen(false);
    } finally {
      setCompleteBusy(false);
    }
  };

  const handleUnmarkComplete = async () => {
    setCompleteBusy(true);
    try {
      await doUnmarkComplete();
      setConfirmUnmarkOpen(false);
    } finally {
      setCompleteBusy(false);
    }
  };

  // Reset both overrides on a single L4 Activity Group row back to the tower baseline.
  const resetOverridesForRow = (row: L3WorkforceRow) => {
    patchL3(row.id, {
      offshoreAssessmentPct: undefined,
      aiImpactAssessmentPct: undefined,
    });
    toast.info({ title: `${row.l3} overrides cleared` });
  };

  const noFootprint = rows.length === 0;
  const totalPool = rows.reduce((s, r) => s + rowAnnualCost(r, global), 0);
  // Single source of truth for the staleness banners. After a tower-lead
  // upload, every row arrives with `dialsRationaleSource: undefined` and
  // `dialsStale` returns true. Sample-loaded rows carry "starter" provenance
  // and are therefore NOT flagged as stale, so the banner doesn't fire on
  // the seeded program.
  const staleState = getTowerStaleState(tState);
  const impactGuidance = useGuidanceImpactLevers(towerId, towerName);
  const towerVm = towers.find((t) => t.id === towerId);

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Impact Levers", href: "/impact-levers" },
            { label: towerName },
          ]}
        />

        <TowerJourneyStepper
          className="mt-3"
          towerId={towerId}
          towerName={towerName}
          current="impact-levers"
          completed={completedModules}
        />

        {towerVm ? <TowerDataExports tower={towerVm} className="mt-3" /> : null}

        <ScreenGuidanceBar guidance={impactGuidance} className="mt-3" />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-forge-ink">
              &gt; {towerName} · Configure Impact Levers
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forge-body">
              Dial <Term termKey="offshore dial">offshore</Term> and{" "}
              <Term termKey="ai impact dial">AI impact</Term> per L4 Activity Group.
              The impact updates live against each Activity Group&apos;s annual pool.
            </p>
          </div>
          <Link
            href={getTowerHref(towerId, "capability-map")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body hover:border-accent-purple/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Capability Map
          </Link>
        </div>

        {noFootprint ? (
          <div className="mt-6 rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-8 text-center">
            <p className="text-sm font-medium text-forge-body">
              No capability map &amp; headcount loaded for {towerName} yet.
            </p>
            <p className="mt-1 text-xs text-forge-subtle">
              Upload (or load a sample of) the capability map &amp; headcount on the Capability Map page first.
            </p>
            <Link
              href={getTowerHref(towerId, "capability-map")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
            >
              Open Capability Map
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            {staleState.dialsStale ? (
              <div className="mt-5">
                <StaleDialsBanner
                  totalRows={rows.length}
                  rescoring={overwriteAllOp.state === "loading"}
                  onRescore={() => setReseedDialogOpen(true)}
                  hideTitle
                />
              </div>
            ) : null}
            <div className="mt-5">
              <AssessmentScoreboard
                variant="tower"
                program={program}
                towerId={towerId}
                rows={rows}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-forge-border bg-forge-surface/60 p-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {blanks.totalBlanks > 0 ? (
                  <button
                    type="button"
                    onClick={() => void fillBlanksOp.fire()}
                    disabled={fillBlanksOp.state === "loading"}
                    className="inline-flex items-center gap-1 rounded-md bg-accent-purple px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-purple-dark disabled:opacity-60"
                  >
                    <Sparkles className="h-3 w-3" />
                    {fillBlanksOp.state === "loading"
                      ? "Scoring..."
                      : `Fill ${blanks.totalBlanks} blank${blanks.totalBlanks === 1 ? "" : "s"}`}
                  </button>
                ) : (
                  <span className="text-forge-hint">No blanks</span>
                )}
                <button
                  type="button"
                  onClick={() => setReseedDialogOpen(true)}
                  disabled={overwriteAllOp.state === "loading"}
                  className="rounded-md border border-forge-border px-2.5 py-1 text-xs text-forge-body hover:border-accent-purple/30 disabled:opacity-60"
                  title="Re-score every Activity Group from scratch (replaces explicit overrides)"
                >
                  {overwriteAllOp.state === "loading" ? "Re-scoring..." : "Re-score every Activity Group"}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="group">
                  <L4LeverRow
                    row={r}
                    towerId={towerId}
                    baseline={tState.baseline}
                    global={global}
                    onPatch={(patch) => patchL3(r.id, patch)}
                  />
                  <div className="mt-1 hidden text-right text-[10px] text-forge-hint group-hover:block">
                    <button
                      type="button"
                      onClick={() => resetOverridesForRow(r)}
                      className="underline-offset-2 hover:text-forge-subtle hover:underline"
                    >
                      Clear both overrides on this Activity Group
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-forge-hint">
              <span>
                Adjust global blended $ on the{" "}
                <Link href="/impact-levers/summary" className="text-forge-body underline">
                  impact estimate
                </Link>{" "}
                to change pool math across all towers.
              </span>
              <span className="font-mono">
                {redact ? (
                  <>tower pool —</>
                ) : (
                  <>tower pool ${totalPool.toLocaleString("en-US", { maximumFractionDigits: 0 })}</>
                )}
              </span>
            </div>

            <div className="mt-10">
              <TowerLeadSignoff
                towerName={towerName}
                isComplete={isComplete}
                hasRows={rows.length > 0}
                reviewedAt={
                  isComplete
                    ? tState.aiConfirmedAt ??
                      tState.offshoreConfirmedAt ??
                      tState.headcountConfirmedAt ??
                      tState.lastUpdated
                    : undefined
                }
                onMarkComplete={() => setConfirmCompleteOpen(true)}
                onUnmarkComplete={() => setConfirmUnmarkOpen(true)}
              />
            </div>

            {isComplete ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
                <div>
                  <p className="font-display text-base font-semibold text-forge-ink">
                    Tower reviewed — open the AI agenda next.
                  </p>
                  <p className="mt-1 text-sm text-forge-body">
                    See the sequenced AI initiatives, agent architectures, and 4-lens detail for {towerName}.
                  </p>
                </div>
                <Link
                  href={getTowerHref(towerId, "ai-initiatives")}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
                >
                  Open in AI Initiatives
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <p className="mt-8 text-xs text-forge-hint">
                <Link
                  href={getTowerHref(towerId, "ai-initiatives")}
                  className="text-forge-body underline"
                >
                  Open {towerName} in AI Initiatives
                </Link>
                {" — "}
                (the handoff CTA appears once this tower is reviewed by the tower lead).
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={reseedDialogOpen}
        onClose={() => setReseedDialogOpen(false)}
        onConfirm={async () => {
          setReseedDialogOpen(false);
          await overwriteAllOp.fire();
        }}
        title={`Re-apply starter defaults to every L4 Activity Group in ${towerName}?`}
        description={
          <>
            Every Activity Group&apos;s offshore% and AI% will be replaced. Explicit overrides will be lost.
          </>
        }
        confirmLabel="Yes, replace"
        cancelLabel="Cancel"
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmCompleteOpen}
        onClose={() => setConfirmCompleteOpen(false)}
        onConfirm={() => handleMarkComplete()}
        title={`Sign ${towerName} off as reviewed?`}
        description={
          <>
            We&apos;ll lock the baseline at the current cost-weighted roll-up and anchor this tower in the scenario summary. You can reopen for review anytime.
          </>
        }
        confirmLabel="Mark reviewed"
        variant="lock"
        busy={completeBusy}
      />

      <ConfirmDialog
        open={confirmUnmarkOpen}
        onClose={() => setConfirmUnmarkOpen(false)}
        onConfirm={() => handleUnmarkComplete()}
        title={`Reopen ${towerName} for review?`}
        description={
          <>
            The tower returns to awaiting tower lead sign-off. Your data and all explicit reviews are kept.
          </>
        }
        confirmLabel="Reopen"
        variant="default"
        busy={completeBusy}
      />
    </PageShell>
  );
}

/**
 * Single-button tower-lead sign-off card. Replaces the older 4-step checklist —
 * the only signal we actually need is "the tower lead has reviewed and tuned
 * the impact levers for this tower." That stamps `headcountConfirmedAt`,
 * `offshoreConfirmedAt`, `aiConfirmedAt` (via `doMarkComplete`) and flips the
 * tower to `status: "complete"` so it anchors the Impact Estimate roll-up.
 */
function TowerLeadSignoff({
  towerName,
  isComplete,
  hasRows,
  reviewedAt,
  onMarkComplete,
  onUnmarkComplete,
}: {
  towerName: string;
  isComplete: boolean;
  hasRows: boolean;
  reviewedAt?: string;
  onMarkComplete: () => void;
  onUnmarkComplete: () => void;
}) {
  const fmt = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  };

  return (
    <section
      id="tower-lead-signoff"
      aria-label="Tower lead sign-off"
      className={
        "rounded-2xl border p-5 transition " +
        (isComplete
          ? "border-accent-green/30 bg-accent-green/5"
          : "border-accent-purple/30 bg-accent-purple/5")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold text-forge-ink">
              Tower lead sign-off
            </h2>
            {isComplete ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/40 bg-accent-green/10 px-2 py-0.5 text-[11px] font-medium text-accent-green">
                <Check className="h-3 w-3" />
                Reviewed
                {fmt(reviewedAt) ? (
                  <span className="font-mono text-[10px] text-accent-green/80">
                    · {fmt(reviewedAt)}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-2 py-0.5 text-[11px] font-medium text-accent-amber">
                Pending tower lead review
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-forge-body">
            {isComplete
              ? `${towerName} is anchored in the impact estimate. Reopen anytime if the offshore or AI dials need to change.`
              : `Once you've reviewed and adjusted the offshore and AI dials per L4 Activity Group for ${towerName}, mark the tower reviewed. The impact estimate locks your roll-up and the AI Initiatives handoff appears below.`}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center">
          {!isComplete ? (
            <button
              type="button"
              onClick={onMarkComplete}
              disabled={!hasRows}
              title={
                !hasRows
                  ? "Load the sample or upload a capability map & headcount first."
                  : "Sign this tower off as reviewed and unlock the AI Initiatives handoff."
              }
              className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              Mark reviewed
            </button>
          ) : (
            <button
              type="button"
              onClick={onUnmarkComplete}
              className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-4 py-2 text-sm font-medium text-forge-body transition hover:border-forge-border-strong"
            >
              <Unlock className="h-4 w-4" />
              Reopen for review
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
