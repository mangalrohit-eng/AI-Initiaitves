"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Wand2,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TabGroup, type TabItem } from "@/components/ui/TabGroup";
import { useProgramInitiatives } from "@/lib/initiatives/useProgramInitiatives";
import { useCrossTowerPlan } from "@/lib/llm/useCrossTowerPlan";
import { KpiStrip } from "./KpiStrip";
import { KeyInitiativesModule } from "./KeyInitiativesModule";
import { ImplementationRoadmapModule } from "./ImplementationRoadmapModule";
import { TechArchitectureModule } from "./TechArchitectureModule";
import { TwoYearValueBuildupModule } from "./TwoYearValueBuildupModule";
import { EvidenceRisksFooter } from "./EvidenceRisksFooter";
import { TechViewModule } from "./TechViewModule";
import { InitiativesAllListing } from "./InitiativesAllListing";
import { BuildScaleGanttChart } from "./buildScale/BuildScaleGanttChart";
import { BuildScaleSummary } from "./buildScale/BuildScaleSummary";
import { BuildRisksPanel } from "./buildScale/BuildRisksPanel";
import { PlanThresholdInput } from "./PlanThresholdInput";

const THRESHOLD_STORAGE_KEY = "forge.crossTowerPlan.aiUsdThreshold";
const DEFAULT_THRESHOLD = 500_000;

/**
 * Cross-Tower AI Plan — client shell.
 *
 * Layout:
 *   - Persistent header (breadcrumbs + exec summary + Regenerate button)
 *   - 6-tile KPI strip (full-scale + M24 modeled run-rate side by side)
 *   - 6-tab TabGroup, each tab full-width:
 *       Overview · Initiatives · Roadmap · Architecture · Tech View · Risks
 *
 * Determinism boundary:
 *   - KPI strip, run-rate chart, Gantt, comprehensive listing, Tech View,
 *     and per-tower agent map are all deterministic — they update live as
 *     scenario state changes, no Regenerate needed.
 *   - Regenerate triggers a GPT-5.5 server call that refreshes only the
 *     LLM-authored narrative (exec summary, top-N rationales + dependencies,
 *     phase narrative, architecture commentary, risk mitigations).
 */
