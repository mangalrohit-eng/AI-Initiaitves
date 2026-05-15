import type { TowerAssessState } from "@/data/assess/types";

/**
 * Step 2 (Offshore View) lock state. When the lead has marked Step 2 done,
 * lane edits and file uploads are disabled until explicit unlock. Mirrors
 * the lock pattern used by `isL1L5TreeLocked` for Step 1.
 */
export function isOffshoreClassificationLocked(
  t: TowerAssessState | undefined,
): boolean {
  return t?.offshoreViewValidatedAt != null;
}

/**
 * Green check for "Offshore View" in `TowerJourneyStepper` — the lead has
 * confirmed every L4 row's lane decision and marked Step 2 done.
 */
export function isOffshoreViewJourneyStepDone(
  t: TowerAssessState | undefined,
): boolean {
  return t?.offshoreViewValidatedAt != null;
}

/**
 * Returns true when the Step 1 capability map has changed after Step 2 was
 * last locked. Triggers the stale banner + a Refresh AI suggestions nudge.
 *
 * Detection strategy: if Step 1 has a later `l1L5TreeValidatedAt` than the
 * Step 2 `offshoreViewValidatedAt`, the lead re-confirmed Step 1 after
 * locking Step 2 — the offshore split may no longer cover every row.
 */
export function isClassificationStale(
  t: TowerAssessState | undefined,
): boolean {
  if (!t || t.offshoreViewValidatedAt == null) return false;
  const step1At = t.l1L5TreeValidatedAt ?? t.l1L3TreeValidatedAt;
  if (step1At == null) return false;
  return step1At > t.offshoreViewValidatedAt;
}

/**
 * Count of rows still awaiting an explicit `gccPct` decision — drives the
 * tower-lead footer counter and the "Mark Step 2 done" enable state.
 *
 * A row is "reviewed" when its `gccPctSource` is anything other than
 * `"seed"` (the auto-derived seed value). `"ai"` counts as reviewed because
 * the lead has at least accepted the AI suggestion. `"user"` and
 * `"upload"` are explicit lead decisions.
 */
export function countUnreviewedOffshoreRows(
  t: TowerAssessState | undefined,
): number {
  if (!t) return 0;
  let n = 0;
  for (const r of t.l4Rows ?? []) {
    if (!r.gccPctSource || r.gccPctSource === "seed") n += 1;
  }
  return n;
}
