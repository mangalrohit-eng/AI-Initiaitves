"use client";

import * as React from "react";
import type {
  AIProjectLLM,
  AIProjectResolved,
  CrossTowerAiPlanLLM,
  ProgramSynthesisLLM,
} from "@/lib/cross-tower/aiProjects";
import { buildL4Cohorts } from "@/lib/cross-tower/aiProjects";
import {
  buildInitiativesByIdForHydrate,
  PERSISTED_CROSS_TOWER_PLAN_VERSION,
  type PersistedCrossTowerAiPlan,
} from "@/lib/cross-tower/persistedPlan";
import {
  composeProjects,
  buildProjectsBuildScale,
  summarizeProjects,
  type BuildupPoint,
  type ProjectKpis,
} from "@/lib/cross-tower/composeProjects";
import {
  hashAssumptions,
  type CrossTowerAssumptions,
} from "@/lib/cross-tower/assumptions";
import type {
  CohortStatus,
  SynthesisStatus,
} from "@/lib/llm/crossTowerPlanLLM";
import { PROMPT_VERSION } from "@/lib/llm/prompts/crossTowerAiPlan.v3";
import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";

/** Sentinel when no LLM ran (zero in-plan cohorts after threshold). */
const EMPTY_COHORT_PERSIST_MODEL_ID = "empty-cohort" as const;

/**
 * Cross-Tower AI Plan v3 — page-level state hook.
 *
 * Responsibilities:
 *
 *   1) Snapshot the program + assumptions at the moment of Regenerate. The
 *      executive's draft assumption edits do NOT mutate the rendered KPIs,
 *      Gantt, or value curve until the next click — this is the "no live
 *      updates" UX guarantee.
 *   2) Build the L4 cohorts from the program substrate, hand them to the
 *      server, and merge the LLM-authored projects + synthesis with the
 *      deterministic compose layer to produce `AIProjectResolved[]` plus
 *      KPIs and the value buildup curve.
 *   3) Track cohortStatus + synthesisStatus + warnings so the UI can render
 *      "stub" cards with a per-card retry CTA.
 *   4) **Persist + rehydrate** — after each successful Regenerate, PUT the
 *      LLM payload + cohort snapshot to Postgres (when configured). On
 *      mount, GET restores the last saved plan and seeds compose without an
 *      LLM round-trip when the hook is still idle (race-safe vs. early clicks).
 */

export type PlanPersistenceMode =
  | "ok"
  | "unconfigured"
  | "unavailable"
  | "unknown";

export type RegenerateOptions = {
  forceRegenerate?: boolean;
  retryCohortIds?: string[];
};

export type CrossTowerPlanState = {
  status: "idle" | "loading" | "ready" | "error";
  /** True until GET /api/cross-tower-ai-plan/state settles (distinct from assumptions hydrate). */
  hydratingFromDb: boolean;
  /** Workshop DB disposition for persistence captions. */
  persistenceMode: PlanPersistenceMode;
  /** Resolved projects derived from `appliedProgram` + `appliedAssumptions` + LLM payload. */
  projects: AIProjectResolved[];
  /** 24-month value-buildup curve derived from `projects`. */
  buildup: BuildupPoint[];
  /** Aggregate KPIs derived from `projects`. */
  kpis: ProjectKpis;
  /** LLM-authored synthesis payload (or null on stubs / not-yet-generated). */
  synthesis: ProgramSynthesisLLM | null;
  /** Per-cohort status from the server response. */
  cohortStatus: CohortStatus[];
  /** Synthesis status from the server response. */
  synthesisStatus: SynthesisStatus | null;
  /** Hash of the program substrate the current `projects` were composed against. */
  appliedInputHash: string | null;
  /** Hash of the assumptions the current `projects` were composed against. */
  appliedAssumptionsHash: string | null;
  /** Snapshot of assumptions at last successful Regenerate. */
  appliedAssumptions: CrossTowerAssumptions | null;
  modelId: string | null;
  promptVersion: string | null;
  /** ISO timestamp of last successful generation. */
  generatedAt: string | null;
  /** Network/server error (status === "error"). */
  errorMessage: string | null;
  /** Aggregated server warnings to surface on the page banner. */
  warnings: string[];
};

