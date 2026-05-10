"use client";

import * as React from "react";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import {
  composeProjectsV6,
  type InitiativeNarrativeV6,
  type ProgramSynthesisLLMV6,
} from "@/lib/cross-tower/composeProjectsV6";
import {
  buildProjectsBuildScale,
  summarizeProjects,
  type BuildupPoint,
  type ProjectKpis,
} from "@/lib/cross-tower/composeProjects";
import {
  hashAssumptions,
  type CrossTowerAssumptions,
} from "@/lib/cross-tower/assumptions";
import {
  PERSISTED_CROSS_TOWER_PLAN_VERSION_V2,
  type PersistedCrossTowerAiPlanV2,
} from "@/lib/cross-tower/persistedPlanV2";
import { CROSS_TOWER_INITIATIVE_PROMPT_VERSION } from "@/lib/llm/prompts/crossTowerInitiativePlan.v1";
import type { SelectProgramResultV6 } from "@/lib/initiatives/selectV6Program";
import type { TowerInScope } from "@/lib/initiatives/programTypes";
import { getAssessProgram } from "@/lib/localStore";
import { buildProgramWideTowerIntakeDigest } from "@/lib/assess/towerReadinessIntake";
import { towers as allTowers } from "@/data/towers";

/**
 * Cross-Tower AI Plan — page-level state hook.
 *
 * The cross-tower page is a 1-to-1 reflection of the curated
 * `L3Initiative` roster across the 13 towers. This hook:
 *
 *   1) Composes `AIProjectResolved[]` deterministically from the v6
 *      program substrate the moment the program is ready — no LLM call
 *      required for the base render.
 *   2) On `regenerate()`, fires a single LLM synthesis call that authors
 *      executive summary, risks, roadmap, architecture commentary, and
 *      optional per-initiative narrative overlays. The composer overlays
 *      these onto the deterministic projects without changing quadrant
 *      assignments or $ rollups.
 *   3) Persists `{ initiativeRefs, synthesis, narratives }` to the
 *      `cross_tower_ai_plan` row so reload re-renders WYSIWYG without an
 *      LLM round-trip.
 */

export type PlanPersistenceMode =
  | "ok"
  | "unconfigured"
  | "unavailable"
  | "unknown";

export type CrossTowerPlanV6State = {
  status: "idle" | "loading" | "ready" | "error";
  hydratingFromDb: boolean;
  persistenceMode: PlanPersistenceMode;
  projects: AIProjectResolved[];
  buildup: BuildupPoint[];
  kpis: ProjectKpis;
  synthesis: ProgramSynthesisLLMV6 | null;
  narratives: InitiativeNarrativeV6[];
  appliedInputHash: string | null;
  appliedAssumptionsHash: string | null;
  appliedAssumptions: CrossTowerAssumptions | null;
  modelId: string | null;
  promptVersion: string | null;
  generatedAt: string | null;
  errorMessage: string | null;
  warnings: string[];
};

const INITIAL_STATE: CrossTowerPlanV6State = {
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
    towersInScope: 0,
  },
  synthesis: null,
  narratives: [],
  appliedInputHash: null,
  appliedAssumptionsHash: null,
  appliedAssumptions: null,
  modelId: null,
  promptVersion: null,
  generatedAt: null,
  errorMessage: null,
  warnings: [],
};

export type UseCrossTowerPlanV6Args = {
  program: SelectProgramResultV6;
  assumptions: CrossTowerAssumptions;
};

export type UseCrossTowerPlanV6Result = {
  state: CrossTowerPlanV6State;
  regenerate: (opts?: { forceRegenerate?: boolean }) => Promise<void>;
};

