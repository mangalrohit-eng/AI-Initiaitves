/**
 * Description-context lookup for the canonical capability maps.
 *
 * Step 1, Step 2, and Step 4 prompts all benefit from L2 Job Grouping +
 * L3 Job Family + L4 Activity Group narrative context — the editor's
 * complaint about "high-level consulting fluff" is largely a content
 * problem, not a model problem. Authoring rich descriptions on the
 * canonical map gives every LLM call grounding it would otherwise have
 * to invent from the row label alone.
 *
 * This module is a thin lookup over `getCapabilityMapForTower`. It walks
 * the canonical L2 → L3 → L4 path matching by case-normalised name and
 * returns whatever `description` fields are populated. Towers / rows
 * without descriptions return an all-empty bundle, which the curation
 * hash treats as "no description context" so the wire-format hash stays
 * byte-identical to the pre-PR3 output.
 *
 * Lookup is intentionally name-based (not id-based) because the route
 * receives `(l2, l3, l4)` strings from the row payload and never sees
 * canonical ids — keeping the lookup contract on names lets us thread
 * descriptions through both the LLM module and the route without
 * widening the wire format.
 */

import type { Tower } from "@/data/types";
import type { CurationDescriptionContext } from "@/lib/initiatives/curationHash";
import { getCapabilityMapForTower } from "./maps";

const EMPTY: CurationDescriptionContext = {
  l2Description: undefined,
  l3Description: undefined,
  l4Description: undefined,
};

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve the L2 / L3 / L4 description bundle for a single row, given
 * the row's `(l2Name, l3Name, l4Name?)` triple. When `l4Name` is omitted
 * (legacy v4 callers) only the L2 + L3 descriptions are returned and
 * `l4Description` stays undefined.
 *
 * Pure function — safe to call inside the request hot path. Returns
 * `EMPTY` when the tower's map isn't found, when no name match lands,
 * or when no description is authored on the matched node.
 */
export function resolveRowDescriptions(
  towerId: Tower["id"],
  l2Name: string,
  l3Name: string,
  l4Name?: string,
): CurationDescriptionContext {
  const map = getCapabilityMapForTower(towerId);
  if (!map) return EMPTY;

  const l2 = map.l2.find((n) => normalise(n.name) === normalise(l2Name));
  if (!l2) return EMPTY;

  const l3 = l2.l3.find((n) => normalise(n.name) === normalise(l3Name));
  if (!l3) {
    return {
      l2Description: l2.description,
    };
  }

  if (!l4Name) {
    return {
      l2Description: l2.description,
      l3Description: l3.description,
    };
  }

  const l4 = l3.l4.find((n) => normalise(n.name) === normalise(l4Name));
  if (!l4) {
    return {
      l2Description: l2.description,
      l3Description: l3.description,
    };
  }

  return {
    l2Description: l2.description,
    l3Description: l3.description,
    l4Description: l4.description,
  };
}

/**
 * Convenience: returns true when at least one of the three description
 * slots is non-empty. Callers (LLM module, prompt builders) use this to
 * decide whether to render a "ROW CONTEXT" block or skip it entirely
 * for a cleaner prompt on towers that haven't been authored yet.
 */
export function hasAnyDescription(ctx: CurationDescriptionContext): boolean {
  return Boolean(
    ctx.l2Description?.trim() ||
      ctx.l3Description?.trim() ||
      ctx.l4Description?.trim(),
  );
}