const INITIAL_STATE: CrossTowerPlanState = {
  status: "idle",
  hydratingFromDb: true,
  persistenceMode: "unknown",
  projects: [],
  buildup: [],
  kpis: {
    totalProjects: 0,
    liveProjects: 0,
    stubProjects: 0,
    deprioritizedProjects: 0,
    quickWinCount: 0,
    strategicBetCount: 0,
    fillInCount: 0,
    totalAttributedAiUsd: 0,
    liveAttributedAiUsd: 0,
    m24RunRateUsd: 0,
    fullScaleRunRateUsd: 0,
    agentsArchitected: 0,
    towersInScope: 0,
  },
  synthesis: null,
  cohortStatus: [],
  synthesisStatus: null,
  appliedInputHash: null,
  appliedAssumptionsHash: null,
  appliedAssumptions: null,
  modelId: null,
  promptVersion: null,
  generatedAt: null,
  errorMessage: null,
  warnings: [],
};

function isIdleSeedState(prev: CrossTowerPlanState): boolean {
  return (
    prev.status === "idle" &&
    prev.generatedAt === null &&
    prev.appliedInputHash === null &&
    prev.projects.length === 0
  );
}

export type UseCrossTowerPlanArgs = {
  program: SelectProgramResult;
  assumptions: CrossTowerAssumptions;
};

export type UseCrossTowerPlanResult = {
  state: CrossTowerPlanState;
  /** Manual regenerate trigger — applies all knobs atomically. */
  regenerate: (opts?: RegenerateOptions) => Promise<void>;
  /** Retry just one cohort (e.g. on a stub card). */
  retryCohort: (l4RowId: string) => Promise<void>;
};

