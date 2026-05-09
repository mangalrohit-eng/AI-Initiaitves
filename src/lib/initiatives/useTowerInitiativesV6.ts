"use client";

import * as React from "react";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import {
  selectInitiativesV6ForTower,
  type SelectInitiativesV6Result,
} from "@/lib/initiatives/selectV6";
import type { Tower } from "@/data/types";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";

/**
 * v6 sibling of `useTowerInitiatives` — subscribes to the live program
 * and recomputes the L3-grain AI Initiatives view-model whenever the
 * program changes.
 *
 * Always returns a stable `SelectInitiativesV6Result`. Under the v6
 * schema the program already carries `tState.l3Rows`; under v5 (or
 * mid-migration before `l3Rows` derives) the result is empty and the
 * caller should fall back to the v5 hook.
 *
 * SSR-safety mirrors the v5 hook: hydrate from
 * `getAssessProgramHydrationSnapshot()` (no `localStorage`) and swap in
 * the persisted program inside `useEffect` so the first client render
 * matches the server HTML.
 */
export function useTowerInitiativesV6(tower: Tower): SelectInitiativesV6Result {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(
    () => selectInitiativesV6ForTower(tower.id as TowerId, program, tower),
    [tower, program],
  );
}
