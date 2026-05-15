"use client";

import * as React from "react";
import {
  AlertTriangle,
  Database,
  GitBranch,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { UseStrategistOutputsApi } from "@/lib/llm/useStrategistOutputs";
import type { BaseScope } from "@/lib/scope/baseScope";
import { baseScopeLabel } from "@/lib/scope/baseScope";
import type {
  OrchestrationBlock,
  StrategistInitiative,
} from "@/lib/strategist/types";

/**
 * Cross-Tower → "Orchestration & Data Layer" tab.
 *
 * Surfaces the strategist's Output 3 — the shared infrastructure
 * (data flows, identity / entity resolution, agent-to-agent APIs,
 * governance) that the initiative portfolio implies, plus the
 * specific initiatives blocked without that layer.
 *
 * State is owned by the parent (the `UseStrategistOutputsApi` is
 * passed in) so the Outcome Clusters tab and this tab share a single
 * run.
 */
export function OrchestrationLayerTab({
  scope,
  api,
}: {
  scope: BaseScope;
  api: UseStrategistOutputsApi;
}) {
  const { state, generate, isStale } = api;
  const isLoading = state.status === "loading";
  const isReady = state.status === "ready" && !!state.outputs;
  const errored = state.status === "error";

  return (
    <div className="space-y-6">
      <Header
        scope={scope}
        status={state.status}
        generatedAt={state.generatedAt}
        isStale={isStale}
        isLoading={isLoading}
        onGenerate={() => void generate({ forceRegenerate: false })}
        onRegenerate={() => void generate({ forceRegenerate: true })}
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

      {!isReady && !isLoading && !errored ? (
        <EmptyOrchestrationPanel
          scope={scope}
          onGenerate={() => void generate({ forceRegenerate: false })}
        />
      ) : null}

      {isLoading && !isReady ? <OrchestrationLoadingPanel /> : null}

      {isReady && state.outputs ? (
        <OrchestrationContent
          orchestration={state.outputs.orchestration}
          initiatives={state.outputs.initiatives}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
//   Header
// ---------------------------------------------------------------------

function Header({
  scope,
  status,
  generatedAt,
  isStale,
  isLoading,
  onGenerate,
  onRegenerate,
}: {
  scope: BaseScope;
  status: "idle" | "loading" | "ready" | "error";
  generatedAt: string | null;
  isStale: boolean;
  isLoading: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
}) {
  const ready = status === "ready";
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
              <Sparkles className="h-3 w-3" aria-hidden />
              Orchestration &amp; data layer
            </span>
            <span className="text-[11px] text-forge-subtle">
              Base scope: <strong>{baseScopeLabel(scope)}</strong>
            </span>
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
            The shared infrastructure required to make the outcome
            clusters compose &mdash; data flows, identity / entity /
            content resolution, agent-to-agent APIs, governance &mdash;
            and the initiatives that stall without it.
          </p>
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
            Capability map, lanes, or readiness intake have changed
            since this run. Regenerate to refresh the orchestration
            view.
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
//   Empty / loading panels
// ---------------------------------------------------------------------

function EmptyOrchestrationPanel({
  scope,
  onGenerate,
}: {
  scope: BaseScope;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-forge-border bg-forge-surface p-8 text-center">
      <Network
        className="mx-auto h-7 w-7 text-accent-purple-dark"
        aria-hidden
      />
      <h3 className="mt-3 font-display text-lg font-semibold text-forge-ink">
        Run the strategist to see the orchestration plan
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-forge-body">
        The orchestration view derives from the same run as the outcome
        clusters &mdash; it identifies the data, identity, API, and
        governance layer the portfolio depends on against the &quot;
        {baseScopeLabel(scope)}&quot; base.
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

function OrchestrationLoadingPanel() {
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
          Generating orchestration &amp; data-layer requirements…
        </p>
      </div>
      <p className="mt-2 text-[12.5px] text-forge-subtle">
        Composing data flows, identity resolution, agent-to-agent APIs,
        and governance from the initiative portfolio.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
//   Main content
// ---------------------------------------------------------------------

function OrchestrationContent({
  orchestration,
  initiatives,
}: {
  orchestration: OrchestrationBlock;
  initiatives: StrategistInitiative[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OrchestrationCard
        icon={<Database className="h-4 w-4" aria-hidden />}
        label="Data flows"
        body={orchestration.dataFlows}
      />
      <OrchestrationCard
        icon={<GitBranch className="h-4 w-4" aria-hidden />}
        label="Identity / entity / content resolution"
        body={orchestration.identityResolution}
      />
      <OrchestrationCard
        icon={<Network className="h-4 w-4" aria-hidden />}
        label="Agent-to-agent APIs & event streams"
        body={orchestration.agentApis}
      />
      <OrchestrationCard
        icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        label="Governance, policy & access controls"
        body={orchestration.governance}
      />

      <div className="lg:col-span-2 rounded-xl border border-forge-border bg-forge-well/40 p-4">
        <h4 className="font-display text-[14px] font-semibold tracking-tight text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Why this can&apos;t be built initiative-by-initiative
        </h4>
        <p className="mt-1.5 text-[13px] leading-relaxed text-forge-body">
          {orchestration.whyShared}
        </p>
      </div>

      <BlockedInitiativesPanel
        blockedIds={orchestration.blockedInitiativeIds}
        initiatives={initiatives}
      />
    </div>
  );
}

function OrchestrationCard({
  icon,
  label,
  body,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
}) {
  return (
    <section className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <header className="flex items-center gap-2">
        <span className="text-accent-purple-dark">{icon}</span>
        <h4 className="font-display text-[13px] font-semibold uppercase tracking-wider text-forge-subtle">
          {label}
        </h4>
      </header>
      <p className="mt-2 text-[13px] leading-relaxed text-forge-body">
        {body}
      </p>
    </section>
  );
}

function BlockedInitiativesPanel({
  blockedIds,
  initiatives,
}: {
  blockedIds: string[];
  initiatives: StrategistInitiative[];
}) {
  const blockedSet = new Set(blockedIds);
  const matched = initiatives.filter((i) => blockedSet.has(i.id));
  return (
    <section className="lg:col-span-2 rounded-xl border border-amber-400/40 bg-amber-50/60 p-4">
      <header className="flex items-center gap-2">
        <AlertTriangle
          className="h-4 w-4 text-amber-700"
          aria-hidden
        />
        <h4 className="font-display text-[13px] font-semibold uppercase tracking-wider text-amber-900">
          Initiatives blocked without this layer
        </h4>
      </header>
      {matched.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-amber-900/85">
          The strategist did not flag specific initiatives as blocked.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {matched.map((i) => (
            <li
              key={i.id}
              className="rounded-md border border-amber-400/40 bg-white/80 px-3 py-2 text-[12.5px] text-amber-900"
            >
              <a
                href={`#strategist-initiative-${i.id}`}
                className="font-semibold text-amber-900 hover:underline"
              >
                {i.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
