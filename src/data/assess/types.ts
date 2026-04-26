import type { Tower } from "@/data/types";

export type TowerId = Tower["id"];

/** One L4 / lowest row from the tower footprint file. */
export type L4WorkforceRow = {
  id: string;
  l2: string;
  l3: string;
  l4: string;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  /** When present in file, used for $ pool; else derived from headcount × blended rates. */
  annualSpendUsd?: number;
  /**
   * Step 2 — workshop: 0–100 share of L4 work plausibly offshore-movable.
   * When missing, the tower baseline is used in weighted rollups.
   */
  l4OffshoreAssessmentPct?: number;
  /**
   * Step 2 — workshop: 0–100 AI improvement / automation headroom for the L4.
   */
  l4AiImpactAssessmentPct?: number;
};

/** Workshop anchor before stress-test on the summary page. */
export type TowerBaseline = {
  baselineOffshorePct: number;
  baselineAIPct: number;
};

export type TowerAssessStatus = "empty" | "data" | "complete";

/**
 * Per-section "Reviewed" timestamps for the tower-page checklist. All four
 * are explicitly user-clicked — never auto-detected from data — so seeded
 * starter defaults can't trick a lead into Mark-complete without reviewing.
 *
 * Read-side backfill: if `status === "complete"` and any of the four are
 * missing, treat them as confirmed at the same `lastUpdated` timestamp.
 */
export type TowerAssessReview = {
  capabilityMapConfirmedAt?: string;
  headcountConfirmedAt?: string;
  offshoreConfirmedAt?: string;
  aiConfirmedAt?: string;
};

export type TowerAssessState = {
  l4Rows: L4WorkforceRow[];
  baseline: TowerBaseline;
  status: TowerAssessStatus;
  lastUpdated?: string;
} & TowerAssessReview;

export type ChecklistStepId =
  | "capability-map"
  | "headcount"
  | "offshore"
  | "ai"
  | "complete";

/**
 * Global assumptions for the Configure Impact Levers flow. These are the ONLY
 * knobs on the Assumptions tab and the ONLY rates the savings math reads.
 *
 * Every $ in the app is derived from these four rates plus the per-L4
 * inputs (headcount mix, dials). No magic lever weights, no caps, no
 * combine-mode toggles — see `scenarioModel.ts` for the math.
 */
export type GlobalAssessAssumptions = {
  /** Illustrative $ / FTE-year (user-entered, not Versant-reported). */
  blendedFteOnshore: number;
  blendedFteOffshore: number;
  blendedContractorOnshore: number;
  blendedContractorOffshore: number;
};

export const defaultGlobalAssessAssumptions: GlobalAssessAssumptions = {
  blendedFteOnshore: 180_000,
  blendedFteOffshore: 90_000,
  blendedContractorOnshore: 120_000,
  blendedContractorOffshore: 60_000,
};

/**
 * V3 program shape — current. Drops the V2 `scenarios` slice and the four
 * lever-weight / combine-mode / cap fields that hid the math behind magic
 * numbers. Migration from V2 lives in `localStore.ts`.
 */
export type AssessProgramV3 = {
  version: 3;
  towers: Partial<Record<TowerId, TowerAssessState>>;
  global: GlobalAssessAssumptions;
};

/** Back-compat alias for callers that still import the old name. */
export type AssessProgramV2 = AssessProgramV3;

export const defaultTowerBaseline: TowerBaseline = {
  baselineOffshorePct: 20,
  baselineAIPct: 15,
};

export function defaultTowerState(): TowerAssessState {
  return {
    l4Rows: [],
    baseline: { ...defaultTowerBaseline },
    status: "empty",
  };
}

export function defaultAssessProgramV2(): AssessProgramV3 {
  return {
    version: 3,
    towers: {},
    global: { ...defaultGlobalAssessAssumptions },
  };
}
