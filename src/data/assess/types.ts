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

export type GlobalAssessAssumptions = {
  /** Illustrative $ / FTE-year (user-entered, not Versant-reported). */
  blendedFteOnshore: number;
  blendedFteOffshore: number;
  blendedContractorOnshore: number;
  blendedContractorOffshore: number;
  offshoreLeverWeight: number;
  aiLeverWeight: number;
  combineMode: "additive" | "capped";
  /** Max combined modeled savings as % of tower pool. */
  combinedCapPct: number;
};

export const defaultGlobalAssessAssumptions: GlobalAssessAssumptions = {
  blendedFteOnshore: 180_000,
  blendedFteOffshore: 90_000,
  blendedContractorOnshore: 120_000,
  blendedContractorOffshore: 60_000,
  offshoreLeverWeight: 0.22,
  aiLeverWeight: 0.28,
  combineMode: "capped",
  combinedCapPct: 35,
};

/** Per-tower scenario dials on the summary page (stress test). */
export type TowerScenario = {
  scenarioOffshorePct: number;
  scenarioAIPct: number;
};

export type ScenarioSlice = Partial<Record<TowerId, TowerScenario>>;

export type AssessProgramV2 = {
  version: 2;
  towers: Partial<Record<TowerId, TowerAssessState>>;
  global: GlobalAssessAssumptions;
  /** Tower-level scenario; missing keys default to that tower’s baseline at read time. */
  scenarios: ScenarioSlice;
};

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

export function defaultAssessProgramV2(): AssessProgramV2 {
  return {
    version: 2,
    towers: {},
    global: { ...defaultGlobalAssessAssumptions },
    scenarios: {},
  };
}
