import type { AssessProgramV2, L4WorkforceRow, TowerId } from "@/data/assess/types";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import { towers } from "@/data/towers";
import {
  definitionToViewModel,
  inferCapabilityViewFromRows,
  type CapabilityMapViewModel,
} from "@/lib/assess/capabilityMapTree";

export type CapabilityCounts = {
  /** L1 always counts as 1 (the tower itself). */
  l1: number;
  l2: number;
  l3: number;
  l4: number;
};

/**
 * Counts L1 / L2 / L3 / L4 nodes for a tower.
 *
 * Resolution order — same as the rest of the assess module:
 *   1. Canonical capability map definition for the tower (when one exists).
 *   2. Otherwise, structure inferred from the user's footprint rows.
 *   3. Otherwise, zeroes (no map yet — coverage starts at the L1 placeholder).
 *
 * The L1 count is 1 whenever any L2 nodes exist; this matches the visual
 * "tower = L1" framing used in `CapabilityMapPanel`.
 */
export function towerCapabilityCounts(towerId: TowerId, rows: L4WorkforceRow[]): CapabilityCounts {
  const tower = towers.find((t) => t.id === towerId);
  if (!tower) return { l1: 0, l2: 0, l3: 0, l4: 0 };
  const def = getCapabilityMapForTower(towerId);
  const view: CapabilityMapViewModel = def
    ? definitionToViewModel(def)
    : inferCapabilityViewFromRows(tower.name, rows);
  return countView(view);
}

function countView(view: CapabilityMapViewModel): CapabilityCounts {
  let l3 = 0;
  let l4 = 0;
  for (const l2 of view.l2) {
    for (const l3Node of l2.l3) {
      l3 += 1;
      l4 += l3Node.l4.length;
    }
  }
  return {
    l1: view.l2.length > 0 ? 1 : 0,
    l2: view.l2.length,
    l3,
    l4,
  };
}

/** Sum L1 / L2 / L3 / L4 across the program for the rolled-up scoreboard. */
export function programCapabilityCounts(state: AssessProgramV2): CapabilityCounts & {
  /** Number of towers contributing to the count (those with rows or a canonical map). */
  contributingTowers: number;
} {
  let l1 = 0;
  let l2 = 0;
  let l3 = 0;
  let l4 = 0;
  let contributing = 0;
  for (const t of towers) {
    const rows = state.towers[t.id]?.l4Rows ?? [];
    const hasMap = Boolean(getCapabilityMapForTower(t.id));
    if (rows.length === 0 && !hasMap) continue;
    const c = towerCapabilityCounts(t.id, rows);
    if (c.l2 === 0) continue;
    l1 += c.l1;
    l2 += c.l2;
    l3 += c.l3;
    l4 += c.l4;
    contributing += 1;
  }
  return { l1, l2, l3, l4, contributingTowers: contributing };
}

/**
 * Footprint coverage — how many of the canonical L4s have non-zero headcount or
 * spend in the current rows. Used by Capability Map scoreboards to show "how
 * confirmed are we?" without relying on the user's explicit reviewedAt stamps.
 */
export function towerFootprintCoverage(
  towerId: TowerId,
  rows: L4WorkforceRow[],
): { confirmedL4s: number; totalL4s: number } {
  const counts = towerCapabilityCounts(towerId, rows);
  const totalL4s = counts.l4;
  let confirmed = 0;
  for (const r of rows) {
    const hc =
      (r.fteOnshore || 0) +
      (r.fteOffshore || 0) +
      (r.contractorOnshore || 0) +
      (r.contractorOffshore || 0);
    if (hc > 0 || (r.annualSpendUsd ?? 0) > 0) confirmed += 1;
  }
  return { confirmedL4s: Math.min(confirmed, totalL4s), totalL4s };
}
