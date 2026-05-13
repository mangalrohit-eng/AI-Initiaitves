"use client";

/**
 * V6 L3-grain AI Solution deep-dive.
 *
 * Route: `/tower/[slug]/initiative/[rowId]/[initiativeId]`
 *   - `slug`         → Tower id (e.g. "finance").
 *   - `rowId`        → `L3WorkforceRowV6.id` — the dial-bearing Job Family row.
 *   - `initiativeId` → `L3Initiative.id` — the specific AI Solution product.
 *
 * Mirrors the v5 LLMBriefPage four-lens experience but reads from V6 data:
 *   - L3 row context (l1 Function, l2 Job Grouping, l3 Job Family, child L4 names)
 *   - L3Initiative metadata (solutionName, tagline, aiRationale, primaryVendor,
 *     feasibility, coversL4RowIds)
 *   - Lazy-cached `L3Initiative.generatedProcess` for the four-lens detail
 *
 * Persistence: the generated full Process is stamped onto
 * `L3Initiative.generatedProcess` and round-trips through `localStore` →
 * `/api/assess` PUT → `assess_workshop`. The single-tower-scope guard
 * naturally allows it because only the active tower's `l3Rows` mutate.
 */

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { towers } from "@/data/towers";
import {
  getAssessProgram,
  setTowerAssess,
  subscribe,
} from "@/lib/localStore";
import { clientCurateBrief } from "@/lib/assess/assessClientApi";
import {
  buildTowerReadinessDigest,
  intakeHasMinimumSubstance,
  TOWER_READINESS_ATTRIBUTION_LABEL,
} from "@/lib/assess/towerReadinessIntake";
import { CURATE_BRIEF_PROMPT_VERSION } from "@/lib/assess/curateBriefLLM";
import {
  effectiveInitiativeFeasibility,
  feasibilityFromGeneratedProcess,
} from "@/lib/assess/feasibilityFromSourcing";
import { ProcessMetrics } from "@/components/processes/ProcessMetrics";
import { BusinessCase } from "@/components/processes/BusinessCase";
import { SolutionBriefView } from "@/components/initiatives/SolutionBriefView";
import { SolutionIcon } from "@/components/towers/SolutionIcon";
import { feasibilityChip } from "@/lib/feasibilityChip";
import type {
  AssessProgramV2,
  L3Initiative,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import type { Process } from "@/data/types";

type Params = { slug: string; rowId: string; initiativeId: string };

export default function V6InitiativePage() {
  const params = useParams<Params>();
  const router = useRouter();
  const toast = useToast();
  const sync = useAssessSync();

  const slug = decodeURIComponent(params.slug);
  const rowId = decodeURIComponent(params.rowId);
  const initiativeId = decodeURIComponent(params.initiativeId);

  const tower = towers.find((t) => t.id === slug);

  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const towerState = tower ? program?.towers[tower.id as TowerId] : undefined;
  const row: L3WorkforceRowV6 | undefined = towerState?.l3Rows?.find(
    (r) => r.id === rowId,
  );
  const initiative: L3Initiative | undefined = row?.l3Initiatives?.find(
    (i) => i.id === initiativeId,
  );

  const childL4Names = React.useMemo(() => {
    if (!row || !towerState) return [];
    const byId = new Map(towerState.l4Rows.map((r) => [r.id, r.l4]));
    return row.childL4RowIds
      .map((id) => byId.get(id))
      .filter((s): s is string => !!s);
  }, [row, towerState]);

  const coveredL4Names = React.useMemo(() => {
    if (!initiative || !towerState) return [];
    if (!initiative.coversL4RowIds || initiative.coversL4RowIds.length === 0) {
      return childL4Names;
    }
    const byId = new Map(towerState.l4Rows.map((r) => [r.id, r.l4]));
    return initiative.coversL4RowIds
      .map((id) => byId.get(id))
      .filter((s): s is string => !!s);
  }, [initiative, towerState, childL4Names]);

  const hasFullCache = Boolean(initiative?.generatedProcess?.process);

  const [generating, setGenerating] = React.useState(false);
  const [warning, setWarning] = React.useState<string | undefined>(undefined);
  const [generationError, setGenerationError] = React.useState<
    string | undefined
  >(undefined);

  const resolvedProcess: Process | null = React.useMemo(() => {
    if (!initiative?.generatedProcess?.process) return null;
    return initiative.generatedProcess.process;
  }, [initiative]);

  /**
   * Fire the curate-brief LLM call. The endpoint accepts L4-grain input
   * (its wire shape pre-dates v6) but the LLM prompt is generic enough
   * to brief any AI Solution given a domain (l3) and a label (l4Name).
   * We pass the AI Solution name as `l4Name`, the initiative id as
   * `l4Id`, and leave `l4` undefined since v6 initiatives span 1..N
   * Activity Groups rather than sitting under a single one.
   */
  const fireGeneration = React.useCallback(async () => {
    if (!tower || !row || !initiative) return;
    if (generating) return;
    setGenerating(true);
    setWarning(undefined);
    setGenerationError(undefined);
    const towerId = tower.id as TowerId;
    const digest = buildTowerReadinessDigest(
      getAssessProgram().towers[towerId]?.aiReadinessIntake,
    );
    const res = await clientCurateBrief({
      towerId,
      l2: row.l2,
      l3: row.l3,
      l4Name: initiative.solutionName,
      l4Id: initiative.id,
      aiRationale: initiative.aiRationale,
      ...(initiative.primaryVendor
        ? { primaryVendor: initiative.primaryVendor }
        : {}),
      ...(digest ? { towerIntakeDigest: digest } : {}),
    });
    setGenerating(false);
    if (!res.ok) {
      setGenerationError(res.error);
      toast.error({
        title: "Could not generate initiative",
        description: res.error,
      });
      return;
    }
    setWarning(res.result.warning);
    const fresh = getAssessProgram().towers[towerId];
    if (!fresh || !fresh.l3Rows) return;
    const stamped = feasibilityFromGeneratedProcess(res.result.generatedProcess);
    setTowerAssess(towerId, {
      l3Rows: fresh.l3Rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              l3Initiatives: (r.l3Initiatives ?? []).map((it) =>
                it.id === initiativeId
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
    if (sync?.canSync) await sync.flushSave();
  }, [
    tower,
    row,
    initiative,
    generating,
    rowId,
    initiativeId,
    sync,
    toast,
  ]);

  React.useEffect(() => {
    if (!tower || !row || !initiative) return;
    if (hasFullCache) return;
    if (generating) return;
    void fireGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tower?.id, row?.id, initiative?.id, hasFullCache]);

  if (program === null) {
    return (
      <PageShell>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <LoadingState message="Loading tower data..." />
        </div>
      </PageShell>
    );
  }

  if (!tower) {
    return (
      <PageShell>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Initiative" }]}
          />
          <div className="mt-6 rounded-2xl border border-forge-border bg-forge-surface p-8">
            <p className="font-display text-base font-semibold text-forge-ink">
              Tower not found.
            </p>
            <p className="mt-1 text-xs text-forge-subtle">
              The URL references a tower slug ({slug}) that no longer exists.
            </p>
            <Link
              href="/towers"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to towers
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!row || !initiative) {
    return (
      <PageShell>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: tower.name, href: `/tower/${tower.id}` },
              { label: "Initiative" },
            ]}
          />
          <div className="mt-6 rounded-2xl border border-forge-border bg-forge-surface p-8">
            <p className="font-display text-base font-semibold text-forge-ink">
              This initiative is no longer available.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
              The capability map or AI Initiatives list was refreshed since this
              URL was generated. Re-open the initiative from the tower page.
            </p>
            <Link
              href={`/tower/${tower.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {tower.name} AI Initiatives
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const displayFeasibility = effectiveInitiativeFeasibility(initiative);
  const feas = feasibilityChip(displayFeasibility);
  const headerSubtitle =
    resolvedProcess?.description ?? initiative.tagline ?? initiative.aiRationale;
  const generatedLabel = initiative.generatedProcess?.source;
  const showGenProgress = !resolvedProcess && !generationError;
  const isPlaceholderProcess =
    initiative.generatedProcess?.source === "fallback";
  const inf = initiative.generatedProcess?.inference;
  const coverageCount = coveredL4Names.length;
  const totalChildren = childL4Names.length;
  // Cache is "stale" when:
  //  - it came from the LLM path (fallback caches always render
  //    derived sections so they don't need a refresh hint), AND
  //  - the recorded prompt version doesn't match the current one (or
  //    no version was recorded — i.e. authored before the
  //    solution-brief fields were stamped).
  const isStaleCache = Boolean(
    initiative.generatedProcess?.source === "llm" &&
      inf?.promptVersion !== CURATE_BRIEF_PROMPT_VERSION,
  );

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {showGenProgress ? (
          <div
            className="fixed inset-x-0 top-0 z-50 flex border-b border-accent-purple/30 bg-near-black/95 px-4 py-2.5 shadow-[0_0_24px_rgba(161,0,255,0.12)] backdrop-blur-sm sm:px-6"
            role="status"
            aria-live="assertive"
            id="v6-initiative-generating"
          >
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin text-accent-purple"
                aria-hidden
              />
              <p className="min-w-0 text-sm text-forge-body">
                <span className="text-accent-purple">&gt;</span> Generating
                full four-lens brief (work, team, tools, platform). Often 1–4
                minutes on GPT-5.5; allow up to about five minutes before the
                server stops waiting. Keep this tab open; results are saved to
                your workshop when complete.
              </p>
            </div>
          </div>
        ) : null}
        {showGenProgress ? <div className="h-8 sm:h-10" aria-hidden /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: tower.name, href: `/tower/${tower.id}` },
              { label: initiative.solutionName },
            ]}
          />
        </div>

        <header className="mt-6 space-y-4">
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-4">
                <SolutionIcon
                  iconKey={initiative.iconKey}
                  feasibility={displayFeasibility}
                  size="xl"
                  className="mt-1 shrink-0"
                  towerIconKey={tower?.iconKey}
                  seed={initiative.id}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-forge-hint">
                    <span>{row.l2}</span>
                    <span className="text-forge-subtle">›</span>
                    <span>{row.l3}</span>
                  </div>
                  <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
                    {resolvedProcess ? (
                      <>&gt; {resolvedProcess.name}</>
                    ) : (
                      <>&gt; {initiative.solutionName}</>
                    )}
                  </h1>
                  <p className="mt-2 max-w-4xl text-sm leading-relaxed text-forge-body">
                    {headerSubtitle}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${feas.badge}`}
                  title={feas.tooltip}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${feas.dot}`}
                    aria-hidden
                  />
                  {feas.label}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2.5 py-0.5 text-xs font-medium text-accent-purple">
                  <Sparkles className="h-3 w-3" />
                  AI Solution
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-forge-hint">
              {initiative.primaryVendor ? (
                <Pill
                  icon={<Sparkles className="h-3 w-3" />}
                  label={`Vendor · ${initiative.primaryVendor}`}
                />
              ) : null}
              {totalChildren > 0 ? (
                <Pill
                  icon={<Layers className="h-3 w-3" />}
                  label={
                    coverageCount === totalChildren
                      ? `Covers all ${totalChildren} Activity Groups`
                      : `Covers ${coverageCount} of ${totalChildren} Activity Groups`
                  }
                />
              ) : null}
            </div>
            {showGenProgress ? (
              <p
                className="mt-4 flex items-center gap-2 text-sm text-forge-subtle"
                id="v6-initiative-status"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-purple" />
                Synthesizing initiative in the background…
              </p>
            ) : null}
          </div>
        </header>

        {isPlaceholderProcess ? (
          <div className="mt-4 rounded-2xl border border-accent-amber/50 bg-accent-amber/10 p-4 text-sm text-forge-body">
            <p className="font-display text-base font-semibold text-forge-ink">
              Placeholder only
            </p>
            <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
              The model did not return a full brief; the app saved a minimal
              deterministic shell instead. Fix the issue below (e.g. API key,
              model access, or timeout) and use{" "}
              <span className="font-mono">Regenerate</span> for a rich four-lens
              brief.
            </p>
          </div>
        ) : null}

        {warning ? (
          <div className="mt-4 rounded-2xl border border-accent-amber/40 bg-accent-amber/5 p-4 text-xs leading-relaxed text-accent-amber">
            {warning}
          </div>
        ) : null}

        {coveredL4Names.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-forge-border bg-forge-well/30 p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
              Activity Groups in scope
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {coveredL4Names.map((n) => (
                <li
                  key={n}
                  className="rounded-full border border-forge-border bg-forge-surface px-2.5 py-1 text-xs text-forge-body"
                >
                  {n}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border border-forge-border bg-forge-surface p-5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
            Why AI now
          </p>
          <p className="mt-2 text-sm leading-relaxed text-forge-body">
            {initiative.aiRationale}
          </p>
        </section>

        <div className="mt-6">
          {resolvedProcess ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="sr-only">Initiative summary</h2>
                <ProcessMetrics process={resolvedProcess} />
              </div>
              {isStaleCache ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-purple/40 bg-accent-purple/5 px-4 py-3 text-xs leading-relaxed text-forge-body">
                  <span>
                    <span className="font-mono uppercase tracking-[0.14em] text-accent-purple-light">
                      &gt; Cache notice
                    </span>{" "}
                    This brief was generated under an older prompt
                    {inf?.promptVersion ? ` (${inf.promptVersion})` : ""}. Regenerate
                    to populate the new sourcing verdict, vendor options, and
                    reference-architecture sections.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fresh = getAssessProgram().towers[tower.id as TowerId];
                      if (!fresh || !fresh.l3Rows) return;
                      setTowerAssess(tower.id as TowerId, {
                        l3Rows: fresh.l3Rows.map((r) =>
                          r.id === rowId
                            ? {
                                ...r,
                                l3Initiatives: (r.l3Initiatives ?? []).map((it) =>
                                  it.id === initiativeId
                                    ? { ...it, generatedProcess: undefined }
                                    : it,
                                ),
                              }
                            : r,
                        ),
                      });
                      void fireGeneration();
                    }}
                    disabled={generating}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-accent-purple/50 bg-accent-purple/10 px-2.5 py-1 text-[11px] font-medium text-accent-purple-light hover:bg-accent-purple/20 disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Refreshing…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" />
                        Refresh brief
                      </>
                    )}
                  </button>
                </div>
              ) : null}
              <SolutionBriefView process={resolvedProcess} />
              <BusinessCase process={resolvedProcess} />
            </div>
          ) : generationError ? (
            <ErrorState
              error={generationError}
              onRetry={() => void fireGeneration()}
              retrying={generating}
            />
          ) : (
            <LoadingState message="Synthesizing the six-section solution brief with Versant context." />
          )}
        </div>

        {resolvedProcess ? (
          <p className="mt-8 text-[11px] text-forge-hint">
            {generatedLabel === "llm" ? (
              <>
                Source: Versant-grounded model output
                {inf
                  ? ` · ${inf.model} (${inf.mode === "responses" ? "Responses API" : "Chat Completions"})`
                  : " · model metadata not in cache (regenerate to record)"}
              </>
            ) : generatedLabel === "fallback" ? (
              "Source: placeholder structure (see warning above; configure API and Regenerate)."
            ) : null}
            {generatedLabel === "llm" &&
            intakeHasMinimumSubstance(
              getAssessProgram().towers[tower.id as TowerId]?.aiReadinessIntake,
            )
              ? ` · ${TOWER_READINESS_ATTRIBUTION_LABEL}`
              : ""}
            {initiative.generatedProcess?.generatedAt
              ? ` · ${new Date(initiative.generatedProcess.generatedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : null}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-forge-hint">
          <Link
            href={`/tower/${tower.id}`}
            className="inline-flex items-center gap-1.5 text-forge-body underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to {tower.name} AI Initiatives
          </Link>
          {resolvedProcess ? (
            <button
              type="button"
              onClick={() => {
                if (!tower) return;
                const towerId = tower.id as TowerId;
                const fresh = getAssessProgram().towers[towerId];
                if (!fresh || !fresh.l3Rows) return;
                setTowerAssess(towerId, {
                  l3Rows: fresh.l3Rows.map((r) =>
                    r.id === rowId
                      ? {
                          ...r,
                          l3Initiatives: (r.l3Initiatives ?? []).map((it) =>
                            it.id === initiativeId
                              ? { ...it, generatedProcess: undefined }
                              : it,
                          ),
                        }
                      : r,
                  ),
                });
                router.refresh();
                void fireGeneration();
              }}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-surface px-2.5 py-1 text-[11px] text-forge-body hover:border-accent-purple/30 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Regenerating…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 text-forge-body">
      {icon}
      <span>{label}</span>
    </span>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-8">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent-purple" />
      <div>
        <p className="font-display text-base font-semibold text-forge-ink">
          Generating
        </p>
        <p className="mt-1 text-xs text-forge-subtle">{message}</p>
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="rounded-2xl border border-accent-red/40 bg-accent-red/5 p-6">
      <p className="font-display text-base font-semibold text-forge-ink">
        Couldn&rsquo;t load initiative
      </p>
      <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
        The server returned an error before a placeholder could be built. Check
        your session, network, or
        <span className="font-mono"> OPENAI_API_KEY</span> and try again.
      </p>
      <p className="mt-2 font-mono text-[11px] text-accent-red">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {retrying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Retrying…
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Retry
          </>
        )}
      </button>
    </div>
  );
}
