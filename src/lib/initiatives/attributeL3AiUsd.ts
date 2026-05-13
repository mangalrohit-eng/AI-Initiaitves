import type { L4WorkforceRow, L3WorkforceRowV6 } from "@/data/assess/types";
import type { RowSavings } from "@/lib/assess/scenarioModel";

/** Shown when L3 has no workforce + no pool, so modeled AI $ is not established. */
export const L3_FTE_DATA_MISSING_LABEL = "L3 FTE numbers not available";

export type InitiativeAttributionInput = {
  id: string;
  coversL4RowIds: readonly string[];
  isPlaceholder: boolean;
};

function l4HeadcountTotal(l4: L4WorkforceRow): number {
  return (
    l4.fteOnshore +
    l4.fteOffshore +
    l4.contractorOnshore +
    l4.contractorOffshore
  );
}

/**
 * True when the Job Family row has no workforce footprint and no cost pool,
 * so modeled AI $ is zero — not a deliberate dial-at-zero outcome.
 */
export function computeL3FteDataMissing(
  row: Pick<
    L3WorkforceRowV6,
    "fteOnshore" | "fteOffshore" | "contractorOnshore" | "contractorOffshore"
  >,
  saving: Pick<RowSavings, "pool" | "ai">,
): boolean {
  const hc =
    row.fteOnshore +
    row.fteOffshore +
    row.contractorOnshore +
    row.contractorOffshore;
  return hc === 0 && saving.pool === 0 && saving.ai === 0;
}

/**
 * Split parent L3 modeled AI $ across initiatives by summed L4 headcount
 * in each initiative's coverage (empty covers = whole Job Family).
 * Residual goes to the last id in lexicographic order so row sums match exactly.
 */
export function attributeAiUsdAcrossInitiatives(args: {
  rowAiUsd: number;
  childL4RowIds: readonly string[];
  l4ById: ReadonlyMap<string, L4WorkforceRow>;
  initiatives: readonly InitiativeAttributionInput[];
}): Map<string, number> {
  const { rowAiUsd, childL4RowIds, l4ById, initiatives } = args;
  const out = new Map<string, number>();
  const reals = initiatives.filter((i) => !i.isPlaceholder);
  if (reals.length === 0 || rowAiUsd <= 0) {
    return out;
  }

  const massByL4Id = new Map<string, number>();
  for (const id of childL4RowIds) {
    const l4 = l4ById.get(id);
    if (l4) massByL4Id.set(id, l4HeadcountTotal(l4));
  }

  const effectiveCoverIds = (init: InitiativeAttributionInput): string[] => {
    const base =
      init.coversL4RowIds.length === 0
        ? [...childL4RowIds]
        : init.coversL4RowIds.filter((id) => childL4RowIds.includes(id));
    return Array.from(new Set(base));
  };

  const rawById = new Map<string, number>();
  for (const init of reals) {
    let w = 0;
    for (const lid of effectiveCoverIds(init)) {
      w += massByL4Id.get(lid) ?? 0;
    }
    rawById.set(init.id, w);
  }

  let sumRaw = 0;
  for (const init of reals) sumRaw += rawById.get(init.id) ?? 0;

  const sortedIds = reals.map((r) => r.id).sort((a, b) => a.localeCompare(b));

  if (sumRaw <= 0) {
    let allocated = 0;
    const even = rowAiUsd / sortedIds.length;
    for (let i = 0; i < sortedIds.length; i++) {
      const id = sortedIds[i]!;
      if (i === sortedIds.length - 1) {
        out.set(id, Math.max(0, rowAiUsd - allocated));
      } else {
        out.set(id, even);
        allocated += even;
      }
    }
    return out;
  }

  let allocated = 0;
  for (let i = 0; i < sortedIds.length; i++) {
    const id = sortedIds[i]!;
    const rw = rawById.get(id) ?? 0;
    if (i === sortedIds.length - 1) {
      out.set(id, Math.max(0, rowAiUsd - allocated));
    } else {
      const v = (rowAiUsd * rw) / sumRaw;
      out.set(id, v);
      allocated += v;
    }
  }
  return out;
}
