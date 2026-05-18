"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Wand2,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TabGroup, type TabItem } from "@/components/ui/TabGroup";
import type { TowerId } from "@/data/assess/types";
import { towers as allTowers } from "@/data/towers";
import { useProgramInitiativesV6 } from "@/lib/initiatives/useProgramInitiativesV6";
import { useCrossTowerPlanV6 } from "@/lib/llm/useCrossTowerPlanV6";
import {
  buildProjectsBuildScale,
  summarizeProjects,
} from "@/lib/cross-tower/composeProjects";
import {
  CROSS_TOWER_VIEW_PHASES,
  crossTowerViewFiltersActive,
  filterProjectsByView,
  sliceProgramV6ForView,
  type CrossTowerViewPhaseId,
} from "@/lib/cross-tower/filterCrossTowerView";
import {
  useCrossTowerAssumptions,
  hashAssumptions,
} from "@/lib/cross-tower/assumptions";
import { programTierLabel } from "@/lib/programTierLabels";
import { ApproachTab } from "./ApproachTab";
import { ProjectsKpiStrip } from "./ProjectsKpiStrip";
import { ProjectsValueBuildupModule } from "./ProjectsValueBuildupModule";
import { AIProjectsModule } from "./AIProjectsModule";
import { ValueEffortMatrix } from "./ValueEffortMatrix";
import { ProjectsRoadmapModule } from "./ProjectsRoadmapModule";
import {
  ProgramArchitectureNarratives,
  ProgramArchitectureRollups,
} from "./ProgramArchitecturePanel";
import { ProgramRisksPanel } from "./ProgramRisksPanel";
import { AssumptionsTab } from "./AssumptionsTab";
import { OutcomeClustersTab } from "./OutcomeClustersTab";
import { OrchestrationLayerTab } from "./OrchestrationLayerTab";
import { BaseScopeSelector } from "@/components/program/BaseScopeSelector";
import { useBaseScope } from "@/lib/scope/baseScope";
import { useStrategistOutputs } from "@/lib/llm/useStrategistOutputs";
import {
  buildDeckPayload,
  writeDeckPayloadToLocalStorage,
} from "@/lib/cross-tower/deckPayload";
import { exportProjectsToExcel } from "@/lib/cross-tower/exportProjectsExcel";
import { useRedactDollars } from "@/lib/clientMode";
import { getAssessProgram, subscribe } from "@/lib/localStore";
import { latestTowerIntakeImportedAtIso } from "@/lib/assess/towerReadinessIntake";
import type { SelectProgramResultV6 } from "@/lib/initiatives/selectV6Program";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";

/**
 * Cross-Tower AI Plan v3 — page-level shell.
 *
 * Surface model:
 *
 *   - The legacy P1/P2/P3 framing is replaced with the **AI Project**
 *     abstraction (one project per L4 Activity Group, GPT-5.5 authored).
 *   - The legacy header `PlanThresholdInput` is rehomed to the Assumptions
 *     tab so every editable knob lives in one place.
 *   - Assumption edits are deferred — `useCrossTowerAssumptions` writes the
 *     draft to localStorage immediately, but the rendered KPIs / Gantt /
 *     curve only re-flow against the *applied* snapshot the hook holds
 *     after a successful Regenerate. The staleness banner surfaces the gap.
 *
 * Tab order — mirrors the consulting deck flow:
 *
 *   1. **Approach**     — 6-step methodology explainer with live anchors.
 *   2. **Overview**     — KPI strip + 24-month value buildup curve.
 *   3. **AI Projects**  — card grid + slide-over brief drawer.
 *   4. **Value × Effort** — the 2x2 matrix.
 *   5. **Roadmap**      — projects-grain Gantt + LLM roadmap narrative.
 *   6. **Lineage**      — L5 → AI Project trace (tree + matrix + CSV).
 *   7. **Architecture** — orchestration / vendor / data narrative + rollups.
 *   8. **Assumptions**  — every editable knob, single source of truth.
 *   9. **Risks**        — LLM-authored program risks + mitigations.
 *
 * `TabGroup` runs in controlled mode so the Approach tab's CTAs can deep-link
 * straight into the relevant sub-tab (Lineage, Projects, Matrix, Roadmap,
 * Assumptions) without a page reload.
 */
