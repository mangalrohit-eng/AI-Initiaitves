"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Gauge,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
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
import type {
  AssessProgramV2,
  GeneratedBrief,
  L4Item,
  TowerId,
} from "@/data/assess/types";
import { TIER_STYLES } from "@/lib/priority";

type Params = { slug: string; rowId: string; l4Id: string };

/**
 * Lazy LLM brief page.
 *
 * Renders the same chrome (breadcrumbs, hero, agents / tools / metric
 * panels) as the hand-curated `/brief/[briefSlug]` route, but reads its
 * narrative from `L4Item.generatedBrief` instead of `processBriefs`. On
 * first visit, the cache is empty, so the page fires
 * `clientCurateBrief({ towerId, l2, l3, l4Name, aiRationale, ... })` and
 * persists the response onto the parent `L4Item.generatedBrief`. Subsequent
 * visits short-circuit to the cached payload.
 *
 * Cache invalidation is implicit — the curation pipeline rewrites the
 * entire `l4Items` array atomically when the row's content hash changes,
 * which drops `generatedBrief` along with the rest of the cached fields.
 */
export default function LLMBriefPage() {
  const params = useParams<Params>();
  const router = useRouter();
  const toast = useToast();
  const sync = useAssessSync();

  const slug = decodeURIComponent(params.slug);
  const rowId = decodeURIComponent(params.rowId);
  const l4Id = decodeURIComponent(params.l4Id);

  // Resolve the tower object up-front so we can render breadcrumbs even on
  // the loading state. Fall through to a 404-style empty state if the slug
  // doesn't match a known tower.
  const tower = towers.find((t) => t.id === slug);

  // Subscribe to assess program updates so the cached brief renders the
  // moment our `setTowerAssess` write lands.
  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const towerState = tower ? program?.towers[tower.id as TowerId] : undefined;
  const row = towerState?.l3Rows.find((r) => r.id === rowId);
  const l4Item: L4Item | undefined = row?.l4Items?.find((i) => i.id === l4Id);
  const cachedBrief = l4Item?.generatedBrief;

  const [generating, setGenerating] = React.useState(false);
  const [warning, setWarning] = React.useState<string | undefined>(undefined);
  const [generationError, setGenerationError] = React.useState<
    string | undefined
  >(undefined);

  const fireGeneration = React.useCallback(async () => {
    if (!tower || !row || !l4Item) return;
    if (generating) return;
    setGenerating(true);
    setWarning(undefined);
    setGenerationError(undefined);
    const res = await clientCurateBrief({
      towerId: tower.id as TowerId,
      l2: row.l2,
      l3: row.l3,
      l4Name: l4Item.name,
      aiRationale: l4Item.aiRationale,
      agentOneLine: l4Item.agentOneLine,
      primaryVendor: l4Item.primaryVendor,
    });
    setGenerating(false);
    if (!res.ok) {
      setGenerationError(res.error);
      toast.error({
        title: "Couldn't generate brief",
        description: res.error,
      });
      return;
    }
    setWarning(res.result.warning);
    // Persist the brief onto the L4Item so subsequent visits skip the call.
    const fresh = getAssessProgram().towers[tower.id as TowerId];
    if (!fresh) return;
    setTowerAssess(tower.id as TowerId, {
      l3Rows: fresh.l3Rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              l4Items: (r.l4Items ?? []).map((it) =>
                it.id === l4Id ? { ...it, generatedBrief: res.result.brief } : it,
              ),
            }
          : r,
      ),
    });
    if (sync?.canSync) await sync.flushSave();
  }, [tower, row, l4Item, generating, rowId, l4Id, sync, toast]);

  // Auto-fire generation the first time the page lands AND the cache is
  // empty. Guarded against re-fires by `generating` + the cache check.
  React.useEffect(() => {
    if (!tower || !row || !l4Item) return;
    if (cachedBrief) return;
    if (generating) return;
    void fireGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tower?.id, row?.id, l4Item?.id, cachedBrief]);

  if (program === null) {
    // First paint before localStorage rehydrates — render a minimal shell.
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <LoadingState message="Loading tower data..." />
        </div>
      </PageShell>
    );
  }

  if (!tower) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Brief" }]} />
          <div className="mt-6 rounded-2xl border border-forge-border bg-forge-surface p-8">
            <p className="font-display text-base font-semibold text-forge-ink">
              Tower not found.
            </p>
            <p className="mt-1 text-xs text-forge-subtle">
              The URL references a tower slug ({slug}) that no longer exists.
              Open the towers index to pick a current one.
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
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
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
              The capability map was refreshed since this URL was generated, so
              the row or L4 it points at no longer exists. Open the{" "}
              {tower.name} AI Initiatives view, click the L4 you want, and a
              fresh brief URL will be generated for the current capability map.
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

  const brief = cachedBrief;
  const aiPriority = l4Item.aiPriority;
  const tier = aiPriority ? aiPriority.startsWith("P1") ? "P1" : aiPriority.startsWith("P2") ? "P2" : "P3" : undefined;
  const tierStyles = tier ? TIER_STYLES[tier] : undefined;

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: tower.name, href: `/tower/${tower.id}` },
              { label: l4Item.name },
            ]}
          />
        </div>

        <header className="mt-6 rounded-2xl border border-forge-border bg-forge-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-forge-hint">
                <span>{row.l2}</span>
                <span className="text-forge-subtle">›</span>
                <span>{row.l3}</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold text-forge-ink">
                &gt; {l4Item.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forge-body">
                {l4Item.aiRationale}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
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
                LLM-generated brief
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
        </header>

        {warning ? (
          <div className="mt-4 rounded-2xl border border-accent-amber/40 bg-accent-amber/5 p-4 text-xs leading-relaxed text-accent-amber">
            {warning}
          </div>
        ) : null}

        <div className="mt-6">
          {brief ? (
            <BriefBody brief={brief} />
          ) : generationError ? (
            <ErrorState
              error={generationError}
              onRetry={() => void fireGeneration()}
              retrying={generating}
            />
          ) : (
            <LoadingState
              message="Drafting the Versant-grounded brief... typically 3-8 seconds."
            />
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-forge-hint">
          <Link
            href={`/tower/${tower.id}`}
            className="inline-flex items-center gap-1.5 text-forge-body underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to {tower.name} AI Initiatives
          </Link>
          {brief ? (
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
                              ? { ...it, generatedBrief: undefined }
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
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Regenerate brief
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
      <Loader2 className="h-5 w-5 animate-spin text-accent-purple" />
      <div>
        <p className="font-display text-base font-semibold text-forge-ink">
          Generating brief
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
        Couldn&rsquo;t generate brief.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
        The Versant-grounded LLM didn&rsquo;t return a brief. The deterministic
        fallback also failed — usually a transient network issue or a missing{" "}
        <span className="font-mono">OPENAI_API_KEY</span> on the deployment.
        Click Retry; if the error persists, contact your admin.
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
            Retrying...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Retry generation
          </>
        )}
      </button>
    </div>
  );
}

function BriefBody({ brief }: { brief: GeneratedBrief }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Today" tone="warn">
        <p className="text-sm leading-relaxed text-forge-body">{brief.preState}</p>
      </Panel>
      <Panel title="With AI" tone="ok">
        <p className="text-sm leading-relaxed text-forge-body">{brief.postState}</p>
      </Panel>

      <Panel title="Agents involved" tone="neutral" icon={<Bot className="h-4 w-4 text-accent-purple" />}>
        <ul className="space-y-2">
          {brief.agentsInvolved.map((a, idx) => (
            <li key={`${a.name}-${idx}`} className="text-sm leading-relaxed">
              <span className="font-display font-semibold text-forge-ink">{a.name}</span>
              <span className="mx-1.5 text-forge-hint">›</span>
              <span className="text-forge-body">{a.role}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Tools required" tone="neutral" icon={<Wrench className="h-4 w-4 text-accent-teal" />}>
        <ul className="flex flex-wrap gap-1.5">
          {brief.toolsRequired.map((t, idx) => (
            <li
              key={`${t}-${idx}`}
              className="rounded-full border border-forge-border bg-forge-surface px-2.5 py-0.5 text-xs text-forge-body"
            >
              {t}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Key metric"
        tone="success"
        icon={<Gauge className="h-4 w-4 text-accent-green" />}
        className="lg:col-span-2"
      >
        <p className="font-mono text-base text-accent-green">{brief.keyMetric}</p>
      </Panel>

      <p className="lg:col-span-2 text-[11px] text-forge-hint">
        Generated{" "}
        {new Date(brief.generatedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        via {brief.source === "llm" ? "Versant-grounded LLM" : "deterministic placeholder"}.
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
  tone,
  icon,
  className,
}: {
  title: string;
  children: React.ReactNode;
  tone: "warn" | "ok" | "neutral" | "success";
  icon?: React.ReactNode;
  className?: string;
}) {
  const ringByTone = {
    warn: "border-accent-amber/30 bg-accent-amber/5",
    ok: "border-accent-purple/30 bg-accent-purple/5",
    neutral: "border-forge-border bg-forge-surface/60",
    success: "border-accent-green/30 bg-accent-green/5",
  } as const;
  return (
    <section
      className={`rounded-2xl border p-5 ${ringByTone[tone]} ${className ?? ""}`.trim()}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-forge-ink">
          &gt; {title}
        </h3>
      </div>
      {children}
    </section>
  );
}
