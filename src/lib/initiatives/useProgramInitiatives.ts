"use client";

import * as React from "react";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import {
  selectInitiativesForProgram,
  type SelectProgramResult,
} from "@/lib/initiatives/selectProgram";
import type { AssessProgramV2 } from "@/data/assess/types";

/**
 * Subscribe to `forge.assessProgram.v2` and recompute the cross-tower AI plan
 * substrate whenever the program changes. Mirrors the SSR-safe pattern of
 * `useTowerInitiatives()` — seeds with the hydration snapshot so the first
 * client render matches the static SSR HTML, then swaps to the persisted
 * program inside `useEffect`.
 *
 * `aiUsdThreshold` filters initiatives below the threshold out of plan —
 * they're treated as opportunistic. Default 0 = no filter.
 *
 * Memoized on `(program, aiUsdThreshold)` so re-renders triggered by an
 * unrelated localStore change don't re-execute the 13-tower selector loop.
 */
export function useProgramInitiatives(
  aiUsdThreshold = 0,
): SelectProgramResult {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(
    () => selectInitiativesForProgram(program, { aiUsdThreshold }),
    [program, aiUsdThreshold],
  );
}
