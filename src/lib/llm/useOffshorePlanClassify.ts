"use client";

import * as React from "react";
import type { CarveOutClass } from "@/lib/offshore/selectOffshorePlan";
import type {
  LLMOffshoreLane,
  LLMOffshoreRowInput,
  LLMOffshoreRowResult,
} from "@/lib/llm/prompts/offshorePlan.v1";

const STORAGE_KEY = "forge.offshorePlanLLM.v1";

export type OffshoreClassifySource = "llm" | "cache" | "heuristic";

export type OffshoreClassifyState = {
  status: "idle" | "loading" | "ready" | "error";
  /** Lane + justification by rowId. Empty until first generation. */
  lanes: Map<string, { lane: CarveOutClass; justification: string }>;
  source: OffshoreClassifySource | null;
  modelId: string | null;
  promptVersion: string | null;
  generatedAt: string | null;
  /** The inputHash the cached lanes were generated against. */
  generatedForInputHash: string | null;
  errorMessage: string | null;
  warning: string | null;
};

const INITIAL_STATE: OffshoreClassifyState = {
  status: "idle",
  lanes: new Map(),
  source: null,
  modelId: null,
  promptVersion: null,
  generatedAt: null,
  generatedForInputHash: null,
  errorMessage: null,
  warning: null,
};

type GenerateInput = {
  inputHash: string;
  rows: LLMOffshoreRowInput[];
  context: {
    primaryGccCity: string;
    secondaryGccCity: string;
    contactCenterHub: string;
  };
  forceRegenerate?: boolean;
  modelId?: string;
};

export type UseOffshorePlanClassifyApi = {
  state: OffshoreClassifyState;
  /** True iff state.generatedForInputHash !== current inputHash (and we have a result). */
  isStale: (currentInputHash: string) => boolean;
  generate: (input: GenerateInput) => Promise<void>;
};

/**
 * Manual-only LLM lifecycle hook for the Offshore Plan classifier. Mirrors
 * `useCrossTowerPlan` — no auto-fire on mount or on inputHash change. The
 * page surfaces a Stale chip when `isStale(currentHash)` is true and the
 * user clicks Regenerate to fire the LLM call.
 *
 * Hydrates from `localStorage[STORAGE_KEY]` on mount so the page renders
 * the previous LLM result on reload without re-firing the call.
 */
export function useOffshorePlanClassify(): UseOffshorePlanClassifyApi {
  const [state, setState] = React.useState<OffshoreClassifyState>(INITIAL_STATE);
  const inflightRef = React.useRef<AbortController | null>(null);

  // Hydrate from localStorage on mount (client-only).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        rows: { rowId: string; lane: CarveOutClass; justification: string }[];
        source: OffshoreClassifySource;
        modelId: string;
        promptVersion: string;
        generatedAt: string;
        generatedForInputHash: string;
        warning: string;
      }>;
      if (!parsed || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return;
      const lanes = new Map<string, { lane: CarveOutClass; justification: string }>();
      for (const r of parsed.rows) {
        if (typeof r?.rowId === "string" && typeof r?.lane === "string") {
          lanes.set(r.rowId, {
            lane: r.lane as CarveOutClass,
            justification: typeof r.justification === "string" ? r.justification : "",
          });
        }
      }
      setState({
        status: "ready",
        lanes,
        source: parsed.source ?? null,
        modelId: parsed.modelId ?? null,
        promptVersion: parsed.promptVersion ?? null,
        generatedAt: parsed.generatedAt ?? null,
        generatedForInputHash: parsed.generatedForInputHash ?? null,
        errorMessage: null,
        warning: parsed.warning ?? null,
      });
    } catch {
      // Corrupt storage — drop it.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const generate = React.useCallback(async (input: GenerateInput) => {
    // Cancel inflight request before starting a new one.
    if (inflightRef.current) inflightRef.current.abort();
    const controller = new AbortController();
    inflightRef.current = controller;

    setState((prev) => ({ ...prev, status: "loading", errorMessage: null }));
    try {
      const res = await fetch("/api/offshore-plan/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputHash: input.inputHash,
          forceRegenerate: input.forceRegenerate === true,
          modelId: input.modelId,
          context: input.context,
          rows: input.rows,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`);
      }
      const json = (await res.json()) as {
        ok?: boolean;
        source?: OffshoreClassifySource;
        rows?: LLMOffshoreRowResult[];
        modelId?: string;
        promptVersion?: string;
        inputHash?: string;
        generatedAt?: string;
        warning?: string;
      };
      if (!json.ok || !Array.isArray(json.rows)) {
        throw new Error("Server returned ok=false or missing rows");
      }
      const lanes = new Map<string, { lane: CarveOutClass; justification: string }>();
      for (const r of json.rows) {
        lanes.set(r.rowId, {
          lane: laneToCarveOutClass(r.lane),
          justification: r.justification,
        });
      }
      const generatedForInputHash = json.inputHash ?? input.inputHash;
      const generatedAt = json.generatedAt ?? new Date().toISOString();
      const next: OffshoreClassifyState = {
        status: "ready",
        lanes,
        source: json.source ?? "heuristic",
        modelId: json.modelId ?? null,
        promptVersion: json.promptVersion ?? null,
        generatedAt,
        generatedForInputHash,
        errorMessage: null,
        warning: json.warning ?? null,
      };
      setState(next);
      persist(next, json.rows);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: e instanceof Error ? e.message : "Unknown error",
      }));
    } finally {
      if (inflightRef.current === controller) inflightRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      inflightRef.current?.abort();
    };
  }, []);

  const isStale = React.useCallback(
    (currentInputHash: string) => {
      if (state.status !== "ready") return false;
      if (!state.generatedForInputHash) return false;
      return state.generatedForInputHash !== currentInputHash;
    },
    [state.status, state.generatedForInputHash],
  );

  return { state, isStale, generate };
}

function laneToCarveOutClass(lane: LLMOffshoreLane): CarveOutClass {
  switch (lane) {
    case "GccEligible":
      return "GccEligible";
    case "GccWithOverlay":
      return "GccWithOverlay";
    case "OnshoreRetained":
      return "OnshoreRetained";
  }
}

function persist(state: OffshoreClassifyState, rows: LLMOffshoreRowResult[]) {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      rows: rows.map((r) => ({
        rowId: r.rowId,
        lane: laneToCarveOutClass(r.lane),
        justification: r.justification,
      })),
      source: state.source,
      modelId: state.modelId,
      promptVersion: state.promptVersion,
      generatedAt: state.generatedAt,
      generatedForInputHash: state.generatedForInputHash,
      warning: state.warning,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore — quota or permissions */
  }
}
