"use client";

import * as React from "react";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import {
  selectInitiativesV6ForProgram,
  type SelectProgramResultV6,
} from "@/lib/initiatives/selectV6Program";
import type { AssessProgramV2 } from "@/data/assess/types";

/**
 * Subscribe to `forge.assessProgram.v2` and recompute the cross-tower
 * substrate whenever the program changes. Seeds with the hydration
 * snapshot so the first client render matches the static SSR HTML, then
 * swaps to the persisted program inside `useEffect`.
 */
export function useProgramInitiativesV6(
  aiUsdThreshold = 0,
): SelectProgramResultV6 {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(
    () => selectInitiativesV6ForProgram(program, { aiUsdThreshold }),
    [program, aiUsdThreshold],
  );
}
