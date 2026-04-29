import type { TowerAssessState } from "@/data/assess/types";

/**
 * L1–L3 validation was explicitly confirmed in the journey bar. While set, map
 * and headcount editing is locked until the user unlocks (or replaces data).
 */
export function isL1L3TreeLocked(t: TowerAssessState | undefined): boolean {
  return t?.l1L3TreeValidatedAt != null;
}

/**
 * Green check for "Capability map" in [`TowerJourneyStepper`]: user confirmed
 * L1–L3 in the bar, or legacy program where the tower is already
 * `status === "complete"` (tower-lead sign-off on Configure Impact Levers)
 * before this field existed.
 */
export function isCapabilityMapJourneyStepDone(
  t: TowerAssessState | undefined,
): boolean {
  if (!t) return false;
  if (t.l1L3TreeValidatedAt != null) return true;
  if (t.status === "complete") return true;
  return false;
}