export function CrossTowerAiPlanClient() {
  const router = useRouter();
  const redactDollars = useRedactDollars();
  // ---------------------------------------------------------------------
  //   Assumptions + program substrate
  // ---------------------------------------------------------------------
  const { assumptions, update, reset, hydrating } = useCrossTowerAssumptions();
  // L3-grain program selector + program-synthesis hook. The plan threads
  // L3 AI Initiatives directly; there is no per-cohort fan-out under v6.
  const program: SelectProgramResultV6 = useProgramInitiativesV6(
    assumptions.planThresholdUsd,
  );
  const planHook = useCrossTowerPlanV6({ program, assumptions });
  const state = planHook.state;
  const regenerate = planHook.regenerate;
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);
  const exportMenuTriggerRef = React.useRef<HTMLButtonElement>(null);

  // Program-level base scope (All of Versant vs Retained org only).
  // Drives the strategist run only — KPIs / projects / matrix below
  // continue to honour the existing per-view tower / phase filters.
  const [baseScope] = useBaseScope();
  const strategistApi = useStrategistOutputs(baseScope);

  const isLoading = state.status === "loading";
  const isError = state.status === "error";
  const isReady = state.status === "ready";

  // The plan is "stale" when the *applied* snapshot the hook holds doesn't
  // match the live program/assumptions the user is editing. Two distinct
  // staleness sources, both surface the same UI banner:
  //   - inputHash    → program substrate (assessment, dial edits, threshold)
  //   - assumptionsHash → LLM-affecting knobs only (timing knobs are 0-token)
  const liveAssumptionsHash = React.useMemo(
    () => hashAssumptions(assumptions),
    [assumptions],
  );
  const hasGenerated = isReady || state.appliedInputHash !== null;
  const programStale =
    hasGenerated &&
    state.appliedInputHash !== null &&
    state.appliedInputHash !== program.inputHash;
  const assumptionsStale =
    hasGenerated &&
    state.appliedAssumptionsHash !== null &&
    state.appliedAssumptionsHash !== liveAssumptionsHash;
  // Timing-only edits don't bust the LLM cache, but they do change the
  // composed projects (start/build months). Detect that by comparing the
  // applied assumptions snapshot directly.
  const timingStale =
    hasGenerated &&
    state.appliedAssumptions !== null &&
    !timingMatches(state.appliedAssumptions, assumptions);
  const isStale = programStale || assumptionsStale || timingStale;
  const isFirstRun =
    !hasGenerated && !isLoading && !state.hydratingFromDb;

  const [intakeNudge, setIntakeNudge] = React.useState(false);
  React.useEffect(() => {
    const sync = () => {
      const latest = latestTowerIntakeImportedAtIso(getAssessProgram());
      const genAt = state.generatedAt;
      setIntakeNudge(
        Boolean(
          state.status === "ready" &&
            latest &&
            genAt &&
            latest > genAt &&
            state.synthesis,
        ),
      );
    };
    sync();
    return subscribe("assessProgram", sync);
  }, [state.generatedAt, state.status, state.synthesis]);

  // The top "Regenerate plan" button drives TWO independent pipelines:
  //
  //   1. `regenerate(...)`  → /api/cross-tower-ai-plan/generate
  //                            (KPIs, ranked projects, value × effort 2x2,
  //                            roadmap, value buildup, architecture)
  //   2. `strategistApi.generate(...)` → /api/cross-tower-ai-plan/strategist
  //                            (Outcome Clusters tab, Discrete Initiatives,
  //                            Orchestration & Data Layer tab)
  //
  // Both consume the same upstream substrate (capability map + offshore
  // split + readiness intake) but emit different artifacts, so we fan
  // them out in parallel on every Regenerate click. Without this the
  // Outcome Clusters / Orchestration tabs silently stay empty after the
  // user clicks Regenerate.
  const strategistStatus = strategistApi.state.status;
  const strategistGeneratedAt = strategistApi.state.generatedAt;
  const strategistIsStale = strategistApi.isStale;
  const strategistGenerate = strategistApi.generate;
  const strategistIsLoading = strategistStatus === "loading";
  const strategistIsFirstRun =
    strategistStatus !== "loading" && strategistGeneratedAt == null;

  // Composite flags drive the button mode + caption so it tells the
  // truth about *both* pipelines instead of just the deterministic one.
  const anyLoading = isLoading || strategistIsLoading;
  const anyFirstRun = isFirstRun || strategistIsFirstRun;
  const anyStale = isStale || strategistIsStale;

  const [debouncing, setDebouncing] = React.useState(false);
  const handleRegenerate = React.useCallback(async () => {
    if (anyLoading || debouncing || hydrating || state.hydratingFromDb) return;
    setDebouncing(true);
    try {
      // Force regeneration when the user clicks on an unchanged scenario
      // (asking for a *new* narrative for the same input). When stale,
      // let the cache-key naturally invalidate. Each pipeline computes
      // its own force flag from its own first-run / stale signals.
      const planForce = !isFirstRun && !isStale;
      const strategistForce = !strategistIsFirstRun && !strategistIsStale;
      // Settle both before clearing the debounce. `Promise.allSettled`
      // means a failure in one (e.g. strategist outage) doesn't strand
      // the other's success state.
      await Promise.allSettled([
        regenerate({ forceRegenerate: planForce }),
        strategistGenerate({ forceRegenerate: strategistForce }),
      ]);
    } finally {
      setTimeout(() => setDebouncing(false), 600);
    }
  }, [
    anyLoading,
    debouncing,
    hydrating,
    state.hydratingFromDb,
    regenerate,
    isFirstRun,
    isStale,
    strategistGenerate,
    strategistIsFirstRun,
    strategistIsStale,
  ]);

  const [selectedTowerIds, setSelectedTowerIds] = React.useState<TowerId[]>(
    [],
  );
  const [selectedPhases, setSelectedPhases] = React.useState<
    CrossTowerViewPhaseId[]
  >([]);

  const filteredProjects = React.useMemo(
    () =>
      filterProjectsByView(state.projects, selectedTowerIds, selectedPhases),
    [state.projects, selectedTowerIds, selectedPhases],
  );

  const filteredProgram = React.useMemo(
    () => sliceProgramV6ForView(program, selectedTowerIds, selectedPhases),
    [program, selectedTowerIds, selectedPhases],
  );

  const filteredKpis = React.useMemo(
    () => summarizeProjects(filteredProjects),
    [filteredProjects],
  );

  const excelFilterSummary = React.useMemo(
    () => ({
      towerNames: selectedTowerIds.map(
        (id) => allTowers.find((t) => t.id === id)?.name ?? id,
      ),
      phaseLabels: selectedPhases.map((pt) => programTierLabel(pt).axisLabel),
    }),
    [selectedTowerIds, selectedPhases],
  );

  const filteredBuildup = React.useMemo(
    () => buildProjectsBuildScale(filteredProjects),
    [filteredProjects],
  );

  const viewFiltersActive = crossTowerViewFiltersActive(
    selectedTowerIds,
    selectedPhases,
  );

  const toggleTower = React.useCallback((id: TowerId) => {
    setSelectedTowerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const togglePhase = React.useCallback((phase: CrossTowerViewPhaseId) => {
    setSelectedPhases((prev) =>
      prev.includes(phase) ? prev.filter((x) => x !== phase) : [...prev, phase],
    );
  }, []);

  // Cross-tower view never opens an inline drawer — every card links
  // straight to `/tower/.../initiative/.../...`. Matrix and roadmap
  // surfaces also navigate to the deep-dive instead of opening a drawer.
  const openProject = React.useCallback((p: AIProjectResolved) => {
    if (p.deepDiveHref && typeof window !== "undefined") {
      router.push(p.deepDiveHref);
    }
  }, [router]);

  const handleExportDeck = React.useCallback(() => {
    if (!isReady || state.projects.length === 0 || isLoading || debouncing) return;
    setExportError(null);
    const payload = buildDeckPayload({
      projects: state.projects,
      buildup: state.buildup,
      kpis: state.kpis,
      synthesis: state.synthesis,
      generatedAt: state.generatedAt,
      assumptionsForFootnote: state.appliedAssumptions ?? assumptions,
      // Deck payload reader stamps the inputHash + threshold metadata
      // for the deck footer; the slide bodies read from `state.projects`
      // which carry the v6 fields directly.
      program,
      redactDollars,
      isFirstRunForCopy: isFirstRun,
    });
    const w = writeDeckPayloadToLocalStorage(payload);
    if (!w.ok) {
      setExportError(
        w.error === "quota"
          ? "Deck data exceeded browser storage. Close other tabs or try again."
          : "Could not save deck data for export.",
      );
      return;
    }
    const opened = window.open(
      "/program/cross-tower-ai-plan/deck",
      "_blank",
      "noopener,noreferrer",
    );
    if (!opened) {
      router.push("/program/cross-tower-ai-plan/deck");
    }
  }, [
    assumptions,
    debouncing,
    isFirstRun,
    isLoading,
    isReady,
    program,
    redactDollars,
    router,
    state.appliedAssumptions,
    state.buildup,
    state.generatedAt,
    state.kpis,
    state.projects,
    state.synthesis,
  ]);

  const handleExportExcel = React.useCallback(async () => {
    if (
      !isReady ||
      filteredProjects.length === 0 ||
      isLoading ||
      debouncing
    ) {
      return;
    }
    setExportError(null);
    try {
      await exportProjectsToExcel({
        projects: filteredProjects,
        assumptions,
        kpis: filteredKpis,
        generatedAt: state.generatedAt,
        redactDollars,
        filterSummary: excelFilterSummary,
        executiveSummary: state.synthesis?.executiveSummary ?? null,
      });
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Excel export failed. Try again.",
      );
    }
  }, [
    assumptions,
    debouncing,
    excelFilterSummary,
    filteredKpis,
    filteredProjects,
    isLoading,
    isReady,
    redactDollars,
    state.generatedAt,
    state.synthesis?.executiveSummary,
  ]);

  React.useEffect(() => {
    if (!exportMenuOpen) return;
    const onDocMouseDown = (ev: MouseEvent) => {
      const root = exportMenuRef.current;
      if (root && !root.contains(ev.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setExportMenuOpen(false);
        exportMenuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [exportMenuOpen]);

  const exportTriggerDisabled =
    !isReady || state.projects.length === 0 || isLoading || debouncing;

  // TabGroup runs in controlled mode so the Approach tab's CTAs can deep-link
  // into the Plan / Cross-tower outcomes / Assumptions tabs and scroll to a
  // named section within them. Defaults to Approach so first paint surfaces
  // the methodology rather than the (often empty) Plan chart stack.
  const [activeTabId, setActiveTabId] = React.useState<string>("approach");

  // Deep-link handler shared by ApproachTab CTAs and the consolidated
  // Cross-tower outcomes tab. `sectionId` is matched against `id="..."`
  // on a wrapper inside the target tab; we wait one frame for the tab
  // panel to mount before scrolling.
  const handleJump = React.useCallback(
    (tabId: string, sectionId?: string) => {
      setActiveTabId(tabId);
      if (!sectionId) return;
      if (typeof window === "undefined") return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(sectionId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    },
    [],
  );

  // Approach tab needs strategist counts for the Track B stat tiles.
  const strategistOutputs = strategistApi.state.outputs;
  const strategistIsGenerated = strategistApi.state.status === "ready";
  const strategistCounts = React.useMemo(
    () => ({
      clusterCount: strategistOutputs?.clusters.length ?? null,
      initiativeCount: strategistOutputs?.initiatives.length ?? null,
      isGenerated: strategistIsGenerated,
    }),
    [strategistOutputs, strategistIsGenerated],
  );

  // ---------------------------------------------------------------------
  //   Tab definitions — five sections:
  //     approach              → methodology (two-track rail)
  //     plan                  → AI Solutions, 2×2, roadmap, buildup, rollups
  //     cross-tower-outcomes  → outcome clusters, orchestration, architecture narratives
  //     assumptions           → editable knobs
  //     risks                 → LLM-authored risk catalog
  //
  // Anchor ids inside each tab body let the Approach tab's CTAs deep-link
  // into specific sections via `handleJump(tabId, sectionId)`.
  // ---------------------------------------------------------------------
  const tabs: TabItem[] = React.useMemo(
    () => [
      {
        id: "approach",
        label: "Approach",
        content: (
          <ApproachTab
            program={filteredProgram}
            projects={filteredProjects}
            kpis={filteredKpis}
            strategist={strategistCounts}
            onJump={handleJump}
          />
        ),
      },
      (() => {
        // The Plan count matches the KPI strip's "AI Solutions in plan"
        // metric (live projects only — stubs and deprioritized excluded).
        // The full population breakdown surfaces as a hover tooltip so
        // power users can still see what was filtered out.
        const planLive = filteredKpis.liveProjects;
        const planExcluded =
          filteredKpis.stubProjects + filteredKpis.deprioritizedProjects;
        return {
          id: "plan",
          label: planLive > 0 ? `Plan (${planLive})` : "Plan",
          title:
            planExcluded > 0
              ? `${planLive} live · ${planExcluded} stub or deprioritized`
              : undefined,
          content: (
            <PlanTabContent
              projects={filteredProjects}
              kpis={filteredKpis}
              buildup={filteredBuildup}
              synthesis={state.synthesis}
              assumptions={assumptions}
              openProject={openProject}
              viewFiltersActive={viewFiltersActive}
            />
          ),
        };
      })(),
      {
        id: "cross-tower-outcomes",
        label: "Cross-tower outcomes",
        content: (
          <CrossTowerOutcomesTabContent
            scope={baseScope}
            strategistApi={strategistApi}
            synthesis={state.synthesis}
            projects={filteredProjects}
            viewFiltersActive={viewFiltersActive}
          />
        ),
      },
      {
        id: "assumptions",
        label: "Assumptions",
        content: (
          <AssumptionsTab
            assumptions={assumptions}
            excludedCount={program.threshold.excludedCount}
            excludedAiUsd={program.threshold.excludedAiUsd}
            onChange={update}
            onReset={reset}
            isStale={isStale}
          />
        ),
      },
      {
        id: "risks",
        label: "Risks",
        content: (
          <div className="space-y-4">
            {viewFiltersActive ? <ViewFilterNarrativeNotice /> : null}
            <ProgramRisksPanel synthesis={state.synthesis} bare />
          </div>
        ),
      },
    ],
    [
      assumptions,
      baseScope,
      filteredBuildup,
      filteredKpis,
      filteredProgram,
      filteredProjects,
      handleJump,
      isStale,
      openProject,
      program.threshold.excludedAiUsd,
      program.threshold.excludedCount,
      reset,
      state.synthesis,
      strategistApi,
      strategistCounts,
      update,
      viewFiltersActive,
    ],
  );

  // ---------------------------------------------------------------------
  //   Render
  // ---------------------------------------------------------------------
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
              <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
              24-month agentic AI plan, across the 14 towers
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-forge-body">
              {state.synthesis?.executiveSummary ??
                defaultExecutiveSummary(isFirstRun)}
            </p>
            {viewFiltersActive ? (
              <p className="mt-2 text-[11px] text-forge-subtle">
                Tower and phase filters narrow KPIs and project surfaces below.
                The executive summary reflects the full generated plan.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-stretch gap-3 lg:items-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <div className="relative" ref={exportMenuRef}>
                <button
                  ref={exportMenuTriggerRef}
                  type="button"
                  disabled={exportTriggerDisabled}
                  aria-haspopup="menu"
                  aria-expanded={exportMenuOpen}
                  aria-label="Export cross-tower plan"
                  onClick={() => setExportMenuOpen((o) => !o)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-purple/50 focus-visible:ring-offset-1 focus-visible:ring-offset-forge-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4 shrink-0" aria-hidden />
                  Export
                  <ChevronDown
                    className={[
                      "h-4 w-4 shrink-0 transition",
                      exportMenuOpen ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden
                  />
                </button>
                {exportMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 min-w-[15.5rem] rounded-lg border border-forge-border bg-forge-surface py-1 shadow-card"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full flex-col items-stretch gap-0.5 px-3 py-2.5 text-left text-sm text-forge-body transition hover:bg-forge-well/40"
                      onClick={() => {
                        setExportMenuOpen(false);
                        handleExportDeck();
                      }}
                    >
                      <span className="inline-flex items-center gap-2 font-medium">
                        <FileText
                          className="h-4 w-4 shrink-0 text-accent-purple-dark"
                          aria-hidden
                        />
                        PDF deck
                      </span>
                      <span className="pl-6 text-[11px] leading-snug text-forge-subtle">
                        4:3 executive deck for print or save as PDF
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={filteredProjects.length === 0}
                      title={
                        filteredProjects.length === 0
                          ? "No projects match the current filters"
                          : undefined
                      }
                      className="flex w-full flex-col items-stretch gap-0.5 px-3 py-2.5 text-left text-sm text-forge-body transition hover:bg-forge-well/40 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void handleExportExcel();
                      }}
                    >
                      <span className="inline-flex items-center gap-2 font-medium">
                        <FileSpreadsheet
                          className="h-4 w-4 shrink-0 text-accent-purple-dark"
                          aria-hidden
                        />
                        Excel workbook
                      </span>
                      <span className="pl-6 text-[11px] leading-snug text-forge-subtle">
                        Project plan, briefs, and L5 activities (filtered view)
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
              <RegenerateAction
                state={state}
                isLoading={anyLoading || debouncing}
                hydratingFromDb={state.hydratingFromDb}
                persistenceMode={state.persistenceMode}
                isFirstRun={anyFirstRun}
                isStale={anyStale}
                onClick={handleRegenerate}
              />
            </div>
            <BaseScopeSelector />
            <p className="max-w-xs text-right text-[10.5px] leading-snug text-forge-hint">
              Base scope drives the Cross-tower outcomes tab.
            </p>
            {exportError ? (
              <p className="max-w-sm text-right text-[11px] text-accent-red">
                {exportError}
              </p>
            ) : null}
          </div>
        </header>

        {/* ============= STATE BANNERS ============= */}
        {isError && state.errorMessage ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent-red/40 bg-accent-red/5 px-3 py-2 text-xs text-forge-body">
            <AlertTriangle className="h-3.5 w-3.5 text-accent-red" aria-hidden />
            <span>
              <span className="font-semibold text-accent-red">
                Generation error.
              </span>{" "}
              {state.errorMessage}
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

        {state.warnings.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {state.warnings.map((w, idx) => (
              <li
                key={idx}
                className="inline-flex items-start gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-xs text-forge-body"
              >
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 text-accent-amber"
                  aria-hidden
                />
                <span>
                  <span className="font-semibold text-accent-amber">
                    Notice.
                  </span>{" "}
                  {w}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {intakeNudge ? (
          <p className="mt-3 text-[11px] leading-snug text-forge-subtle">
            <span className="font-medium text-accent-teal">
              Tower AI readiness intake updated
            </span>{" "}
            after this plan was generated. Regenerate to refresh program
            narrative.
          </p>
        ) : null}

        {/* ============= VIEW FILTERS ============= */}
        <section
          className="mt-8 rounded-xl border border-forge-border bg-forge-surface/60 px-4 py-4"
          aria-label="Tower and phase filters"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-2xl text-[11px] leading-snug text-forge-subtle">
                Toggle towers and phases to narrow KPIs and project views.
                Nothing selected means that dimension is unrestricted (full
                program). Tower pills use short codes; hover for the full tower
                name.
              </p>
              {viewFiltersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTowerIds([]);
                    setSelectedPhases([]);
                  }}
                  className="shrink-0 text-xs font-medium text-accent-purple-dark underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            <div
              className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-forge-border"
            >
              <div
                className="flex shrink-0 items-center gap-1 rounded-lg border border-forge-border/90 bg-forge-well/50 py-0.5 pl-1 pr-0.5"
                role="group"
                aria-label="Towers"
              >
                <span className="select-none whitespace-nowrap pl-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-accent-purple-dark">
                  <span className="text-forge-hint" aria-hidden>
                    &gt;{" "}
                  </span>
                  Towers
                </span>
                {allTowers.map((t) => {
                  const pressed = selectedTowerIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={pressed}
                      title={t.name}
                      onClick={() => toggleTower(t.id)}
                      className={towerViewPillClasses(pressed)}
                    >
                      {compactTowerPillLabel(t.id)}
                    </button>
                  );
                })}
              </div>

              <div
                className="mx-1 flex h-7 shrink-0 flex-col items-center justify-center self-center px-1"
                aria-hidden
              >
                <div className="h-full min-h-[1.25rem] w-px rounded-full bg-forge-border-strong" />
              </div>

              <div
                className="flex shrink-0 items-center gap-1 rounded-lg border border-forge-border/90 bg-forge-well/50 py-0.5 pl-1 pr-0.5"
                role="group"
                aria-label="Program phase"
              >
                <span className="select-none whitespace-nowrap pl-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-accent-teal">
                  <span className="text-forge-hint" aria-hidden>
                    &gt;{" "}
                  </span>
                  Phases
                </span>
                {CROSS_TOWER_VIEW_PHASES.map((pt) => {
                  const L = programTierLabel(pt);
                  const pressed = selectedPhases.includes(pt);
                  return (
                    <button
                      key={pt}
                      type="button"
                      aria-pressed={pressed}
                      title={L.axisLabel}
                      onClick={() => togglePhase(pt)}
                      className={phaseViewPillClasses(pressed, pt)}
                    >
                      {L.numeral}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ============= KPI STRIP ============= */}
        <div className="mt-6">
          <ProjectsKpiStrip
            kpis={filteredKpis}
            buildup={filteredBuildup}
            stubProjectCount={filteredKpis.stubProjects}
          />
        </div>

        {/* ============= TABS ============= */}
        <div className="mt-6">
          <TabGroup
            tabs={tabs}
            value={activeTabId}
            onChange={setActiveTabId}
            panelClassName="overflow-visible"
          />
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
//   Helpers — filtered-view notices, staleness, regenerate button, default copy
// ---------------------------------------------------------------------------

import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type { CrossTowerPlanV6State } from "@/lib/llm/useCrossTowerPlanV6";

function ViewFilterNarrativeNotice() {
  return (
    <div className="rounded-lg border border-accent-purple/25 bg-accent-purple/5 px-3 py-2 text-[11px] leading-snug text-forge-body">
      <span className="font-semibold text-accent-purple-dark">
        Filtered view.
      </span>{" "}
      Narrative below was authored for the full program; tables and charts on
      this tab follow your tower and phase selections.
    </div>
  );
}

// ---------------------------------------------------------------------------
//   Consolidated tab content — Plan
// ---------------------------------------------------------------------------

import type { ProjectKpis, BuildupPoint } from "@/lib/cross-tower/composeProjects";

const PLAN_TAB_SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "plan-solutions", label: "Solutions" },
  { id: "plan-matrix", label: "2×2" },
  { id: "plan-roadmap", label: "Roadmap" },
  { id: "plan-buildup", label: "Buildup" },
  { id: "plan-rollups", label: "Rollups" },
];

function PlanTabContent({
  projects,
  kpis,
  buildup,
  synthesis,
  assumptions,
  openProject,
  viewFiltersActive,
}: {
  projects: AIProjectResolved[];
  kpis: ProjectKpis;
  buildup: BuildupPoint[];
  synthesis: CrossTowerPlanV6State["synthesis"];
  assumptions: CrossTowerAssumptions;
  openProject: (p: AIProjectResolved) => void;
  viewFiltersActive: boolean;
}) {
  return (
    <div className="space-y-10">
      <PlanTabAnchorNav sections={PLAN_TAB_SECTIONS} />
      {viewFiltersActive ? <ViewFilterNarrativeNotice /> : null}

      <section id="plan-solutions" className="scroll-mt-24">
        <AIProjectsModule projects={projects} bare />
      </section>

      <section id="plan-matrix" className="scroll-mt-24">
        <ValueEffortMatrix
          projects={projects}
          onSelect={openProject}
          bare
        />
      </section>

      <section id="plan-roadmap" className="scroll-mt-24">
        <ProjectsRoadmapModule
          projects={projects}
          synthesis={synthesis}
          assumptions={assumptions}
          onSelectProject={openProject}
          bare
        />
      </section>

      <section id="plan-buildup" className="scroll-mt-24">
        <ProjectsValueBuildupModule
          buildup={buildup}
          fullScaleRunRateUsd={kpis.fullScaleRunRateUsd}
          assumptions={assumptions}
          bare
        />
      </section>

      <section id="plan-rollups" className="scroll-mt-24">
        <ProgramArchitectureRollups projects={projects} bare />
      </section>
    </div>
  );
}

function PlanTabAnchorNav({
  sections,
}: {
  sections: ReadonlyArray<{ id: string; label: string }>;
}) {
  const onClick = React.useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <nav
      aria-label="Jump to plan section"
      className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-forge-border bg-forge-surface/95 px-3 py-2 shadow-sm backdrop-blur"
    >
      <span className="select-none font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        <span className="text-forge-hint" aria-hidden>
          &gt;{" "}
        </span>
        Jump to
      </span>
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onClick(s.id)}
          className="rounded-full border border-forge-border bg-forge-well/40 px-2.5 py-1 text-[11px] font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40"
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
//   Consolidated tab content — Cross-tower outcomes
// ---------------------------------------------------------------------------

import type { UseStrategistOutputsApi } from "@/lib/llm/useStrategistOutputs";
import type { BaseScope } from "@/lib/scope/baseScope";

function CrossTowerOutcomesTabContent({
  scope,
  strategistApi,
  synthesis,
  projects,
  viewFiltersActive,
}: {
  scope: BaseScope;
  strategistApi: UseStrategistOutputsApi;
  synthesis: CrossTowerPlanV6State["synthesis"];
  projects: AIProjectResolved[];
  viewFiltersActive: boolean;
}) {
  const scrollTo = React.useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <div className="space-y-10">
      {viewFiltersActive ? <ViewFilterNarrativeNotice /> : null}

      <section id="clusters" className="scroll-mt-24">
        <OutcomeClustersTab
          scope={scope}
          api={strategistApi}
          projects={projects}
          onJumpToOrchestration={() => scrollTo("orchestration")}
        />
      </section>

      <section id="orchestration" className="scroll-mt-24">
        <OrchestrationLayerTab
          scope={scope}
          api={strategistApi}
          hideHeader
        />
      </section>

      <section id="architecture-narratives" className="scroll-mt-24">
        <ProgramArchitectureNarratives synthesis={synthesis} bare />
      </section>
    </div>
  );
}

/** Short tower key for dense filter pills (full name in `title`). */
function compactTowerPillLabel(towerId: string): string {
  if (towerId === "hr") return "HR";
  const parts = towerId.split("-").filter(Boolean);
  if (parts.length <= 1) {
    const w = parts[0] ?? towerId;
    return w.length <= 3 ? w.toUpperCase() : w.slice(0, 3).toUpperCase();
  }
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

function towerViewPillClasses(active: boolean): string {
  const base =
    "shrink-0 min-w-[1.75rem] rounded-full border px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold leading-none tracking-tight transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-purple/50 focus-visible:ring-offset-1 focus-visible:ring-offset-forge-bg";
  if (active) {
    return `${base} border-accent-purple/55 bg-accent-purple/15 text-accent-purple-dark`;
  }
  return `${base} border-forge-border bg-forge-well/30 text-forge-body hover:border-forge-border hover:bg-forge-well/55`;
}

function phaseViewPillClasses(
  active: boolean,
  phase: CrossTowerViewPhaseId,
): string {
  const base =
    "shrink-0 inline-flex min-w-[1.75rem] items-center justify-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-purple/50 focus-visible:ring-offset-1 focus-visible:ring-offset-forge-bg";
  if (!active) {
    return `${base} border-forge-border bg-forge-well/30 text-forge-body hover:border-forge-border hover:bg-forge-well/55`;
  }
  if (phase === "P1") {
    return `${base} border-accent-red/55 bg-accent-red/10 text-forge-ink`;
  }
  if (phase === "P2") {
    return `${base} border-accent-amber/55 bg-accent-amber/10 text-forge-ink`;
  }
  return `${base} border-accent-teal/55 bg-accent-teal/10 text-forge-ink`;
}

function timingMatches(
  applied: CrossTowerAssumptions,
  draft: CrossTowerAssumptions,
): boolean {
  return (
    applied.programStartMonth === draft.programStartMonth &&
    applied.rampMonths === draft.rampMonths &&
    applied.p1PhaseStartMonth === draft.p1PhaseStartMonth &&
    applied.p2PhaseStartMonth === draft.p2PhaseStartMonth &&
    applied.p3PhaseStartMonth === draft.p3PhaseStartMonth &&
    applied.p1BuildMonths === draft.p1BuildMonths &&
    applied.p2BuildMonths === draft.p2BuildMonths &&
    applied.p3BuildMonths === draft.p3BuildMonths
  );
}

function RegenerateAction({
  state,
  isLoading,
  hydratingFromDb,
  persistenceMode,
  isFirstRun,
  isStale,
  onClick,
}: {
  state: CrossTowerPlanV6State;
  isLoading: boolean;
  hydratingFromDb: boolean;
  persistenceMode: CrossTowerPlanV6State["persistenceMode"];
  isFirstRun: boolean;
  isStale: boolean;
  onClick: () => void;
}) {
  const auditLine = formatAuditLine(state, hydratingFromDb);

  const mode:
    | "hydrating"
    | "loading"
    | "firstRun"
    | "stale"
    | "fresh" = hydratingFromDb
    ? "hydrating"
    : isLoading
      ? "loading"
      : isFirstRun
        ? "firstRun"
        : isStale
          ? "stale"
          : "fresh";

  const buttonClasses =
    mode === "loading" || mode === "hydrating"
      ? "cursor-not-allowed border-forge-border bg-forge-well/60 text-forge-subtle"
      : mode === "stale"
        ? "border-accent-amber/60 bg-accent-amber/10 text-accent-amber hover:border-accent-amber hover:bg-accent-amber/15"
        : "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark hover:border-accent-purple hover:bg-accent-purple/15";

  const Icon =
    mode === "firstRun" ? Wand2 : RefreshCw;

  const label =
    mode === "hydrating"
      ? "Loading saved plan…"
      : mode === "loading"
        ? "Generating…"
        : mode === "firstRun"
          ? "Generate plan"
          : mode === "stale"
            ? "Refresh plan"
            : "Regenerate plan";

  const ariaLabel =
    mode === "hydrating"
      ? "Loading saved cross-tower AI plan"
      : mode === "firstRun"
        ? "Generate cross-tower AI plan"
        : mode === "stale"
          ? "Refresh stale cross-tower AI plan"
          : "Regenerate cross-tower AI plan";

  // Tight one-liners — the previous multi-clause captions leaked
  // implementation language ("per-cohort fan-out", "0-token") into the
  // executive surface.
  const caption =
    mode === "hydrating"
      ? "Restoring the last saved plan."
      : mode === "loading"
        ? "Authoring solutions, scoring, and program synthesis. 60-180 seconds."
        : mode === "firstRun"
          ? "Author the Versant-grounded plan for this scenario."
          : mode === "stale"
            ? "Inputs changed since last generation. Click to refresh."
            : "Refreshes every solution brief, 2×2 scoring, and program synthesis.";

  const persistenceFootnote =
    persistenceMode === "unconfigured" &&
    mode !== "hydrating" &&
    mode !== "loading"
      ? "Persistence disabled — set DATABASE_URL to retain the plan across reloads."
      : null;

  return (
    <div className="flex flex-col items-end gap-2">
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
          disabled={isLoading || mode === "hydrating"}
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
              mode === "loading" || mode === "hydrating"
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
      <span className="text-[11px] text-forge-subtle">{auditLine}</span>
      <span className="max-w-xs text-right text-[10px] leading-snug text-forge-hint">
        {caption}
      </span>
      {persistenceFootnote ? (
        <span className="max-w-xs text-right text-[10px] leading-snug text-forge-hint">
          {persistenceFootnote}
        </span>
      ) : null}
    </div>
  );
}

function formatAuditLine(
  state: CrossTowerPlanV6State,
  hydratingFromDb: boolean,
): string {
  if (hydratingFromDb) return "Loading saved plan…";
  if (state.status === "loading") return "Authoring…";
  if (!state.generatedAt) return "Plan not yet generated";
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
  return parts.join(" · ");
}

function defaultExecutiveSummary(isFirstRun: boolean): string {
  if (isFirstRun) {
    return "Versant's cross-tower AI plan, sourced directly from the AI Solutions curated in each tower workshop. Click Regenerate plan to score every solution on the Value × Effort 2x2, sequence them across a 24-month roadmap, and roll up the program-level executive summary, risks, and architecture. Numerics and the value buildup curve update deterministically.";
  }
  return "Cross-tower AI plan, sourced directly from the AI Solutions in scope. Each solution carries its own deep-dive brief, is scored on Value × Effort, and threads into the 24-month roadmap. Click any solution to open its Work / Workforce / Workbench / Digital Core brief.";
}
