"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Gauge,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/components/feedback/ToastProvider";
import { towers } from "@/data/towers";
import {
  getAssessProgram,
  setTowerAssess,
  subscribe,
} from "@/lib/localStore";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { clientCurateBrief } from "@/lib/assess/assessClientApi";
import { ProcessMetrics } from "@/components/processes/ProcessMetrics";
import { BusinessCase } from "@/components/processes/BusinessCase";
import { ProcessExperience } from "@/components/processes/ProcessExperience";
import type {
  AssessProgramV2,
  L4Item,
  TowerId,
} from "@/data/assess/types";
import type { Process } from "@/data/types";
import { TIER_STYLES } from "@/lib/priority";

type Params = { slug: string; rowId: string; l4Id: string };

/**
 * Lazy LLM full initiative: same four-lens shell as the hand-built process
 * page. Caches `L4Item.generatedProcess`. Legacy one-page `generatedBrief` is
 * not rendered here — the page always fetches a full `Process` so the view is
 * not the thin adapter.
 */
export default function LLMBriefPage() {
  const params = useParams<Params>();
  const router = useRouter();
  const toast = useToast();
  const sync = useAssessSync();

  const slug = decodeURIComponent(params.slug);
  const rowId = decodeURIComponent(params.rowId);
  const l4Id = decodeURIComponent(params.l4Id);

  const tower = towers.find((t) => t.id === slug);

  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const towerState = tower ? program?.towers[tower.id as TowerId] : undefined;
  const row = towerState?.l3Rows.find((r) => r.id === rowId);
  const l4Item: L4Item | undefined = row?.l4Items?.find((i) => i.id === l4Id);
  const hasFullCache = Boolean(l4Item?.generatedProcess?.process);

  const [generating, setGenerating] = React.useState(false);
  const [warning, setWarning] = React.useState<string | undefined>(undefined);
  const [generationError, setGenerationError] = React.useState<
    string | undefined
  >(undefined);

  const l4Context = React.useMemo(() => {
    if (!tower || !row || !l4Item) return null;
    return {
      towerId: tower.id as TowerId,
      l2: row.l2,
      l3: row.l3,
      l4Name: l4Item.name,
      l4Id: l4Item.id,
      aiRationale: l4Item.aiRationale,
      agentOneLine: l4Item.agentOneLine,
      primaryVendor: l4Item.primaryVendor,
    };
  }, [tower, row, l4Item]);

  const resolvedProcess: Process | null = React.useMemo(() => {
    if (!l4Item || !l4Context) return null;
    if (l4Item.generatedProcess?.process) {
      return l4Item.generatedProcess.process;
    }
    return null;
  }, [l4Item, l4Context]);

  const fireGeneration = React.useCallback(async () => {
    if (!tower || !row || !l4Item || !l4Context) return;
    if (generating) return;
    setGenerating(true);
    setWarning(undefined);
    setGenerationError(undefined);
    const res = await clientCurateBrief({
      towerId: l4Context.towerId,
      l2: l4Context.l2,
      l3: l4Context.l3,
      l4Name: l4Context.l4Name,
      l4Id: l4Context.l4Id,
      aiRationale: l4Context.aiRationale,
      agentOneLine: l4Context.agentOneLine,
      primaryVendor: l4Context.primaryVendor,
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
    const fresh = getAssessProgram().towers[tower.id as TowerId];
    if (!fresh) return;
    setTowerAssess(tower.id as TowerId, {
      l3Rows: fresh.l3Rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              l4Items: (r.l4Items ?? []).map((it) =>
                it.id === l4Id
                  ? {
                      ...it,
                      generatedProcess: res.result.generatedProcess,
                      generatedBrief: undefined,
                    }
                  : it,
              ),
            }
          : r,
      ),
    });
    if (sync?.canSync) await sync.flushSave();
  }, [tower, row, l4Item, l4Context, generating, rowId, l4Id, sync, toast]);

  React.useEffect(() => {
    if (!tower || !row || !l4Item) return;
    if (hasFullCache) return;
    if (generating) return;
    void fireGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tower?.id, row?.id, l4Item?.id, hasFullCache]);

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
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Brief" }]} />
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

  if (!row || !l4Item) {
    return (
      <PageShell>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: tower.name, href: `/tower/${tower.id}` },
              { label: "Brief" },
            ]}
          />
          <div className="mt-6 rounded-2xl border border-forge-border bg-forge-surface p-8">
            <p className="font-display text-base font-semibold text-forge-ink">
              This brief is no longer available.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
              The capability map was refreshed since this URL was generated.
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

  const aiPriority = l4Item.aiPriority;
  const tier = aiPriority
    ? aiPriority.startsWith("P1")
      ? "P1"
      : aiPriority.startsWith("P2")
        ? "P2"
        : "P3"
    : undefined;
  const tierStyles = tier ? TIER_STYLES[tier] : undefined;
  const headerSubtitle = resolvedProcess?.description ?? l4Item.aiRationale;
  const generatedLabel = l4Item.generatedProcess?.source ?? l4Item.generatedBrief?.source;
  /** True from first paint until a Process exists or a fetch error (covers pre-effect gap). */
  const showGenProgress = !resolvedProcess && !generationError;
  const isPlaceholderProcess = l4Item.generatedProcess?.source === "fallback";
  const inf = l4Item.generatedProcess?.inference;

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {showGenProgress ? (
          <div
            className="fixed inset-x-0 top-0 z-50 flex border-b border-accent-purple/30 bg-near-black/95 px-4 py-2.5 shadow-[0_0_24px_rgba(161,0,255,0.12)] backdrop-blur-sm sm:px-6"
            role="status"
            aria-live="assertive"
            id="llm-brief-generating"
          >
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin text-accent-purple"
                aria-hidden
              />
              <p className="min-w-0 text-sm text-forge-body">
                <span className="text-accent-purple">&gt;</span> Generating
                full four-lens brief (work, team, tools, platform). Typically 20–90 seconds. You can
                keep this tab open; results are saved to your workshop when complete.
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
              { label: l4Item.name },
            ]}
          />
        </div>

        <header className="mt-6 space-y-4">
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                    <>&gt; {l4Item.name}</>
                  )}
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-forge-body">
                  {headerSubtitle}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                {tier && tierStyles ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierStyles.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tierStyles.dot}`} aria-hidden />
                    {aiPriority}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2.5 py-0.5 text-xs font-medium text-accent-purple">
                  <Sparkles className="h-3 w-3" />
                  LLM initiative
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-forge-hint">
              {l4Item.frequency ? (
                <Pill icon={<Gauge className="h-3 w-3" />} label={l4Item.frequency} />
              ) : null}
              {l4Item.criticality ? (
                <Pill icon={<Layers className="h-3 w-3" />} label={l4Item.criticality} />
              ) : null}
              {l4Item.currentMaturity ? (
                <Pill icon={<Wrench className="h-3 w-3" />} label={`Maturity · ${l4Item.currentMaturity}`} />
              ) : null}
            </div>
            {showGenProgress ? (
              <p
                className="mt-4 flex items-center gap-2 text-sm text-forge-subtle"
                id="llm-brief-status"
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
            <p className="font-display text-base font-semibold text-forge-ink">Placeholder only</p>
            <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
              The model did not return a full brief; the app saved a minimal deterministic shell instead.
              Fix the issue below (e.g. API key, model access, or timeout) and use <span className="font-mono">Regenerate</span> for a rich
              four-lens brief.
            </p>
          </div>
        ) : null}

        {warning ? (
          <div className="mt-4 rounded-2xl border border-accent-amber/40 bg-accent-amber/5 p-4 text-xs leading-relaxed text-accent-amber">
            {warning}
          </div>
        ) : null}

        <div className="mt-6">
          {resolvedProcess && l4Context ? (
            <div className="mt-2 space-y-4">
              <div className="mt-2 space-y-2">
                <h2 className="sr-only">Initiative summary</h2>
                <ProcessMetrics process={resolvedProcess} />
              </div>
              {resolvedProcess.currentPainPoints?.length ? (
                <section
                  aria-label="Why this matters now"
                  className="mt-10 rounded-2xl border border-accent-amber/40 bg-amber-50/80 p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-amber/50 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Why this matters today
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold text-forge-ink">
                    The pain points this initiative addresses
                  </h3>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {resolvedProcess.currentPainPoints.map((p) => (
                      <li
                        key={p}
                        className="flex gap-2 rounded-xl border border-amber-200/80 bg-white/70 p-3 text-sm text-forge-body shadow-sm"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-amber" aria-hidden />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <div className="mt-10">
                <BusinessCase process={resolvedProcess} />
              </div>
              <div className="mt-12">
                <ProcessExperience process={resolvedProcess} evidence={[]} />
              </div>
            </div>
          ) : generationError ? (
            <ErrorState
              error={generationError}
              onRetry={() => void fireGeneration()}
              retrying={generating}
            />
          ) : (
            <LoadingState
              message="Synthesizing four-lens work, team, tools, and platform with Versant context."
            />
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
            {l4Item.generatedProcess?.generatedAt
              ? ` · ${new Date(l4Item.generatedProcess.generatedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : l4Item.generatedBrief
                ? ` · Prior one-page cache was replaced on next full generation.`
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
                const fresh = getAssessProgram().towers[tower.id as TowerId];
                if (!fresh) return;
                setTowerAssess(tower.id as TowerId, {
                  l3Rows: fresh.l3Rows.map((r) =>
                    r.id === rowId
                      ? {
                          ...r,
                          l4Items: (r.l4Items ?? []).map((it) =>
                            it.id === l4Id
                              ? { ...it, generatedBrief: undefined, generatedProcess: undefined }
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
        <p className="font-display text-base font-semibold text-forge-ink">Generating</p>
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
      <p className="font-display text-base font-semibold text-forge-ink">Couldn&rsquo;t load initiative</p>
      <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
        The server returned an error before a placeholder could be built. Check your session, network, or
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
