"use client";

import * as React from "react";
import { getAssessProgram, getAssessProgramHydrationSnapshot, subscribe } from "@/lib/localStore";
import {
  selectInitiativesForTower,
  type SelectInitiativesResult,
} from "@/lib/initiatives/select";
import type { Tower } from "@/data/types";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";

/**
 * Subscribe to `forge.assessProgram.v2` and recompute the AI Initiatives
 * view-models for one tower whenever the program changes. Returns a stable
 * `SelectInitiativesResult` whose per-L3 $ stays in lockstep with Step 2.
 *
 * Both `OperatingModelSection` and `AiRoadmap` call this hook independently —
 * the selector is a pure function and runs in microseconds, so duplicate calls
 * cost nothing while keeping the components decoupled.
 *
 * SSR-safety: the tower page is statically pre-rendered, so the server HTML
 * is generated against the seeded baseline (no `localStorage`). To keep the
 * first client render identical to that HTML — and avoid the React hydration
 * "Text content did not match" error when a user has edited Step 2 dials —
 * we seed initial state with `getAssessProgramHydrationSnapshot()` (same as
 * a cold workshop with no `localStorage` entry), then swap in the persisted
 * program inside `useEffect` after hydration completes.
 */
export function useTowerInitiatives(tower: Tower): SelectInitiativesResult {
  const [program, setProgram] = React.useState<AssessProgramV2>(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(
    () => selectInitiativesForTower(tower.id as TowerId, program, tower),
    [tower, program],
  );
}
