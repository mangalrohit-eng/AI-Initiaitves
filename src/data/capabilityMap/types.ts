import type {
  AiPriority,
  Feasibility,
  Tower,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";

/**
 * Curation status for an L5 Activity in the AI Initiatives view.
 *
 *   - "curated"               — AI metadata + Versant rationale authored;
 *                              renders on Step 4 with full detail.
 *   - "pending-discovery"     — placeholder; backlog item for editorial sweep.
 *                              Hidden on Step 4 (unless synthesized to keep
 *                              a dialed L4 visible — see ghost-L4 prevention
 *                              in `lib/initiatives/select.ts`).
 *   - "reviewed-not-eligible" — explicitly human-led; rationale required from
 *                              the approved set in `docs/context.md` §9.
 *
 * Semantic note: AI initiatives attach to L5 Activities (the leaf). The
 * dials-bearing L4 Activity Group aggregates those leaves. This is the same
 * pattern as the pre-migration model where initiatives lived on L4 Activities
 * under a dials-bearing L3 Capability — only the layer numbers shifted.
 */
export type AiCurationStatus =
  | "curated"
  | "pending-discovery"
  | "reviewed-not-eligible";

/**
 * L5 Activity (was L4 prior to the 5-layer migration). The leaf of the
 * capability tree where AI initiatives live. Stable id, namespaced by map.
 *
 * Optional AI-initiative metadata is layered on by the editorial migration so
 * Step 4 (AI Initiatives) can render the curated Versant detail directly off
 * the canonical map.
 */
export type CapabilityL5 = {
  id: string;
  name: string;
  relatedTowerIds?: Tower["id"][];
  /** Optional plain-text description shown on Step 1 + Step 4. */
  description?: string;
  // ----- AI Initiatives metadata (Phase 1: optional during migration) -----
  /** First-class curation marker. Drives Step 1's scoreboard + Step 4's filter. */
  aiCurationStatus?: AiCurationStatus;
  /** Convenience flag — derived from `aiCurationStatus === "curated"` if absent. */
  aiEligible?: boolean;
  /**
   * @deprecated Per-Activity P1/P2/P3 is no longer the program priority signal.
   * Cross-tower priority is computed by `computeProgramTiers()`. Field stays
   * as a back-compat input to the binary `feasibility` map (P1 -> High,
   * P2/P3 -> Low) and is never displayed on Step 4.
   */
  aiPriority?: AiPriority;
  /**
   * Binary ship-readiness signal that feeds the cross-tower 2x2. Optional
   * because canonical map seeds haven't been back-filled — selectors fall
   * back to the deprecated `aiPriority` map when missing.
   */
  feasibility?: Feasibility;
  /** Versant-grounded rationale (or "why not AI" for `reviewed-not-eligible`). */
  aiRationale?: string;
  frequency?: TowerProcessFrequency;
  criticality?: TowerProcessCriticality;
  currentMaturity?: TowerProcessMaturity;
  /** Slug into `processBriefsBySlug` for the lightweight pre/post brief. */
  briefSlug?: string;
  /**
   * Slug into `Process[]` for the full 4-lens deep dive. Set on the "primary"
   * L5 of each L4 (one L5 per L4 maximum carries this).
   */
  initiativeId?: string;
};

/**
 * L4 Activity Group (was L3 Capability prior to the 5-layer migration).
 *
 * The row that the dials + opportunity sizing attach to via the data-side
 * `L4WorkforceRow`. Every initiative's parent-L4 prize is the unit the
 * cross-tower 2x2 classifies on.
 */
export type CapabilityL4 = {
  id: string;
  name: string;
  relatedTowerIds?: Tower["id"][];
  /** Optional plain-text description shown on Step 1 + Step 4 L4 row. */
  description?: string;
  l5: CapabilityL5[];
};

/**
 * L3 Job Family (was L2 Pillar prior to the 5-layer migration).
 */
export type CapabilityL3 = {
  id: string;
  name: string;
  /** Optional plain-text description shown on Step 4's L3 card. */
  description?: string;
  /** Lucide icon name (e.g. "FileSpreadsheet") shown on Step 4's L3 card. */
  icon?: string;
  l4: CapabilityL4[];
};

/**
 * L2 Job Grouping (NEW intermediate layer added in the 5-layer migration).
 *
 * Wraps Job Families (L3). In the dummy-wrapper era — set immediately after
 * the migration — every canonical map carries a single L2 named after the
 * tower function (Finance map -> one L2 named "Finance"; HR -> one L2 named
 * "HR"; etc.). A future content pass can split this into multiple Job
 * Groupings per tower (e.g. Finance -> Controllership / FP&A / Treasury &
 * Tax) without further code changes — only data-file edits.
 */
export type CapabilityL2 = {
  id: string;
  name: string;
  /** Optional plain-text description shown on Step 1 + Step 4's L2 card. */
  description?: string;
  /** Lucide icon name (e.g. "Briefcase") shown on Step 4's L2 card. */
  icon?: string;
  relatedTowerIds?: Tower["id"][];
  l3: CapabilityL3[];
};

/**
 * One canonical capability map per Forge tower. The map's `l1Name` is the
 * Function (e.g. "Finance"); `l2` is the array of Job Groupings under that
 * Function. Five layers total: Function (L1, the map) -> Job Grouping (L2)
 * -> Job Family (L3) -> Activity Group (L4, dials live here) -> Activity
 * (L5, AI initiatives attach here).
 */
export type CapabilityMapDefinition = {
  id: string;
  name: string;
  l1Name: string;
  /** When set, the whole map is anchored to these Forge towers (e.g., HR map → `hr`). */
  mapRelatedTowerIds?: Tower["id"][];
  l2: CapabilityL2[];
};