export function useCrossTowerPlan(
  args: UseCrossTowerPlanArgs,
): UseCrossTowerPlanResult {
  const { program, assumptions } = args;
  const [state, setState] = React.useState<CrossTowerPlanState>(INITIAL_STATE);
  const inflightRef = React.useRef<AbortController | null>(null);

  const programRef = React.useRef(program);
  const assumptionsRef = React.useRef(assumptions);
  React.useEffect(() => {
    programRef.current = program;
  }, [program]);
  React.useEffect(() => {
    assumptionsRef.current = assumptions;
  }, [assumptions]);

  const persistSnapshot = React.useCallback((doc: PersistedCrossTowerAiPlan) => {
    void (async () => {
      try {
        const res = await fetch("/api/cross-tower-ai-plan/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(doc),
        });
        let bodyDb: PlanPersistenceMode | undefined;
        try {
          const j = (await res.json()) as { db?: PlanPersistenceMode };
          bodyDb = j.db;
        } catch {
          bodyDb = undefined;
        }
        if (!res.ok) {
          const mode: PlanPersistenceMode =
            res.status === 503 && bodyDb === "unconfigured"
              ? "unconfigured"
              : res.status === 503 && bodyDb === "unavailable"
                ? "unavailable"
                : "unknown";
          setState((prev) => ({
            ...prev,
            persistenceMode: mode,
            warnings: [
              ...prev.warnings,
              "Plan generated but couldn't save — refresh will revert to the last saved plan.",
            ],
          }));
          return;
        }
        setState((prev) => ({ ...prev, persistenceMode: "ok" }));
      } catch {
        setState((prev) => ({
          ...prev,
          persistenceMode: "unavailable",
          warnings: [
            ...prev.warnings,
            "Plan generated but couldn't save — refresh will revert to the last saved plan.",
          ],
        }));
      }
    })();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cross-tower-ai-plan/state");
        const json = (await res.json()) as {
          ok?: boolean;
          plan?: PersistedCrossTowerAiPlan | null;
          db?: PlanPersistenceMode;
          updatedAt?: string | null;
          loadWarning?: string;
        };
        if (cancelled) return;

        const db = json.db ?? "unknown";

        if (!json.ok) {
          setState((prev) => ({
            ...prev,
            hydratingFromDb: false,
            persistenceMode: db === "unknown" ? "unknown" : db,
          }));
          return;
        }

        const loadExtras: string[] = [];
        if (typeof json.loadWarning === "string" && json.loadWarning) {
          loadExtras.push(json.loadWarning);
        }

        if (db === "unavailable") {
          setState((prev) => ({
            ...prev,
            hydratingFromDb: false,
            persistenceMode: "unavailable",
            warnings: [
              ...prev.warnings,
              ...loadExtras,
              "Saved plan unavailable — database unreachable. Click Regenerate to author a new plan.",
            ],
          }));
          return;
        }

        if (db === "unconfigured") {
          setState((prev) => ({
            ...prev,
            hydratingFromDb: false,
            persistenceMode: "unconfigured",
            warnings: loadExtras.length ? [...prev.warnings, ...loadExtras] : prev.warnings,
          }));
          return;
        }

        if (!json.plan) {
          setState((prev) => ({
            ...prev,
            hydratingFromDb: false,
            persistenceMode: "ok",
            warnings: loadExtras.length ? [...prev.warnings, ...loadExtras] : prev.warnings,
          }));
          return;
        }

        const saved = json.plan;
        const initiativesById = buildInitiativesByIdForHydrate(
          saved.cohorts,
          programRef.current,
        );
        const composed = composeProjects({
          cohorts: saved.cohorts,
          projects: saved.plan.projects,
          cohortStatus: saved.cohortStatus,
          initiativesById,
          assumptions: saved.appliedAssumptions,
        });
        const buildup = buildProjectsBuildScale(composed);
        const kpis = summarizeProjects(composed);

        setState((prev) => {
          const common = {
            hydratingFromDb: false as const,
            persistenceMode: "ok" as PlanPersistenceMode,
            warnings: loadExtras.length ? [...prev.warnings, ...loadExtras] : prev.warnings,
          };
          if (!isIdleSeedState(prev)) {
            return { ...prev, ...common };
          }
          return {
            ...prev,
            ...common,
            status: "ready" as const,
            projects: composed,
            buildup,
            kpis,
            synthesis: saved.plan.synthesis,
            cohortStatus: saved.cohortStatus,
            synthesisStatus: saved.synthesisStatus,
            appliedInputHash: saved.inputHash,
            appliedAssumptionsHash: saved.assumptionsHash,
            appliedAssumptions: saved.appliedAssumptions,
            modelId: saved.modelId || null,
            promptVersion: saved.promptVersion || null,
            generatedAt: saved.generatedAt,
            errorMessage: null,
          };
        });
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            hydratingFromDb: false,
            persistenceMode:
              prev.persistenceMode === "unknown" ? "unknown" : prev.persistenceMode,
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchPlan = React.useCallback(
    async (opts: RegenerateOptions = {}) => {
      const programNow = programRef.current;
      const assumptionsNow = assumptionsRef.current;
      const cohorts = buildL4Cohorts(programNow);
      const initiativesById = new Map(
        programNow.initiatives.map((r) => [r.id, r] as const),
      );
      const assumptionsHash = hashAssumptions(assumptionsNow);

      if (cohorts.length === 0) {
        const generatedAt = new Date().toISOString();
        const emptyWarnings = [
          "No initiatives in plan — adjust the threshold in Assumptions to include more L4 Activity Groups.",
        ];
        setState((prev) => ({
          ...INITIAL_STATE,
          hydratingFromDb: prev.hydratingFromDb,
          persistenceMode: prev.persistenceMode,
          status: "ready",
          appliedInputHash: programNow.inputHash,
          appliedAssumptionsHash: assumptionsHash,
          appliedAssumptions: assumptionsNow,
          generatedAt,
          warnings: emptyWarnings,
          errorMessage: null,
        }));
        persistSnapshot({
          version: PERSISTED_CROSS_TOWER_PLAN_VERSION,
          plan: { projects: [], synthesis: null },
          cohortStatus: [],
          synthesisStatus: "stub",
          modelId: EMPTY_COHORT_PERSIST_MODEL_ID,
          promptVersion: PROMPT_VERSION,
          warnings: emptyWarnings,
          cohorts: [],
          appliedAssumptions: assumptionsNow,
          inputHash: programNow.inputHash,
          assumptionsHash,
          generatedAt,
        });
        return;
      }

      if (inflightRef.current) inflightRef.current.abort();
      const controller = new AbortController();
      inflightRef.current = controller;

      setState((prev) => ({
        ...prev,
        status: "loading",
        errorMessage: null,
      }));

      try {
        const body = {
          inputHash: programNow.inputHash,
          assumptionsHash,
          cohorts,
          assumptions: assumptionsNow,
          forceRegenerate: opts.forceRegenerate === true,
          retryCohortIds: opts.retryCohortIds,
        };
        const res = await fetch("/api/cross-tower-ai-plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`,
          );
        }
        const json = (await res.json()) as {
          ok?: boolean;
          plan?: CrossTowerAiPlanLLM | null;
          cohortStatus?: CohortStatus[];
          synthesisStatus?: SynthesisStatus;
          modelId?: string;
          promptVersion?: string;
          generatedAt?: string;
          warnings?: string[];
        };
        if (!json.ok) throw new Error("Server returned ok=false");

        const projectsLlm: AIProjectLLM[] = json.plan?.projects ?? [];
        const synthesis = json.plan?.synthesis ?? null;
        const cohortStatus = json.cohortStatus ?? [];
        const synthesisStatus = json.synthesisStatus ?? "stub";

        const composed = composeProjects({
          cohorts,
          projects: projectsLlm,
          cohortStatus,
          initiativesById,
          assumptions: assumptionsNow,
        });
        const buildup = buildProjectsBuildScale(composed);
        const kpis = summarizeProjects(composed);

        const generatedAt = json.generatedAt ?? new Date().toISOString();
        const apiWarnings = json.warnings ?? [];

        setState((prev) => ({
          ...prev,
          status: "ready",
          projects: composed,
          buildup,
          kpis,
          synthesis,
          cohortStatus,
          synthesisStatus,
          appliedInputHash: programNow.inputHash,
          appliedAssumptionsHash: assumptionsHash,
          appliedAssumptions: assumptionsNow,
          modelId: json.modelId ?? null,
          promptVersion: json.promptVersion ?? null,
          generatedAt,
          errorMessage: null,
          warnings: apiWarnings,
        }));

        persistSnapshot({
          version: PERSISTED_CROSS_TOWER_PLAN_VERSION,
          plan: { projects: projectsLlm, synthesis },
          cohortStatus,
          synthesisStatus,
          modelId: json.modelId ?? "",
          promptVersion: json.promptVersion ?? "",
          warnings: apiWarnings,
          cohorts,
          appliedAssumptions: assumptionsNow,
          inputHash: programNow.inputHash,
          assumptionsHash,
          generatedAt,
        });
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: e instanceof Error ? e.message : "Unknown error",
        }));
      } finally {
        if (inflightRef.current === controller) {
          inflightRef.current = null;
        }
      }
    },
    [persistSnapshot],
  );

  const retryCohort = React.useCallback(
    async (l4RowId: string) => {
      await fetchPlan({ retryCohortIds: [l4RowId] });
    },
    [fetchPlan],
  );

  React.useEffect(() => {
    return () => {
      inflightRef.current?.abort();
    };
  }, []);

  return { state, regenerate: fetchPlan, retryCohort };
}

/** Public-only re-exports so callers don't need to know the cross-tower lib path. */
export type { ProjectKpis, BuildupPoint };
