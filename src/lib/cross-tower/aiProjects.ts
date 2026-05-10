/**
 * Cross-Tower AI Plan — resolved view-model + shared scoring axes.
 *
 * Under v6, AI initiatives are authored at L3 Job Family grain by the
 * curator (`L3Initiative`). The cross-tower composer (`composeProjectsV6`)
 * lifts each `ProgramInitiativeRowV6` into one `AIProjectResolved` — the
 * deterministic view-model the cards / Gantt / matrix all consume.
 *
 * Scoring is **Value × Effort** (High/Low buckets):
 *   - Value bucket  → median split of the parent-L3 modeled $.
 *   - Effort bucket → inverse of curator-stamped feasibility
 *                     (High feasibility = Low effort, else High effort).
 *
 * The 2x2 quadrant is derived deterministically from the bucket pair.
 */

import type { Feasibility, ProgramTier } from "@/data/types";
import type { TowerId } from "@/data/assess/types";

// ---------------------------------------------------------------------------
//   Shared enums
// ---------------------------------------------------------------------------

/** Value × Effort score axis. */
export type ValueBucket = "High" | "Low";
export type EffortBucket = "High" | "Low";

/**
 * Resolved 2x2 quadrant — derived deterministically from the
 * `valueBucket` × `effortBucket` pair. Quadrant labels carry the
 * strategic meaning the executive reads off the matrix:
 *
 *   - "Quick Win"        — High value × Low effort. Ship first.
 *   - "Strategic Bet"    — High value × High effort. The flagship integrations.
 *   - "Fill-in"          — Low value × Low effort. Slot into team capacity.
 *   - "Deprioritize"     — Low value × High effort. Below the line.
 */
export type Quadrant = "Quick Win" | "Strategic Bet" | "Fill-in" | "Deprioritize";

/** Brief depth knob — controls how many rows the LLM authors per lens. */
export type BriefDepth = "Concise" | "Full";

// ---------------------------------------------------------------------------
//   Resolved view-model — one entry per L3 AI Solution
// ---------------------------------------------------------------------------

export type AIProjectResolved = {
  /** `L3Initiative.id` — stable across re-curations. */
  id: string;
  /**
   * Context anchor — the parent L3 row id. Field name retained so older
   * persisted plans / sanitizers keep parsing without a schema bump.
   */
  parentL4ActivityGroupId: string;
  /** Parent L3 Job Family display name (for the breadcrumb chip). */
  parentL4ActivityGroupName: string;
  /** Primary tower id. */
  primaryTowerId: TowerId;
  /** Primary tower display name. */
  primaryTowerName: string;
  /** AI Solution name (curator-authored). */
  name: string;
  /**
   * Cross-tower narrative — falls back to the curator-authored
   * `aiRationale` when the program-synthesis LLM call doesn't author one.
   */
  narrative: string;
  /** Single-initiative payload — always one entry under v6. */
  constituentInitiativeIds: string[];
  /** Value bucket — median-split off the parent-L3 modeled $. */
  valueBucket: ValueBucket | null;
  /** Effort bucket — inverse of `feasibility`. */
  effortBucket: EffortBucket | null;
  /** ≤30 words; declarative; references the project's Versant impact context. */
  valueRationale: string;
  /** ≤30 words; declarative; references the feasibility / vendor signals. */
  effortRationale: string;
  /** Resolved 2x2 quadrant — null when buckets unset (legacy stub). */
  quadrant: Quadrant | null;
  /** Even-split share of the parent-L3 prize across non-placeholder initiatives on the row. */
  attributedAiUsd: number;
  /** Project start month (1-indexed) — derived from quadrant + assumptions. */
  startMonth: number;
  /** Build duration in months — deterministic from the program tier. */
  buildMonths: number;
  /** Adoption ramp duration in months — from assumptions. */
  rampMonths: number;
  /** Month the project's value clock starts — deterministic. */
  valueStartMonth: number;
  /** Reserved for legacy persisted documents — always `false` under v6. */
  isStub: boolean;
  /** True when the project's quadrant lands in Deprioritize (excluded from Gantt). */
  isDeprioritized: boolean;
  // -----------------------------------------------------------------------
  //   v6 extras carried from the L3Initiative
  // -----------------------------------------------------------------------
  /** Versant-grounded rationale carried from the L3Initiative (2-4 sentences). */
  aiRationale?: string;
  /** Named primary vendor / short stack on the L3Initiative. */
  primaryVendor?: string;
  /** Binary ship-readiness label — drives the v6 chip. */
  feasibility?: Feasibility;
  /** 1-line solution tagline — used for the v6 card body. */
  tagline?: string;
  /** Parent L3 Job Family display name — for the breadcrumb chip. */
  l3FamilyName?: string;
  /** Click-through to `/tower/<towerId>/initiative/<l3RowId>/<initiativeId>`. */
  deepDiveHref?: string;
  /**
   * Program tier (P1/P2/P3) of the project — sourced from the parent
   * `ProgramInitiativeRowV6.programTier`. Optional so legacy persisted
   * documents without it still parse.
   */
  programTier?: ProgramTier;
};
