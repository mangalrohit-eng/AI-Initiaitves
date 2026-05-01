import type { AssessProgramV2, L3WorkforceRow, TowerId } from "@/data/assess/types";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import { towers } from "@/data/towers";
import {
  definitionToViewModel,
  inferCapabilityViewFromRows,
  type CapabilityMapViewModel,
} from "@/lib/assess/capabilityMapTree";

export type CapabilityCounts = {
  /** L1 Function — always 1 (the tower itself) when any deeper nodes exist. */
  l1: number;
  /** L2 Job Grouping. */
  l2: number;
  /** L3 Job Family. */
  l3: number;
  /** L4 Activity Group — the dial-bearing rung. */
  l4: number;
  /** L5 Activity — leaf rung; AI initiatives attach here. */
  l5: number;
};

/**
 * Counts L1 / L2 / L3 / L4 / L5 nodes for a tower under the V5 capability
 * map. Resolution order — uploaded rows are the source of truth; the
 * per-tower predefined map is only a seed/preview:
 *
 *   1. If the user has loaded any footprint rows, infer L1-L4 from those
 *      rows and L5 from each row's `l5Activities` reference list.
 *   2. Otherwise, fall back to the predefined canonical map.
 *   3. Otherwise, zeroes (no map yet — coverage starts at the L1
 *      placeholder).
 *
 * The L1 count is 1 whenever any L2 Job Grouping exists; this matches the
 * visual "tower = L1" framing used in `CapabilityMapPanel`.
 */
export function towerCapabilityCounts(
  towerId: TowerId,
  rows: L3WorkforceRow[],
): CapabilityCounts {
  const tower = towers.find((t) => t.id === towerId);
  if (!tower) return { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0 };
  const def = getCapabilityMapForTower(towerId);
  const view: CapabilityMapViewModel =
    rows.length > 0
      ? inferCapabilityViewFromRows(tower.name, rows)
      : def
        ? definitionToViewModel(def)
        : { l1Name: tower.name, l2: [] };
  return countView(view);
}

function countView(view: CapabilityMapViewModel): CapabilityCounts {
  let l3 = 0;
  let l4 = 0;
  let l5 = 0;
  for (const l2 of view.l2) {
    for (const l3Node of l2.l3) {
      l3 += 1;
      for (const l4Node of l3Node.l4) {
        l4 += 1;
        l5 += l4Node.l5.length;
      }
    }
  }
  return {
    l1: view.l2.length > 0 ? 1 : 0,
    l2: view.l2.length,
    l3,
    l4,
    l5,
  };
}

/**
 * Sum L1 / L2 / L3 / L4 / L5 across the program for the rolled-up
 * scoreboard. Only towers that have either uploaded rows or a canonical
 * map contribute.
 */
export function programCapabilityCounts(state: AssessProgramV2): CapabilityCounts & {
  /** Number of towers contributing to the count (those with rows or a canonical map). */
  contributingTowers: number;
} {
  let l1 = 0;
  let l2 = 0;
  let l3 = 0;
  let l4 = 0;
  let l5 = 0;
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
    l5 += c.l5;
    contributing += 1;
  }
  return { l1, l2, l3, l4, l5, contributingTowers: contributing };
}

/**
 * Program-wide headcount roll-up. Sums onshore + offshore FTE and onshore +
 * offshore contractor across every L4 Activity Group row in every tower.
 * Used by the Capability Map program scoreboard to render the modeled total
 * alongside the gap vs Versant's reported 3,748 employees.
 *
 * Note: contractors are tracked separately because the Versant CSV is
 * employees only — the gap-vs-Versant comparison should use FTE only.
 */
export function programHeadcountTotals(state: AssessProgramV2): {
  fte: number;
  contractor: number;
  total: number;
} {
  let fte = 0;
  let contractor = 0;
  for (const t of towers) {
    const rows = state.towers[t.id]?.l4Rows ?? [];
    for (const r of rows) {
      fte += (r.fteOnshore || 0) + (r.fteOffshore || 0);
      contractor += (r.contractorOnshore || 0) + (r.contractorOffshore || 0);
    }
  }
  return { fte, contractor, total: fte + contractor };
}

/**
 * Footprint coverage — how many of the L4 Activity Group rows carry
 * non-zero headcount or spend in the current data. Used by the Capability
 * Map scoreboards to show "how confirmed is the footprint?" without
 * relying on the user's explicit reviewedAt stamps.
 *
 * Field names are kept as `confirmedL3s` / `totalL3s` for back-compat with
 * existing callers, but semantically describe the V5 L4 Activity Group
 * rung — the unit one row represents in the post-migration map.
 */
export function towerFootprintCoverage(
  towerId: TowerId,
  rows: L3WorkforceRow[],
): { confirmedL3s: number; totalL3s: number } {
  const counts = towerCapabilityCounts(towerId, rows);
  const totalL3s = counts.l4;
  let confirmed = 0;
  for (const r of rows) {
    const hc =
      (r.fteOnshore || 0) +
      (r.fteOffshore || 0) +
      (r.contractorOnshore || 0) +
      (r.contractorOffshore || 0);
    if (hc > 0 || (r.annualSpendUsd ?? 0) > 0) confirmed += 1;
  }
  return { confirmedL3s: Math.min(confirmed, totalL3s), totalL3s };
}
