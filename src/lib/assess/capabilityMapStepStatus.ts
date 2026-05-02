import type { TowerAssessState } from "@/data/assess/types";

/**
 * L1–L5 capability-map validation was explicitly confirmed in the journey
 * bar. While set, map and headcount editing is locked until the user
 * unlocks (or replaces data).
 *
 * Reads either the new V5 timestamp (`l1L5TreeValidatedAt`) or the legacy
 * V4 alias (`l1L3TreeValidatedAt`) so workshops mid-cutover stay locked.
 */
export function isL1L5TreeLocked(t: TowerAssessState | undefined): boolean {
  return (
    (t?.l1L5TreeValidatedAt ?? t?.l1L3TreeValidatedAt) != null
  );
}

/**
 * @deprecated Renamed to `isL1L5TreeLocked` in the 5-layer migration. Kept
 * as a passthrough so any caller pinned to the old name still compiles.
 */
export const isL1L3TreeLocked = isL1L5TreeLocked;

/**
 * Green check for "Capability map" in [`TowerJourneyStepper`]: user confirmed
 * the L1–L5 review in the bar. Decoupled from `status === "complete"` (the
 * Step 2 sign-off) so invalidating Step 1 actually reopens Step 1 regardless
 * of Step 2 state. Legacy workshops that only have Step 2 complete are
 * backfilled at read time by `parseTowerAssessState` in `localStore.ts`,
 * which stamps `l1L5TreeValidatedAt` from `capabilityMapConfirmedAt` /
 * `lastUpdated` so their green check survives the migration.
 */
export function isCapabilityMapJourneyStepDone(
  t: TowerAssessState | undefined,
): boolean {
  if (!t) return false;
  if (t.l1L5TreeValidatedAt != null) return true;
  if (t.l1L3TreeValidatedAt != null) return true;
  return false;
}
