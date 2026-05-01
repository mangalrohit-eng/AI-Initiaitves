"use client";

import * as React from "react";
import type {
  ProgramArchitecture,
  ProgramInitiativeRow,
  SelectProgramResult,
  TowerInScope,
} from "@/lib/initiatives/selectProgram";
import type {
  CrossTowerAiPlanLLM,
  PromptDeprioritizedInitiative,
  PromptKeyInitiative,
} from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import type { Tier } from "@/lib/priority";

export type PlanFetchSource = "llm" | "cache" | "deterministic";

export type PlanFetchState = {
  status: "idle" | "loading" | "ready" | "error";
  /** When status is `ready`, the LLM-authored plan (or null on deterministic-only). */
  plan: CrossTowerAiPlanLLM | null;
  source: PlanFetchSource | null;
  modelId: string | null;
  promptVersion: string | null;
  /** Local time of last successful generation. */
  generatedAt: string | null;
  inputHash: string | null;
  /** Whether the response indicated narrative is unavailable. */
  narrativeUnavailable: boolean;
  /** Network/server error message when status is `error`. */
  errorMessage: string | null;
  /** Optional warning surfaced from the server (e.g. fallback reason). */
  warning: string | null;
};

const INITIAL_STATE: PlanFetchState = {
  status: "idle",
  plan: null,
  source: null,
  modelId: null,
  promptVersion: null,
  generatedAt: null,
  inputHash: null,
  narrativeUnavailable: false,
  errorMessage: null,
  warning: null,
};

type GenerateOptions = {
  forceRegenerate?: boolean;
  modelId?: string;
};

/**
 * Manages the lifecycle of the GPT-5.5 plan generation for the Cross-Tower
 * AI Plan page. Stateful — keeps the latest plan in React state so the page
 * can render LLM-authored regions immediately on subsequent renders.
 *
 * Manual-only: the hook does NOT auto-fire on mount or on `inputHash`
 * changes. The page is responsible for surfacing a "stale" or "first run"
 * nudge so the user knows when to click Regenerate. Reasoning: workshop
 * usage patterns (rapid threshold/dial nudging) made auto-fire spend tokens
 * on intermediate states the user never sees. Click is the single source of
 * generation intent.
 */
export function useCrossTowerPlan(
  program: SelectProgramResult,
): {
  state: PlanFetchState;
  regenerate: (opts?: GenerateOptions) => Promise<void>;
} {
  const [state, setState] = React.useState<PlanFetchState>(INITIAL_STATE);
  const inflightControllerRef = React.useRef<AbortController | null>(null);

  const fetchPlan = React.useCallback(
    async (opts: GenerateOptions = {}) => {
      // Cancel any in-flight request before starting a new one.
      if (inflightControllerRef.current) {
        inflightControllerRef.current.abort();
      }
      const controller = new AbortController();
      inflightControllerRef.current = controller;

      setState((prev) => ({ ...prev, status: "loading", errorMessage: null }));
      try {
        const body = {
          inputHash: program.inputHash,
          prompt: buildPromptPayload(program),
          forceRegenerate: opts.forceRegenerate === true,
          modelId: opts.modelId,
        };
        const res = await fetch("/api/cross-tower-ai-plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`);
        }
        const json = (await res.json()) as {
          ok?: boolean;
          source?: PlanFetchSource;
          plan?: CrossTowerAiPlanLLM | null;
          modelId?: string;
          promptVersion?: string;
          generatedAt?: string;
          inputHash?: string;
          narrativeUnavailable?: boolean;
          warning?: string;
        };
        if (!json.ok) {
          throw new Error("Server returned ok=false");
        }
        setState({
          status: "ready",
          plan: json.plan ?? null,
          source: json.source ?? "deterministic",
          modelId: json.modelId ?? null,
          promptVersion: json.promptVersion ?? null,
          generatedAt: json.generatedAt ?? new Date().toISOString(),
          inputHash: json.inputHash ?? program.inputHash,
          narrativeUnavailable: json.narrativeUnavailable === true,
          errorMessage: null,
          warning: json.warning ?? null,
        });
      } catch (e) {
        // Aborted requests are not surfaced as errors.
        if ((e as { name?: string })?.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: e instanceof Error ? e.message : "Unknown error",
        }));
      } finally {
        if (inflightControllerRef.current === controller) {
          inflightControllerRef.current = null;
        }
      }
    },
    [program],
  );

  // Cleanup any in-flight request on unmount.
  React.useEffect(() => {
    return () => {
      inflightControllerRef.current?.abort();
    };
  }, []);

  return { state, regenerate: fetchPlan };
}

// ---------------------------------------------------------------------------
//   Helpers
// ---------------------------------------------------------------------------

/**
 * Compress the deterministic program substrate into the prompt payload the
 * server route grounds the LLM with. We deliberately strip rich `Process`
 * objects — only the surface the LLM is allowed to author against goes
 * across the wire.
 */
function buildPromptPayload(program: SelectProgramResult): {
  initiatives: PromptKeyInitiative[];
  phaseMembership: Record<string, Tier | null>;
  deprioritized: PromptDeprioritizedInitiative[];
  towersInScope: { id: string; name: string; initiativeCount: number }[];
  vendorStack: { vendor: string; count: number }[];
  orchestrationMix: { pattern: string; count: number }[];
} {
  const initiatives: PromptKeyInitiative[] = program.initiatives
    .slice(0, 80) // hard cap — keeps prompts tight even with rich tower data
    .map((row: ProgramInitiativeRow) => ({
      id: row.id,
      towerName: row.towerName,
      name: row.name,
      capabilityPath: `${row.l2Name} / ${row.l3Name}`,
      tier: row.tier,
      programTierReason: row.programTierReason,
      aiPriority: row.aiPriority,
      rationale: row.aiRationale,
    }));
  const phaseMembership: Record<string, Tier | null> = {};
  for (const row of initiatives) phaseMembership[row.id] = row.tier;
  const deprioritized: PromptDeprioritizedInitiative[] = program.deprioritized
    .slice(0, 30)
    .map((row) => ({
      id: row.id,
      towerName: row.towerName,
      name: row.name,
      capabilityPath: `${row.l2Name} / ${row.l3Name}`,
      programTierReason: row.programTierReason,
    }));
  const towersInScope = (program.towersInScope as TowerInScope[]).map((t) => ({
    id: t.id,
    name: t.name,
    initiativeCount: t.initiativeCount,
  }));
  const arch: ProgramArchitecture = program.architecture;
  return {
    initiatives,
    phaseMembership,
    deprioritized,
    towersInScope,
    vendorStack: arch.vendorStack.map((v) => ({ vendor: v.vendor, count: v.count })),
    orchestrationMix: arch.orchestrationMix.map((o) => ({ pattern: o.pattern, count: o.count })),
  };
}
