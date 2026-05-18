"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  Layers,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { UseStrategistOutputsApi } from "@/lib/llm/useStrategistOutputs";
import type { BaseScope } from "@/lib/scope/baseScope";
import { baseScopeLabel } from "@/lib/scope/baseScope";
import type {
  OutcomeCluster,
  StrategistInitiative,
  ValueCategory,
} from "@/lib/strategist/types";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import {
  clusterRollupUsd,
  deriveValueTier,
  initiativeRollupUsd,
  type DerivedValueTier,
} from "@/lib/strategist/rollups";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { towers as ALL_TOWERS } from "@/data/towers";

/**
 * Cross-Tower → "Outcome Clusters" tab.
 *
 * This is the visible surface for the AI-Transformation-Strategist's
 * first two outputs:
 *
 *   - Output 1: Business Outcome Clusters (cross-tower outcomes)
 *   - Output 2: Discrete AI Initiatives per cluster
 *
 * Lifecycle is manual — the tab does not auto-fire on mount. A
 * "Generate" CTA invokes the strategist API; subsequent edits to the
 * underlying capability map / lanes / readiness intake mark the
 * generated payload stale and surface a "Regenerate" banner.
 */
export function OutcomeClustersTab({
  scope,
  api,
  projects,
  onJumpToOrchestration,
}: {
  scope: BaseScope;
  api: UseStrategistOutputsApi;
  /**
   * Tower-specific AI Solutions used to compute the deterministic
   * dollar rollup that drives each cluster / initiative's tier pill
   * and the modeled $ chip in the card header.
   */
  projects: ReadonlyArray<AIProjectResolved>;
  onJumpToOrchestration?: () => void;
}) {
  const { state, generate, isStale } = api;
  const isLoading = state.status === "loading";
  const isReady = state.status === "ready" && !!state.outputs;
  const errored = state.status === "error";
  // `ready` with no outputs = the API returned a stub fallback (LLM
  // timed out, validation failed, or no towers in scope). Surface this
  // explicitly — otherwise the tab body is silently empty below the
  // header.
  const stubFallback =
    state.status === "ready" && !state.outputs && state.source === "stub";

  return (
    <div className="space-y-6">
      <StrategistHeaderBar
        scope={scope}
        status={state.status}
        source={state.source}
        generatedAt={state.generatedAt}
        modelId={state.modelId}
        promptVersion={state.promptVersion}
        warnings={state.warnings}
        isStale={isStale}
        onGenerate={() => void generate({ forceRegenerate: false })}
        onRegenerate={() => void generate({ forceRegenerate: true })}
        isLoading={isLoading}
      />

      {errored ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-700"
        >
          <p className="font-medium">
            We couldn&apos;t reach the strategist model.
          </p>
          <p className="mt-1 text-[12.5px] text-red-700/85">
            {state.errorMessage ?? "Unknown error"}
          </p>
        </div>
      ) : null}

      {!isReady && !isLoading && !errored && !stubFallback ? (
        <EmptyStrategistPanel
          scope={scope}
          onGenerate={() => void generate({ forceRegenerate: false })}
        />
      ) : null}

      {stubFallback ? (
        <StubFallbackPanel
          warnings={state.warnings}
          onRetry={() => void generate({ forceRegenerate: true })}
          isLoading={isLoading}
        />
      ) : null}

      {isLoading && !isReady ? <StrategistLoadingPanel /> : null}

      {isReady && state.outputs ? (
        <>
          <ClusterGrid
            clusters={state.outputs.clusters}
            initiatives={state.outputs.initiatives}
            projects={projects}
          />
          {onJumpToOrchestration ? (
            <button
              type="button"
              onClick={onJumpToOrchestration}
              className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
            >
              <Layers className="h-4 w-4" aria-hidden />
              See orchestration &amp; data-layer requirements
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
//   Header bar — status + generate / regenerate controls
// ---------------------------------------------------------------------

function StrategistHeaderBar({
  scope,
  status,
  source,
  generatedAt,
  modelId,
  promptVersion,
  warnings,
  isStale,
  onGenerate,
  onRegenerate,
  isLoading,
}: {
  scope: BaseScope;
  status: "idle" | "loading" | "ready" | "error";
  source: "llm" | "cache" | "stub" | null;
  generatedAt: string | null;
  modelId: string | null;
  promptVersion: string | null;
  warnings: string[];
  isStale: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  isLoading: boolean;
}) {
  const ready = status === "ready";
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
              <Sparkles className="h-3 w-3" aria-hidden />
              Strategist run
            </span>
            <span className="text-[11px] text-forge-subtle">
              Base scope: <strong>{baseScopeLabel(scope)}</strong>
            </span>
            {source ? (
              <span className="text-[11px] text-forge-subtle">
                Source:{" "}
                <strong className="font-mono">{source}</strong>
              </span>
            ) : null}
            {ready && generatedAt ? (
              <span className="text-[11px] text-forge-subtle">
                Generated{" "}
                <time className="font-mono" dateTime={generatedAt}>
                  {new Date(generatedAt).toLocaleString()}
                </time>
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-forge-body">
            Four to six cross-tower outcomes &mdash; with 4-7 discrete
            initiatives each &mdash; that the AI plan should drive at
            Versant. Business-outcome-led, not tool-led.
          </p>
          {modelId || promptVersion ? (
            <p className="mt-1 font-mono text-[10.5px] text-forge-subtle">
              {modelId ? `model: ${modelId}` : null}
              {modelId && promptVersion ? "  ·  " : null}
              {promptVersion ? `prompt: ${promptVersion}` : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row">
          {ready ? (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",
                  isLoading ? "animate-spin" : "",
                ].join(" ")}
                aria-hidden
              />
              Regenerate
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerate}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-purple px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" aria-hidden />
              {isLoading ? "Generating…" : "Generate strategist outputs"}
            </button>
          )}
        </div>
      </div>

      {isStale ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
            aria-hidden
          />
          <span>
            The capability map, offshore lanes, or readiness intake have
            changed since this strategist run. Regenerate to refresh the
            outcome clusters.
          </span>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-forge-border bg-forge-well/40 px-3 py-2 text-[11px] text-forge-subtle">
          <p className="font-semibold text-forge-body">Run warnings</p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.slice(0, 4).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
//   Empty / loading panels
// ---------------------------------------------------------------------

function EmptyStrategistPanel({
  scope,
  onGenerate,
}: {
  scope: BaseScope;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-forge-border bg-forge-surface p-8 text-center">
      <Sparkles
        className="mx-auto h-7 w-7 text-accent-purple-dark"
        aria-hidden
      />
      <h3 className="mt-3 font-display text-lg font-semibold text-forge-ink">
        Run the strategist to surface outcome clusters
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-forge-body">
        The strategist reads the live capability map, the offshore
        lanes from Step&nbsp;2, and the AI readiness intakes from
        Step&nbsp;3 against the &quot;{baseScopeLabel(scope)}&quot; base, then
        proposes 4-6 cross-tower outcomes plus discrete initiatives
        under each. Investment and savings stay TBD pending discovery.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark"
      >
        <Wand2 className="h-4 w-4" aria-hidden />
        Generate strategist outputs
      </button>
    </div>
  );
}

function StubFallbackPanel({
  warnings,
  onRetry,
  isLoading,
}: {
  warnings: string[];
  onRetry: () => void;
  isLoading: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-400/40 bg-amber-50 p-5 text-sm text-amber-900"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold text-amber-900">
            Strategist run completed without usable outputs
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900/85">
            The cross-tower-AI-plan strategist API replied successfully but
            returned a deterministic stub instead of generated content — most
            commonly an LLM timeout on a full-program prompt, a schema
            validation failure, or zero towers in scope. The Outcome Clusters
            and Orchestration tabs need a successful run before they render.
          </p>
          {warnings.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-100/50 px-3 py-2">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-amber-900">
                Server warnings
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-amber-900/90">
                {warnings.map((w, i) => (
                  <li key={i} className="font-mono">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-900 transition hover:border-amber-600 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                aria-hidden
              />
              {isLoading ? "Retrying…" : "Retry strategist run"}
            </button>
            <span className="text-[11px] text-amber-900/70">
              If timeouts persist, set{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-[10.5px]">
                OPENAI_STRATEGIST_TIMEOUT_MS=300000
              </code>{" "}
              in <code className="font-mono text-[10.5px]">.env.local</code>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategistLoadingPanel() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-forge-border bg-forge-surface p-6"
    >
      <div className="flex items-center gap-3">
        <RefreshCw
          className="h-5 w-5 animate-spin text-accent-purple-dark"
          aria-hidden
        />
        <p className="font-display text-sm font-semibold text-forge-ink">
          Generating outcome clusters and discrete initiatives…
        </p>
      </div>
      <p className="mt-2 text-[12.5px] text-forge-subtle">
        Reading the live capability map, offshore lanes, and tower
        readiness intakes. This typically takes 12-25 seconds.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
//   Cluster grid + per-initiative cards
// ---------------------------------------------------------------------

function ClusterGrid({
  clusters,
  initiatives,
  projects,
}: {
  clusters: OutcomeCluster[];
  initiatives: StrategistInitiative[];
  projects: ReadonlyArray<AIProjectResolved>;
}) {
  if (clusters.length === 0) {
    return (
      <div className="rounded-xl border border-forge-border bg-forge-surface p-6 text-[13px] text-forge-body">
        The strategist run produced no outcome clusters. Regenerate or
        review the inputs.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {clusters.map((cluster) => {
        const inits = initiatives.filter((i) => i.clusterId === cluster.id);
        return (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            initiatives={inits}
            projects={projects}
          />
        );
      })}
    </div>
  );
}

function ClusterCard({
  cluster,
  initiatives,
  projects,
}: {
  cluster: OutcomeCluster;
  initiatives: StrategistInitiative[];
  projects: ReadonlyArray<AIProjectResolved>;
}) {
  const rollupUsd = clusterRollupUsd(cluster, initiatives, projects);
  const tier = deriveValueTier(rollupUsd);
  const detailHref = `/program/cross-tower-ai-plan/outcome/${cluster.id}`;
  const anchoredCount = new Set(
    initiatives.flatMap((i) => i.constituentSolutionIds ?? []),
  ).size;
  return (
    <section
      id={`cluster-${cluster.id}`}
      className="rounded-xl border border-forge-border bg-forge-surface p-5 shadow-sm transition hover:border-accent-purple/40 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.18)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold tracking-tight text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
            <Link
              href={detailHref}
              className="hover:text-accent-purple-dark hover:underline decoration-accent-purple/40 underline-offset-4"
            >
              {cluster.title}
            </Link>
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-forge-body">
            {cluster.narrative}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-forge-subtle">
            {cluster.headlineMetric ? (
              <span>
                Headline metric:{" "}
                <span className="font-mono text-forge-body">
                  {cluster.headlineMetric}
                </span>
              </span>
            ) : null}
            <DollarRollupChip usd={rollupUsd} anchoredCount={anchoredCount} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ValueTierBadge tier={tier} />
          <TowerChipRow towers={cluster.towers} />
        </div>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {initiatives.map((i) => (
          <InitiativeCard
            key={i.id}
            initiative={i}
            clusterId={cluster.id}
            projects={projects}
          />
        ))}
        {initiatives.length === 0 ? (
          <div className="col-span-full rounded-md border border-dashed border-forge-border bg-forge-well/40 p-3 text-[12px] text-forge-subtle">
            No discrete initiatives surfaced for this cluster.
          </div>
        ) : null}
      </div>

      <footer className="mt-4 flex justify-end">
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-3 py-1.5 text-[11px] font-medium text-accent-purple-dark transition hover:border-accent-purple/55 hover:bg-accent-purple/10"
        >
          Open outcome brief
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </footer>
    </section>
  );
}

function InitiativeCard({
  initiative,
  clusterId,
  projects,
}: {
  initiative: StrategistInitiative;
  clusterId: string;
  projects: ReadonlyArray<AIProjectResolved>;
}) {
  const rollupUsd = initiativeRollupUsd(initiative, projects);
  const tier = deriveValueTier(rollupUsd);
  const detailHref = `/program/cross-tower-ai-plan/outcome/${clusterId}/initiative/${initiative.id}`;
  return (
    <article
      id={`strategist-initiative-${initiative.id}`}
      className="flex flex-col gap-3 rounded-lg border border-forge-border bg-forge-well/30 p-4 transition hover:border-accent-purple/40 hover:bg-forge-well/45"
    >
      <header className="flex items-start justify-between gap-2">
        <h4 className="font-display text-[14px] font-semibold leading-tight text-forge-ink">
          <Link
            href={detailHref}
            className="hover:text-accent-purple-dark hover:underline decoration-accent-purple/40 underline-offset-4"
          >
            {initiative.name}
          </Link>
        </h4>
        <ValueTierBadge tier={tier} />
      </header>
      <DollarRollupChip
        usd={rollupUsd}
        anchoredCount={(initiative.constituentSolutionIds ?? []).length}
        dense
      />
      <TowerChipRow towers={initiative.towers} dense />
      <div className="grid gap-2 text-[12px] leading-relaxed text-forge-body sm:grid-cols-2">
        <div>
          <p className="font-semibold uppercase tracking-wider text-[10px] text-forge-subtle">
            Current state
          </p>
          <p className="mt-1">{initiative.currentState}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-[10px] text-forge-subtle">
            Future state
          </p>
          <p className="mt-1">{initiative.futureState}</p>
        </div>
      </div>
      <ValueCategoryChips categories={initiative.valueCategories} />
      {initiative.dependencies.length > 0 ? (
        <div>
          <p className="font-semibold uppercase tracking-wider text-[10px] text-forge-subtle">
            Dependencies
          </p>
          <ul className="mt-1 list-disc pl-4 text-[12px] text-forge-body">
            {initiative.dependencies.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        href={detailHref}
        className="mt-1 inline-flex items-center gap-1.5 self-start text-[11px] font-semibold text-accent-purple-dark transition hover:text-accent-purple"
      >
        Open initiative brief
        <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </article>
  );
}

/**
 * Modeled-$ pill driven by the deterministic anchored rollup. Pairs
 * with `ValueTierBadge` so the tier and the number always agree by
 * construction. Renders the mandated "TBD — subject to discovery"
 * fallback when no tower-specific AI Solutions are anchored.
 */
function DollarRollupChip({
  usd,
  anchoredCount,
  dense,
}: {
  usd: number | null;
  anchoredCount: number;
  dense?: boolean;
}) {
  const redact = useRedactDollars();
  const pad = dense ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  if (usd === null || anchoredCount === 0) {
    return (
      <span
        title="The strategist did not anchor this to any in-flight AI Solution. Regenerate to refresh."
        className={`inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/60 ${pad} font-medium text-forge-subtle`}
      >
        <Coins className="h-3 w-3" aria-hidden />
        Modeled $: TBD — subject to discovery
      </span>
    );
  }
  const label = redact ? "—" : formatUsdCompact(usd, { decimals: 1 });
  const suffix =
    anchoredCount === 1
      ? "from 1 AI Solution"
      : `from ${anchoredCount} AI Solutions`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 ${pad} font-medium text-accent-purple-dark`}
    >
      <Coins className="h-3 w-3" aria-hidden />
      <span className="font-mono">{label}</span>
      <span className="text-forge-subtle">· {suffix}</span>
    </span>
  );
}

function ValueTierBadge({ tier }: { tier: DerivedValueTier }) {
  const cls =
    tier === "HIGH"
      ? "border-red-400/40 bg-red-50 text-red-700"
      : tier === "MEDIUM"
        ? "border-amber-400/40 bg-amber-50 text-amber-800"
        : tier === "LOW"
          ? "border-teal-400/40 bg-teal-50 text-teal-800"
          : "border-forge-border bg-forge-well/60 text-forge-subtle";
  const label = tier === "UNSIZED" ? "Unsized" : tier;
  const title =
    tier === "UNSIZED"
      ? "No anchored AI Solutions yet — TBD subject to discovery"
      : `Derived from the rolled-up modeled $ of anchored AI Solutions`;
  return (
    <span
      title={title}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

function ValueCategoryChips({ categories }: { categories: ValueCategory[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => (
        <span
          key={c}
          className="rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10.5px] font-medium text-accent-purple-dark"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function TowerChipRow({
  towers,
  dense,
}: {
  towers: string[];
  dense?: boolean;
}) {
  const labels = towers
    .map((tid) => towerLabelById(tid))
    .filter((s): s is string => !!s);
  if (labels.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${dense ? "" : "sm:max-w-[40%]"}`}>
      {labels.map((l) => (
        <span
          key={l}
          className="rounded-md border border-forge-border bg-forge-surface px-1.5 py-0.5 text-[10.5px] font-medium text-forge-body"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

function towerLabelById(tid: string): string | null {
  const t = ALL_TOWERS.find((x) => x.id === tid);
  if (!t) return null;
  return t.name;
}
