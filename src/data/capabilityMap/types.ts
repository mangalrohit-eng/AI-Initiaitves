import type { Tower } from "@/data/types";

/** L4 activity: stable id, namespaced by map. */
export type CapabilityL4 = {
  id: string;
  name: string;
  relatedTowerIds?: Tower["id"][];
};

export type CapabilityL3 = {
  id: string;
  name: string;
  relatedTowerIds?: Tower["id"][];
  l4: CapabilityL4[];
};

export type CapabilityL2 = {
  id: string;
  name: string;
  l3: CapabilityL3[];
};

export type CapabilityMapDefinition = {
  id: string;
  name: string;
  l1Name: string;
  /** When set, the whole map is anchored to these Forge towers (e.g. HR map → `hr`). */
  mapRelatedTowerIds?: Tower["id"][];
  l2: CapabilityL2[];
};

/** User-entered operating data at L4 (illustrative modeling only). */
export type L4LeadInputs = {
  headcount?: number;
  /** Annual operating spend in USD (user-entered; not Versant-reported). */
  spend?: number;
  contractors?: number;
  /** 0–100: share of work that could move offshore. */
  offshorePct?: number;
  /** 0–100: share of work that could be automated with AI. */
  aiAutomationPct?: number;
};

export type CombineMode = "additive" | "capped";

/** User-configured modeling assumptions (illustrative). */
export type CapabilitySavingsAssumptions = {
  /**
   * Applied to the offshore‑eligible *band*: annual savings = spend × (offshorePct/100) × weight.
   * 0.25 = model treats 25% of that band as addressable annual savings.
   */
  offshoreLeverWeight: number;
  /**
   * Applied to the AI automation *band*: annual savings = spend × (aiAutomationPct/100) × weight.
   */
  aiLeverWeight: number;
  combineMode: CombineMode;
  /** When `combineMode` is `capped`, min(combined, spend × this / 100). */
  combinedCapPctOfSpend: number;
  waveBaseMonths: number;
  monthsPerPointNotAutomated: number;
};

export const defaultCapabilitySavingsAssumptions: CapabilitySavingsAssumptions = {
  offshoreLeverWeight: 0.25,
  aiLeverWeight: 0.3,
  combineMode: "capped",
  combinedCapPctOfSpend: 35,
  waveBaseMonths: 6,
  monthsPerPointNotAutomated: 0.12,
};
