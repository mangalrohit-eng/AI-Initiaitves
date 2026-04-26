import type {
  CapabilityL4,
  CapabilityMapDefinition,
  CapabilitySavingsAssumptions,
  L4LeadInputs,
} from "@/data/capabilityMap/types";
import { defaultCapabilitySavingsAssumptions } from "@/data/capabilityMap/types";

export type L4Computed = {
  l4Id: string;
  l4Name: string;
  l2Name: string;
  spend: number;
  offshoreSavings: number;
  aiSavings: number;
  combinedSavings: number;
  /** Illustrative; not a committed program date. */
  waveTimelineMonths: number;
};

function collectL4s(
  map: CapabilityMapDefinition,
): { l2Name: string; l4: CapabilityL4 }[] {
  const out: { l2Name: string; l4: CapabilityL4 }[] = [];
  for (const l2 of map.l2) {
    for (const l3 of l2.l3) {
      for (const l4 of l3.l4) {
        out.push({ l2Name: l2.name, l4 });
      }
    }
  }
  return out;
}

export function computeL4Row(
  l4: CapabilityL4,
  l2Name: string,
  inputs: L4LeadInputs | undefined,
  assumptions: CapabilitySavingsAssumptions,
): L4Computed {
  const spend = inputs?.spend ?? 0;
  const o = inputs?.offshorePct ?? 0;
  const a = inputs?.aiAutomationPct ?? 0;
  const offshoreSavings = spend * (o / 100) * assumptions.offshoreLeverWeight;
  const aiSavings = spend * (a / 100) * assumptions.aiLeverWeight;
  let combined = offshoreSavings + aiSavings;
  if (assumptions.combineMode === "capped") {
    const cap = spend * (assumptions.combinedCapPctOfSpend / 100);
    combined = Math.min(combined, cap);
  }
  const waveTimelineMonths = Math.max(
    0,
    assumptions.waveBaseMonths + (100 - a) * assumptions.monthsPerPointNotAutomated,
  );
  return {
    l4Id: l4.id,
    l4Name: l4.name,
    l2Name,
    spend,
    offshoreSavings,
    aiSavings,
    combinedSavings: combined,
    waveTimelineMonths,
  };
}

export function computeMapRollup(
  map: CapabilityMapDefinition,
  l4Inputs: Record<string, L4LeadInputs | undefined>,
  assumptions: CapabilitySavingsAssumptions = defaultCapabilitySavingsAssumptions,
): { rows: L4Computed[]; byL2: { l2Name: string; combinedSavings: number; l4Count: number }[] } {
  const rows: L4Computed[] = [];
  for (const { l2Name, l4 } of collectL4s(map)) {
    const inputs = l4Inputs[l4.id];
    rows.push(computeL4Row(l4, l2Name, inputs, assumptions));
  }
  const l2Map = new Map<string, { combined: number; n: number }>();
  for (const r of rows) {
    const cur = l2Map.get(r.l2Name) ?? { combined: 0, n: 0 };
    l2Map.set(r.l2Name, {
      combined: cur.combined + r.combinedSavings,
      n: cur.n + 1,
    });
  }
  const byL2 = Array.from(l2Map.entries()).map(([l2Name, v]) => ({
    l2Name,
    combinedSavings: v.combined,
    l4Count: v.n,
  }));
  return { rows, byL2 };
}

export { defaultCapabilitySavingsAssumptions };
