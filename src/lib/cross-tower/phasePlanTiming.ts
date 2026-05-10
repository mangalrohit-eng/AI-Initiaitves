/**
 * Cross-Tower AI Plan — program-tier (P1/P2/P3) timing helpers.
 *
 * Each helper is a pure function of `(assumptions, tier)` so the v6
 * composer can sequence projects deterministically off the program tier
 * already stamped on `ProgramInitiativeRowV6`.
 */

import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";

export type ComposePlanTier = "P1" | "P2" | "P3";

export function phaseStartMonthForTier(
  a: CrossTowerAssumptions,
  tier: ComposePlanTier,
): number {
  if (tier === "P1") return a.p1PhaseStartMonth;
  if (tier === "P2") return a.p2PhaseStartMonth;
  return a.p3PhaseStartMonth;
}

export function buildMonthsForTier(
  a: CrossTowerAssumptions,
  tier: ComposePlanTier,
): number {
  if (tier === "P1") return a.p1BuildMonths;
  if (tier === "P2") return a.p2BuildMonths;
  return a.p3BuildMonths;
}

/** First month of in-plan work for this tier, anchored to `programStartMonth`. */
export function effectiveProjectStartMonth(
  a: CrossTowerAssumptions,
  tier: ComposePlanTier,
): number {
  const phaseAnchor = phaseStartMonthForTier(a, tier);
  return Math.max(1, a.programStartMonth + (phaseAnchor - 1));
}