export function CrossTowerAiPlanClient() {
  // Threshold state — initialised from localStorage on first client render so
  // refreshes preserve intent. Persists on every change. Default $500K — the
  // "in-plan" floor below which initiatives are opportunistic.
  const [threshold, setThreshold] = React.useState<number>(DEFAULT_THRESHOLD);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(THRESHOLD_STORAGE_KEY);
      if (raw === null) return;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed >= 0) setThreshold(parsed);
    } catch {
      // localStorage unavailable — fall back to the default.
    }
  }, []);
  const persistThreshold = React.useCallback((next: number) => {
    setThreshold(next);
    try {
      window.localStorage.setItem(THRESHOLD_STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable — non-fatal, value still in-memory.
    }
  }, []);

  const program = useProgramInitiatives(threshold);
  const { state, regenerate } = useCrossTowerPlan(program);

  // Manual-flow state derivation:
  //   - `hasGenerated`: a plan (or fallback "deterministic" source) has been
  //     authored at least once this session.
  //   - `isStale`: the live program (after threshold / dial edits) no longer
  //     matches the scenario the last generation was authored against.
  //   - `isFirstRun`: nothing has been generated yet AND we're not currently
  //     loading. Uses `!== "loading"` (not `=== "idle"`) so a failed Generate
  //     click (status === "error") still surfaces the "Generate plan" CTA;
  //     the error banner with its inline Retry sits above and is unaffected.
  const isLoading = state.status === "loading";
  const isError = state.status === "error";
  const llmPlan = state.plan;
  const narrativeUnavailable = state.narrativeUnavailable;
  const hasGenerated = state.plan !== null || state.source !== null;
  const isStale =
    hasGenerated &&
    state.inputHash !== null &&
    state.inputHash !== program.inputHash;
  const isFirstRun = !hasGenerated && !isLoading;

  // Debounce rapid regenerate clicks (idempotent — but prevents duplicate
  // server calls during workshop demos when a user double-clicks). Pass
  // `forceRegenerate` only on a fresh-state click (the user is asking for a
  // *new* narrative for an unchanged scenario); first-run and stale clicks
  // benefit from a server-cache hit if the (scenario, threshold) combo was
  // generated before.
  const [debouncing, setDebouncing] = React.useState(false);
  const handleRegenerate = React.useCallback(async () => {
    if (isLoading) return;
    if (debouncing) return;
    setDebouncing(true);
    try {
      await regenerate({ forceRegenerate: !isFirstRun && !isStale });
    } finally {
      setTimeout(() => setDebouncing(false), 600);
    }
  }, [isLoading, debouncing, regenerate, isFirstRun, isStale]);

  const tabs: TabItem[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-6">
          <TwoYearValueBuildupModule program={program} bare />
          <div className="border-t border-forge-border pt-6">
            <KeyInitiativesModule
              program={program}
              llmPlan={llmPlan}
              narrativeUnavailable={narrativeUnavailable}
              bare
              limit={13}
              onePerTower
              showCta
            />
          </div>
        </div>
      ),
    },
    {
      id: "initiatives",
      label: `Initiatives (${program.initiatives.length})`,
      content: (
        <InitiativesAllListing
          program={program}
          llmPlan={llmPlan}
          narrativeUnavailable={narrativeUnavailable}
        />
      ),
    },
    {
      id: "roadmap",
      label: "Roadmap",
      content: (
        <div className="space-y-6">
          <header>
            <h2 className="font-display text-lg font-semibold text-forge-ink">
              <span className="font-mono text-accent-purple-dark">&gt;</span> Build &amp; scale Gantt
            </h2>
            <p className="mt-1 text-sm text-forge-subtle">
              Every initiative builds, ramps over 6 months, then runs at full
              scale. The Gantt sequences the{" "}
              <span className="font-mono text-forge-body">
                {program.initiatives.length}
              </span>{" "}
              in-plan initiatives across the 24-month horizon — capacity
              sequencing within phases is downstream effort-estimate work.
              {program.threshold.aiUsdThreshold > 0 &&
              program.threshold.excludedCount > 0 ? (
                <>
                  {" "}
                  <span className="font-mono text-forge-body">
                    {program.threshold.excludedCount} below-threshold
                  </span>{" "}
                  initiatives are deferred as opportunistic.
                </>
              ) : null}
            </p>
          </header>
          <BuildScaleSummary buildScale={program.buildScale} />
          <BuildScaleGanttChart buildScale={program.buildScale} />
          <BuildRisksPanel />
          <div className="border-t border-forge-border pt-6">
            <ImplementationRoadmapModule
              program={program}
              llmPlan={llmPlan}
              narrativeUnavailable={narrativeUnavailable}
              bare
            />
          </div>
        </div>
      ),
    },
    {
      id: "architecture",
      label: "Architecture",
      content: (
        <TechArchitectureModule
          program={program}
          llmPlan={llmPlan}
          narrativeUnavailable={narrativeUnavailable}
          bare
        />
      ),
    },
    {
      id: "tech-view",
      label: "Tech View",
      content: <TechViewModule program={program} />,
    },
    {
      id: "risks",
      label: "Risks & Evidence",
      content: (
        <EvidenceRisksFooter
          llmPlan={llmPlan}
          narrativeUnavailable={narrativeUnavailable}
          bare
        />
      ),
    },
  ];

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Program", href: "/" },
            { label: "Cross-Tower AI Plan" },
          ]}
        />

        {/* ============= HEADER ============= */}
        <header className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
              <Sparkles className="h-3 w-3" aria-hidden />
              Versant Forge Program · Cross-tower AI plan
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
              <span className="font-mono text-accent-purple-dark">&gt;</span> 24-month AI plan, across the 13 towers
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-forge-body">
              {llmPlan?.executiveSummary ?? defaultExecutiveSummary(state.warning)}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 lg:items-end">
            <PlanThresholdInput
              value={threshold}
              onChange={persistThreshold}
              excludedCount={program.threshold.excludedCount}
              excludedAiUsd={program.threshold.excludedAiUsd}
              isStale={isStale}
            />
            <RegenerateAction
              state={state}
              isLoading={isLoading || debouncing}
              isFirstRun={isFirstRun}
              isStale={isStale}
              onClick={handleRegenerate}
            />
          </div>
        </header>

        {isError && state.errorMessage ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent-red/40 bg-accent-red/5 px-3 py-2 text-xs text-forge-body">
            <AlertTriangle className="h-3.5 w-3.5 text-accent-red" aria-hidden />
            <span>
              <span className="font-semibold text-accent-red">Generation error.</span> {state.errorMessage}
            </span>
            <button
              type="button"
              onClick={handleRegenerate}
              className="ml-2 underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        {narrativeUnavailable && state.warning ? (
          <div className="mt-4 inline-flex items-start gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-xs text-forge-body">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-accent-amber" aria-hidden />
            <span>
              <span className="font-semibold text-accent-amber">Narrative unavailable.</span>{" "}
              {state.warning} The deterministic data view (Initiatives, Roadmap Gantt, Tech View, KPI strip)
              renders fully without it.
            </span>
          </div>
        ) : null}

        {/* ============= KPI STRIP ============= */}
        <div className="mt-8">
          <KpiStrip program={program} />
        </div>

        {/* ============= TABS ============= */}
        <div className="mt-6">
          <TabGroup tabs={tabs} />
        </div>

        {/* ============= NAV BACK ============= */}
        <div className="mt-10 border-t border-forge-border pt-6">
          <Link
            href="/summary"
            className="inline-flex items-center gap-1.5 text-xs text-forge-subtle hover:text-forge-ink"
          >
            <ArrowLeft className="h-3 w-3" />
            Executive summary
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------

