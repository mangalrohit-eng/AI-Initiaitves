"use client";

import * as React from "react";
import type { StrategistOutputs } from "@/lib/strategist/types";
import {
  buildStrategistInput,
  type StrategistInputAndHash,
} from "@/lib/strategist/buildStrategistInput";
import type { BaseScope } from "@/lib/scope/baseScope";
import { getAssessProgram, subscribe } from "@/lib/localStore";

export type StrategistApiSource = "llm" | "cache" | "stub";

export type StrategistState = {
  status: "idle" | "loading" | "ready" | "error";
  outputs: StrategistOutputs | null;
  source: StrategistApiSource | null;
  modelId: string | null;
  promptVersion: string | null;
  generatedAt: string | null;
  generatedForInputHash: string | null;
  errorMessage: string | null;
  warnings: string[];
};

const INITIAL_STATE: StrategistState = {
  status: "idle",
  outputs: null,
  source: null,
  modelId: null,
  promptVersion: null,
  generatedAt: null,
  generatedForInputHash: null,
  errorMessage: null,
  warnings: [],
};

const STORAGE_KEY = "forge.strategistOutputs.v1";

/** Read the most recently persisted strategist outputs, if any. */
export function readPersistedStrategistOutputs(): StrategistOutputs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { outputs?: StrategistOutputs };
    return parsed?.outputs ?? null;
  } catch {
    return null;
  }
}

/** SSR-safe read-only subscription to the persisted strategist outputs. */
export function useReadPersistedStrategistOutputs(): StrategistOutputs | null {
  const [outputs, setOutputs] = React.useState<StrategistOutputs | null>(() =>
    readPersistedStrategistOutputs(),
  );
  React.useEffect(() => {
    setOutputs(readPersistedStrategistOutputs());
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setOutputs(readPersistedStrategistOutputs());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return outputs;
}

function persist(state: StrategistState) {
  if (typeof window === "undefined") return;
  try {
    if (!state.outputs) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        outputs: state.outputs,
        source: state.source,
        warnings: state.warnings,
      }),
    );
  } catch {
    /* ignore */
  }
}

function hydrate(): StrategistState {
  if (typeof window === "undefined") return INITIAL_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<{
      outputs: StrategistOutputs;
      source: StrategistApiSource;
      warnings: string[];
    }>;
    if (!parsed?.outputs) return INITIAL_STATE;
    return {
      status: "ready",
      outputs: parsed.outputs,
      source: parsed.source ?? null,
      modelId: parsed.outputs.modelId,
      promptVersion: parsed.outputs.promptVersion,
      generatedAt: parsed.outputs.generatedAt,
      generatedForInputHash: parsed.outputs.inputHash,
      errorMessage: null,
      warnings: parsed.warnings ?? [],
    };
  } catch {
    return INITIAL_STATE;
  }
}

export type UseStrategistOutputsApi = {
  state: StrategistState;
  /** Build & POST against /api/cross-tower-ai-plan/strategist for the active scope. */
  generate: (opts?: { forceRegenerate?: boolean }) => Promise<void>;
  /** True iff a generated payload exists but its inputHash no longer matches the live program. */
  isStale: boolean;
  /** Current build hash for the live program + scope. */
  currentInputHash: string | null;
};

/**
 * Manual-only LLM lifecycle hook for the strategist run. No auto-fire on
 * mount. Mirrors the lifecycle pattern of `useCrossTowerPlanV6` and
 * `useOffshorePlanClassify`.
 */
export function useStrategistOutputs(scope: BaseScope): UseStrategistOutputsApi {
  const [state, setState] = React.useState<StrategistState>(() => hydrate());
  const [currentInputHash, setCurrentInputHash] = React.useState<string | null>(
    null,
  );
  const inflightRef = React.useRef<AbortController | null>(null);
  const builtRef = React.useRef<StrategistInputAndHash | null>(null);

  // Recompute the live program input hash whenever program state or
  // scope changes — so the page can flag "stale vs the generated run".
  React.useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const built = await buildStrategistInput(getAssessProgram(), scope);
        if (cancelled) return;
        builtRef.current = built;
        setCurrentInputHash(built.inputHash);
      } catch {
        if (cancelled) return;
        builtRef.current = null;
        setCurrentInputHash(null);
      }
    };
    void refresh();
    const unsub = subscribe("assessProgram", () => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [scope]);

  const generate = React.useCallback(
    async (opts?: { forceRegenerate?: boolean }) => {
      if (inflightRef.current) inflightRef.current.abort();
      const controller = new AbortController();
      inflightRef.current = controller;
      setState((prev) => ({ ...prev, status: "loading", errorMessage: null }));
      try {
        const built = builtRef.current
          ? builtRef.current
          : await buildStrategistInput(getAssessProgram(), scope);
        const res = await fetch("/api/cross-tower-ai-plan/strategist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputHash: built.inputHash,
            forceRegenerate: opts?.forceRegenerate === true,
            input: built.input,
          }),
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
          source?: StrategistApiSource;
          outputs?: StrategistOutputs | null;
          modelId?: string;
          promptVersion?: string;
          generatedAt?: string;
          warnings?: string[];
        };
        const outputs = json.outputs ?? null;
        const next: StrategistState = {
          status: "ready",
          outputs,
          source: json.source ?? null,
          modelId: json.modelId ?? outputs?.modelId ?? null,
          promptVersion: json.promptVersion ?? outputs?.promptVersion ?? null,
          generatedAt: json.generatedAt ?? outputs?.generatedAt ?? null,
          generatedForInputHash: outputs?.inputHash ?? built.inputHash,
          errorMessage: null,
          warnings: json.warnings ?? [],
        };
        setState(next);
        persist(next);
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
    },
    [scope],
  );

  React.useEffect(() => {
    return () => {
      inflightRef.current?.abort();
    };
  }, []);

  const isStale =
    state.status === "ready" &&
    state.generatedForInputHash != null &&
    currentInputHash != null &&
    state.generatedForInputHash !== currentInputHash;

  return { state, generate, isStale, currentInputHash };
}
