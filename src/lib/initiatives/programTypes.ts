/**
 * Shared cross-tower selector types — schema-agnostic shapes used by the
 * v6 program selector (`selectV6Program`), the cross-tower view filter,
 * and the page-level KPI / threshold inputs.
 *
 * No row shape is defined here intentionally — the v6 selector owns
 * `ProgramInitiativeRowV6` and any future schema can carry its own row
 * shape without rewriting the bucket / threshold contract.
 */

import type { ProgramTier } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import type { Tier } from "@/lib/priority";
import type { ProgramImpactSummary } from "@/lib/assess/scenarioModel";

// ---------------------------------------------------------------------------
//   Phase / threshold / architecture rollups
// ---------------------------------------------------------------------------

export type PhaseBucket = {
  /** `null` for the Deprioritized bucket; carries the visual Tier otherwise. */
  tier: Tier | null;
  /** The full `ProgramTier` value — distinguishes Deprioritized from "no tier". */
  programTier: ProgramTier;
  /** Display label, e.g. "P1 — Quick Wins (HF · HBI)". */
  label: string;
  /** Time window string, e.g. "0–6 months · high feasibility, high impact". */
  window: string;
  /** Sum of `attributedAiUsd` across initiatives in this bucket. */
  aiUsd: number;
};

/** Deterministic 24-month cumulative AI $ buildup. */
export type ValueBuildupPoint = {
  /** 1-indexed month, 1..24. */
  month: number;
  /** Cumulative modeled AI $ in-flight by end of this month. */
  cumulativeAiUsd: number;
  /** Tier whose ramp is currently active for this month. */
  activeTier: Tier;
};

export type OrchestrationMix = {
  /** Agent orchestration pattern name, mirrors `AgentOrchestration["pattern"]`. */
  pattern: "Sequential" | "Parallel" | "Hub-and-Spoke" | "Pipeline" | "Hierarchical";
  count: number;
};

export type AgentTypeMix = {
  type: "Orchestrator" | "Specialist" | "Monitor" | "Router" | "Executor";
  count: number;
};

export type VendorStackEntry = {
  vendor: string;
  /** How many initiatives across the program reference this vendor/platform. */
  count: number;
};

export type TowerInScope = {
  id: TowerId;
  name: string;
  /** Modeled AI $ for this tower (sum of L3 `aiUsd`). */
  aiUsd: number;
  /** Number of curated initiatives surfaced for this tower. */
  initiativeCount: number;
};

export type ProgramArchitecture = {
  orchestrationMix: OrchestrationMix[];
  agentTypeMix: AgentTypeMix[];
  /** Top vendor stack entries, sorted by count desc, capped at 12 for display. */
  vendorStack: VendorStackEntry[];
  /** Total agents across resolved Processes in-scope. */
  totalAgents: number;
};

/**
 * Plan threshold metadata. The threshold is a SECONDARY filter on top of
 * the deterministic 2x2 and operates at the L3 row $ grain — a row stays
 * in plan only when both `programTier !== "Deprioritized"` AND its parent
 * `aiUsd >= aiUsdThreshold`. The KPI strip surfaces below-threshold $ as a
 * distinct bucket from below-the-line-by-2x2 $, so the executive can see
 * why each excluded $ was dropped.
 */
export type PlanThreshold = {
  /** Minimum parent-L3 row `aiUsd` for the row's initiatives to be in plan. */
  aiUsdThreshold: number;
  /** Initiatives dropped because their parent row prize fell below the threshold. */
  excludedCount: number;
  /** Sum of `attributedAiUsd` across the dropped initiatives. */
  excludedAiUsd: number;
  /** Towers that lost their last in-plan initiative because of the threshold. */
  excludedTowerCount: number;
};

/**
 * Diagnostics surfaced from the program-tier 2x2 for the KPI strip and any
 * "why is this Deprioritized?" tooltip.
 */
export type ProgramTierDiagnostics = {
  /** Median of `aiUsd` across the active L3 row sample. */
  medianL3Usd: number;
  /** Floor below which a row is never "high impact." */
  floorUsd: number;
  /** Effective threshold actually applied: max(median, floor). */
  thresholdUsd: number;
  /** Unique active L3 row count contributing to the median sample. */
  activeL3Count: number;
  /** True when the active sample is too small for a stable median. */
  medianVolatilityWarning: boolean;
  /** Sum of `attributedAiUsd` across initiatives the 2x2 dropped to Deprioritized. */
  deprioritizedAiUsd: number;
  /** Count of initiatives the 2x2 dropped to Deprioritized. */
  deprioritizedCount: number;
};

export type SelectProgramOptions = {
  /**
   * Minimum parent-L3 `aiUsd` an initiative's parent row must clear to be
   * in plan. Initiatives rolling up to a smaller-prize row are dropped from
   * the plan — they're treated as opportunistic rather than part of the
   * cross-tower roster. Operates at the L3 row grain so it stays
   * compatible with the 2x2 (which classifies on the same value).
   * Default: 0 (no filter).
   */
  aiUsdThreshold?: number;
};

// Re-exports for callers that want to grab `ProgramImpactSummary` from the
// same import barrel (avoids reaching into `scenarioModel` for a single
// shared type).
export type { ProgramImpactSummary };
