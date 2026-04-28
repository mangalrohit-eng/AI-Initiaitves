import type { TowerStaleState } from "@/lib/initiatives/curationHash";

export type GuidanceTier = 0 | 1 | 2 | 3;

/** What stale sub-banner to show, if any. `null` when the primary action is not a refresh banner. */
export type StaleKind = "l4" | "dials" | "curation" | null;

export type ResolvedJourneyGuidance = {
  tier: GuidanceTier;
  /** One-line next action. */
  title: string;
  /** Optional primary link for this screen (e.g. program home resume). */
  actionHref?: string;
  actionLabel?: string;
  staleKind: StaleKind;
};

export type CapabilityMapGuidanceInput = {
  rowCount: number;
  blankL4Count: number;
  stale: TowerStaleState;
  towerId: import("@/data/assess/types").TowerId;
};

export type ImpactLeversGuidanceInput = {
  rowCount: number;
  stale: TowerStaleState;
  /** From Step 2 tower lead sign-off. */
  isTowerLeadComplete: boolean;
  towerName: string;
  towerId: import("@/data/assess/types").TowerId;
};

export type AiInitiativesGuidanceInput = {
  stale: TowerStaleState;
  /** Pending L4 review count (Step 4 validate/reject). */
  pendingReviewCount: number;
  towerName: string;
  towerId: import("@/data/assess/types").TowerId;
};

export type { TowerStaleState };
