/**
 * Cross-Tower AI Plan — program-tier (P1/P2/P3) timing for composed projects.
 *
 * Tier comes from deterministic `ProgramInitiativeRow.programTier` on cohort
 * constituents. Tie-break (mixed tiers on one L4): highest `programTierRank`
 * wins so the cohort uses the latest start + longest default-build path.
 */

import type { ProgramTier } from "@/data/types";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type { ProgramInitiativeRow } from "@/lib/initiatives/selectProgram";
import { programTierRank } from "@/lib/programTierLabels";

export type ComposePlanTier = "P1" | "P2" | "P3";

const ACTIVE: readonly ComposePlanTier[] = ["P1", "P2", "P3"];

function isComposePlanTier(t: ProgramTier): t is ComposePlanTier {
  return (ACTIVE as readonly ProgramTier[]).includes(t);
}

/**
 * Resolve cohort program tier for Gantt / value-curve timing.
 * Empty or stub-only cohorts → P1 (earliest window).
 */
export function resolveTierFromConstituents(
  constituents: ProgramInitiativeRow[],
): ComposePlanTier {
  let best: ComposePlanTier = "P1";
  let bestRank = -1;
  for (const row of constituents) {
    const t = row.programTier;
    if (!isComposePlanTier(t)) continue;
    const r = programTierRank(t);
    if (r > bestRank) {
      bestRank = r;
      best = t;
    }
  }
  return best;
}

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
