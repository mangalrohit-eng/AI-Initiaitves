/**
 * Lookup helpers for the static curation verdict — used by the Capability
 * Map UI (CurationPill, CurationScoreboard) and the markdown report
 * generator. They walk the canonical capability map → composer pipeline
 * without needing a live `L3WorkforceRow` (the AI Initiatives selector
 * stays the source of truth when a row is available).
 */

import type { CapabilityMapDefinition } from "@/data/capabilityMap/types";
import type { TowerId } from "@/data/assess/types";
import { capabilityMapDefinitions } from "@/data/capabilityMap/maps";
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
 * scoreboard + the report generator.
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

/**
 * Build a lookup table keyed by L4 name (lowercased / trimmed) for a tower.
 * Used by the Capability Map panel which renders L4 view-models that may
 * have synthesized ids when row-driven (e.g., `${rowId}::${slugified-name}`).
 * Falling back to name-key keeps the pill rendering robust across both
 * canonical and uploaded paths.
 */
export function buildL4VerdictLookupForTower(
  towerId: TowerId,
): {
  byId: Map<string, ComposedVerdict>;
  byNameKey: Map<string, ComposedVerdict>;
} {
  const def = capabilityMapDefinitions.find(
    (m) => m.mapRelatedTowerIds?.includes(towerId),
  );
  const byId = new Map<string, ComposedVerdict>();
  const byNameKey = new Map<string, ComposedVerdict>();
  if (!def) return { byId, byNameKey };
  for (const v of walkCapabilityMap(def)) {
    byId.set(v.l4Id, v);
    byNameKey.set(nameKey(v.l4Name), v);
  }
  return { byId, byNameKey };
}

function nameKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Lookup a verdict by L4 id or name. Returns undefined when no match. */
export function lookupVerdict(
  lookup: { byId: Map<string, ComposedVerdict>; byNameKey: Map<string, ComposedVerdict> },
  opts: { l4Id?: string; l4Name?: string },
): ComposedVerdict | undefined {
  if (opts.l4Id) {
    const hit = lookup.byId.get(opts.l4Id);
    if (hit) return hit;
  }
  if (opts.l4Name) {
    return lookup.byNameKey.get(nameKey(opts.l4Name));
  }
  return undefined;
}

/**
 * Aggregate verdict counts for a tower's canonical capability map.
 * Returns `null` when no map is anchored to the tower.
 */
export function summarizeCurationForTower(
  towerId: TowerId,
): { eligible: number; notEligible: number; pending: number; totalL4: number } | null {
  const def = capabilityMapDefinitions.find(
    (m) => m.mapRelatedTowerIds?.includes(towerId),
  );
  if (!def) return null;
  const walk = walkCapabilityMap(def);
  let eligible = 0;
  let notEligible = 0;
  let pending = 0;
  for (const v of walk) {
    if (v.status === "curated") eligible += 1;
    else if (v.status === "reviewed-not-eligible") notEligible += 1;
    else pending += 1;
  }
  return { eligible, notEligible, pending, totalL4: walk.length };
}
