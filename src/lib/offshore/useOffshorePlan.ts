"use client";

import * as React from "react";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import {
  selectOffshorePlan,
  type CarveOutClass,
  type OffshorePlanResult,
} from "@/lib/offshore/selectOffshorePlan";
import type { AssessProgramV2 } from "@/data/assess/types";

export type UseOffshorePlanOptions = {
  /**
   * Optional LLM-lane overlay produced by `useOffshorePlanClassify`. When
   * provided, non-carved-out rows pick up the LLM lane + justification.
   */
  llmLanes?: ReadonlyMap<string, { lane: CarveOutClass; justification: string }>;
};

/**
 * Subscribe to `forge.assessProgram.v2` and recompute the Offshore Plan
 * substrate whenever the program changes. SSR-safe — seeds with the
 * hydration snapshot so the first client render matches the static SSR
 * HTML, then swaps to the persisted program inside `useEffect`. Mirrors
 * `useProgramInitiatives` exactly so Step 4 and Step 5 stay in lockstep.
 *
 * The selector reads `program.offshoreAssumptions` directly off the
 * subscribed program, so location changes from the Assumptions tab
 * propagate through the same store -> selector -> render path that drives
 * carve-out edits.
 */
export function useOffshorePlan(
  options: UseOffshorePlanOptions = {},
): OffshorePlanResult & { program: AssessProgramV2 } {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  const llmLanes = options.llmLanes;
  const result = React.useMemo(
    () => selectOffshorePlan(program, { llmLanes }),
    [program, llmLanes],
  );
  return React.useMemo(() => ({ ...result, program }), [result, program]);
}
