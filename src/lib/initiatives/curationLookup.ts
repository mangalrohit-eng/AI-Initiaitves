/**
 * Canonical capability-map walk for reports and offline analysis.
 * Per-L4 feasibility (Ship-ready / Investigate) and curation detail for the
 * tower journey are shown on AI Initiatives (Step 4), not on the Capability
 * Map (Step 1). Program priority (P1 / P2 / P3 / Deprioritized) is computed
 * from the cross-tower 2x2 — it is NOT carried on individual L4s here.
 */

import type { CapabilityMapDefinition } from "@/data/capabilityMap/types";
import {
  composeL4Verdict,
  type ComposedVerdict,
} from "@/lib/initiatives/composeVerdict";

export type WalkedL4 = ComposedVerdict & {
  l4Id: string;
  l4Name: string;
  l3Id: string;
  l3Name: string;
  l2Id: string;
  l2Name: string;
  towerId: string;
};

/**
 * Walk a canonical capability-map definition, producing one composed
 * verdict per L4 (ordered by L2 → L3 → L4 declaration order). Used by the
 * report generator.
 */
export function walkCapabilityMap(
  def: CapabilityMapDefinition,
): WalkedL4[] {
  const out: WalkedL4[] = [];
  const towerId = def.mapRelatedTowerIds?.[0] ?? def.id;
  for (const l2 of def.l2) {
    for (const l3 of l2.l3) {
      for (const l4 of l3.l4) {
        // Tower-scope filter: when an L4 carries `relatedTowerIds`, skip if
        // it doesn't include the map's primary tower.
        if (l4.relatedTowerIds && !l4.relatedTowerIds.includes(towerId)) continue;
        const verdict = composeL4Verdict({
          towerId,
          l2Name: l2.name,
          l3Name: l3.name,
          l4,
        });
        out.push({
          ...verdict,
          l4Id: l4.id,
          l4Name: l4.name,
          l3Id: l3.id,
          l3Name: l3.name,
          l2Id: l2.id,
          l2Name: l2.name,
          towerId,
        });
      }
    }
  }
  return out;
}