export function useCrossTowerPlanV6(
  args: UseCrossTowerPlanV6Args,
): UseCrossTowerPlanV6Result {
  const { program, assumptions } = args;
  const [state, setState] = React.useState<CrossTowerPlanV6State>(INITIAL_STATE);
  const inflightRef = React.useRef<AbortController | null>(null);

  const programRef = React.useRef(program);
  const assumptionsRef = React.useRef(assumptions);
  React.useEffect(() => {
    programRef.current = program;
  }, [program]);
  React.useEffect(() => {
    assumptionsRef.current = assumptions;
  }, [assumptions]);

  // -----------------------------------------------------------------------
  //  Deterministic projects — recompose whenever program/assumptions/
  //  narrative-overlay set changes. No LLM call required for this path.
  // -----------------------------------------------------------------------
  React.useEffect(() => {
    setState((prev) => {
      const composed = composeProjectsV6({
        initiatives: program.initiatives,
        narratives: prev.narratives,
        assumptions,
      });
      const buildup = buildProjectsBuildScale(composed);
      const kpis = summarizeProjects(composed);
      return { ...prev, projects: composed, buildup, kpis };
    });
  }, [program, assumptions]);

  // -----------------------------------------------------------------------
  //  Hydrate from Postgres on mount
  // -----------------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cross-tower-ai-plan/state");
        const json = (await res.json()) as {
          ok?: boolean;
          plan?: PersistedCrossTowerAiPlanV2 | null;
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

        if (!json.plan || !isV2Document(json.plan)) {
          setState((prev) => ({
            ...prev,
            hydratingFromDb: false,
            persistenceMode: "ok",
            warnings: loadExtras.length ? [...prev.warnings, ...loadExtras] : prev.warnings,
          }));
          return;
        }

        const saved = json.plan;
        // Recompose against the live program with saved narratives overlaid.
        const composed = composeProjectsV6({
          initiatives: programRef.current.initiatives,
          narratives: saved.narratives,
          assumptions: saved.appliedAssumptions,
        });
        const buildup = buildProjectsBuildScale(composed);
        const kpis = summarizeProjects(composed);

        setState((prev) => ({
          ...prev,
          hydratingFromDb: false,
          persistenceMode: "ok",
          warnings: loadExtras.length ? [...prev.warnings, ...loadExtras] : prev.warnings,
          status: "ready",
          projects: composed,
          buildup,
          kpis,
          synthesis: saved.synthesis,
          narratives: saved.narratives,
          appliedInputHash: saved.inputHash,
          appliedAssumptionsHash: saved.assumptionsHash,
          appliedAssumptions: saved.appliedAssumptions,
          modelId: saved.modelId || null,
          promptVersion: saved.promptVersion || null,
          generatedAt: saved.generatedAt,
          errorMessage: null,
        }));
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

  const persistSnapshot = React.useCallback(
    (doc: PersistedCrossTowerAiPlanV2) => {
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
    },
    [],
  );

  // -----------------------------------------------------------------------
  //  Regenerate — single LLM synthesis call
  // -----------------------------------------------------------------------
  const fetchPlan = React.useCallback(
    async (opts: { forceRegenerate?: boolean } = {}) => {
      const programNow = programRef.current;
      const assumptionsNow = assumptionsRef.current;
      const assumptionsHash = hashAssumptions(assumptionsNow);

      if (programNow.initiatives.length === 0) {
        const generatedAt = new Date().toISOString();
        const emptyWarnings = [
          "No in-plan initiatives — adjust the threshold in Assumptions or curate AI Solutions on tower pages first.",
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
          version: PERSISTED_CROSS_TOWER_PLAN_VERSION_V2,
          schema: "v6",
          initiativeRefs: [],
          synthesis: null,
          narratives: [],
          modelId: "empty-initiatives",
          promptVersion: CROSS_TOWER_INITIATIVE_PROMPT_VERSION,
          warnings: emptyWarnings,
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
        const synthesisIntakeDigest =
          buildProgramWideTowerIntakeDigest(getAssessProgram()) ?? undefined;
        const towersInScopeForLLM = buildTowersForLLM(programNow.towersInScope);

        const initiativesForLLM = programNow.initiatives.map((row) => {
          const quadrant = quadrantForBuckets(
            programNow.initiatives,
            row,
          );
          return {
            id: row.id,
            towerName: row.towerName,
            l3FamilyName: row.l3Name,
            solutionName: row.solutionName,
            tagline: row.tagline,
            aiRationale: row.aiRationale,
            primaryVendor: row.primaryVendor,
            feasibility: row.feasibility,
            quadrant,
            programTier:
              row.programTier === "Deprioritized" ? "P3" : row.programTier,
          };
        });

        const body = {
          inputHash: programNow.inputHash,
          assumptionsHash,
          initiatives: initiativesForLLM,
          towers: towersInScopeForLLM,
          assumptions: assumptionsNow,
          forceRegenerate: opts.forceRegenerate === true,
          ...(synthesisIntakeDigest ? { synthesisIntakeDigest } : {}),
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
          schema?: string;
          synthesis?: ProgramSynthesisLLMV6 | null;
          narratives?: InitiativeNarrativeV6[];
          modelId?: string;
          promptVersion?: string;
          generatedAt?: string;
          warnings?: string[];
        };
        if (!json.ok) throw new Error("Server returned ok=false");

        const synthesis = json.synthesis ?? null;
        const narratives = json.narratives ?? [];

        const composed = composeProjectsV6({
          initiatives: programNow.initiatives,
          narratives,
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
          narratives,
          appliedInputHash: programNow.inputHash,
          appliedAssumptionsHash: assumptionsHash,
          appliedAssumptions: assumptionsNow,
          modelId: json.modelId ?? null,
          promptVersion: json.promptVersion ?? null,
          generatedAt,
          errorMessage: null,
          warnings: apiWarnings,
        }));

        const initiativeRefs = programNow.initiatives.map((r) => ({
          towerId: r.towerId,
          l3RowId: r.l3RowId,
          id: r.id,
          solutionName: r.solutionName,
        }));

        persistSnapshot({
          version: PERSISTED_CROSS_TOWER_PLAN_VERSION_V2,
          schema: "v6",
          initiativeRefs,
          synthesis,
          narratives,
          modelId: json.modelId ?? "",
          promptVersion: json.promptVersion ?? CROSS_TOWER_INITIATIVE_PROMPT_VERSION,
          warnings: apiWarnings,
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

  React.useEffect(() => {
    return () => {
      inflightRef.current?.abort();
    };
  }, []);

  return { state, regenerate: fetchPlan };
}

/** Type guard — accepts only the v2 (v6) document shape. */
function isV2Document(
  raw: PersistedCrossTowerAiPlanV2 | unknown,
): raw is PersistedCrossTowerAiPlanV2 {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return r.version === PERSISTED_CROSS_TOWER_PLAN_VERSION_V2 && r.schema === "v6";
}

function buildTowersForLLM(
  towersInScope: TowerInScope[],
): { id: string; name: string }[] {
  // Use display names from `towers.ts` for max-fidelity LLM grounding.
  const byId = new Map(allTowers.map((t) => [t.id, t.name]));
  return towersInScope.map((t) => ({
    id: t.id,
    name: byId.get(t.id) ?? t.name,
  }));
}

function quadrantForBuckets(
  all: SelectProgramResultV6["initiatives"],
  row: SelectProgramResultV6["initiatives"][number],
): "Quick Win" | "Strategic Bet" | "Fill-in" | "Deprioritize" {
  const valueScores = all.map((r) => r.aiUsd);
  const valueMedian = median(valueScores);
  const useMedianSplit = all.length >= 2;
  const valueHigh = useMedianSplit
    ? row.aiUsd >= valueMedian
    : row.aiUsd >= 1_000_000;
  const effortLow = row.feasibility === "High";
  if (valueHigh && effortLow) return "Quick Win";
  if (valueHigh && !effortLow) return "Strategic Bet";
  if (!valueHigh && effortLow) return "Fill-in";
  return "Deprioritize";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export type { ProjectKpis, BuildupPoint };