function RegenerateAction({
  state,
  isLoading,
  isFirstRun,
  isStale,
  onClick,
}: {
  state: ReturnType<typeof useCrossTowerPlan>["state"];
  isLoading: boolean;
  isFirstRun: boolean;
  isStale: boolean;
  onClick: () => void;
}) {
  const auditLine = formatAuditLine(state);
  const sourceChip = formatSourceChip(state);

  // Mode resolution — `loading` overrides everything; otherwise `isFirstRun`
  // takes priority over `isStale`. (`isFirstRun` and `isStale` are mutually
  // exclusive by construction at the call site, but we resolve defensively.)
  const mode: "loading" | "firstRun" | "stale" | "fresh" = isLoading
    ? "loading"
    : isFirstRun
      ? "firstRun"
      : isStale
        ? "stale"
        : "fresh";

  const buttonClasses =
    mode === "loading"
      ? "cursor-not-allowed border-forge-border bg-forge-well/60 text-forge-subtle"
      : mode === "stale"
        ? "border-accent-amber/60 bg-accent-amber/10 text-accent-amber hover:border-accent-amber hover:bg-accent-amber/15"
        : "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark hover:border-accent-purple hover:bg-accent-purple/15";

  const Icon =
    mode === "firstRun"
      ? Wand2
      : RefreshCw;

  const label =
    mode === "loading"
      ? "Recomputing…"
      : mode === "firstRun"
        ? "Generate plan"
        : mode === "stale"
          ? "Refresh plan"
          : "Regenerate plan";

  const ariaLabel =
    mode === "firstRun"
      ? "Generate cross-tower AI plan narrative"
      : mode === "stale"
        ? "Refresh stale cross-tower AI plan narrative"
        : "Regenerate cross-tower AI plan narrative";

  const caption =
    mode === "loading"
      ? "Calling GPT-5.5 — narrative refresh in flight."
      : mode === "firstRun"
        ? "Click to author the GPT-5.5 narrative for this scenario. Numerics, Gantt, and Tech View are already populated."
        : mode === "stale"
          ? "Plan stale — scenario or threshold changed since the last generation. Click to refresh narrative."
          : "Regenerate refreshes narrative only — Gantt, listing, and Tech View update live with scenario edits.";

  return (
    <div className="flex flex-col items-end gap-2 sm:items-end">
      <div className="flex items-center gap-2">
        {mode === "stale" ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-accent-amber/50 bg-accent-amber/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-amber"
            aria-hidden
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-amber" />
            Stale
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClick}
          disabled={isLoading}
          aria-label={ariaLabel}
          className={[
            "group relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition",
            buttonClasses,
          ].join(" ")}
        >
          {mode === "stale" ? (
            <span
              className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border border-forge-bg bg-accent-amber"
              aria-hidden
            />
          ) : null}
          <Icon
            className={[
              "h-4 w-4",
              mode === "loading"
                ? "animate-spin"
                : mode === "firstRun"
                  ? "transition group-hover:scale-110"
                  : "transition group-hover:rotate-45",
            ].join(" ")}
            aria-hidden
          />
          {label}
        </button>
      </div>
      <div className="flex items-center gap-2">
        {sourceChip ? (
          <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-forge-subtle">
            {sourceChip}
          </span>
        ) : null}
        <span className="text-[11px] text-forge-subtle">{auditLine}</span>
      </div>
      <span className="max-w-xs text-right text-[10px] leading-snug text-forge-hint">
        {caption}
      </span>
    </div>
  );
}

function formatAuditLine(
  state: ReturnType<typeof useCrossTowerPlan>["state"],
): string {
  if (state.status === "loading") return "Recomputing…";
  if (!state.generatedAt) return "Narrative not yet generated";
  const t = new Date(state.generatedAt);
  const time = isNaN(t.getTime())
    ? state.generatedAt
    : t.toLocaleString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      });
  const parts: string[] = [`Last regenerated: ${time}`];
  if (state.modelId) parts.push(`model: ${state.modelId}`);
  if (state.inputHash) parts.push(`scenario: ${state.inputHash}`);
  return parts.join(" · ");
}

function formatSourceChip(
  state: ReturnType<typeof useCrossTowerPlan>["state"],
): string | null {
  if (state.source === "cache") return "Cached";
  if (state.source === "deterministic") return "Data-only";
  if (state.source === "llm") return "Live";
  return null;
}

function defaultExecutiveSummary(warning: string | null): string {
  if (warning) {
    return "Cross-tower plan, grounded in the live capability map and impact-lever dials. Numerics, value buildup, Gantt, Tech View, and phase membership are populated below; the GPT-5.5 narrative is regenerated on demand. Initiatives below the plan threshold are opportunistic — handled inside the tower roadmaps.";
  }
  return "Versant's cross-tower AI plan: in-plan initiatives sequenced across three horizons (P1 immediate / P2 near-term / P3 medium-term), grounded in the deterministic capability map and impact-lever dials. Numerics, Gantt, Tech View, and value buildup are live below — click Generate plan to author the GPT-5.5 narrative for this scenario. Initiatives below the plan threshold are opportunistic and addressed inside the tower roadmaps.";
}
