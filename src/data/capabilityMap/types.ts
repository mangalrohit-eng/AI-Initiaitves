import type {
  AiPriority,
  Tower,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";

/**
 * Curation status for an L4 in the AI Initiatives view.
 *
 *   - "curated"               — AI metadata + Versant rationale authored;
 *                              renders on Step 4 with full detail.
 *   - "pending-discovery"     — placeholder; backlog item for editorial sweep.
 *                              Hidden on Step 4 (unless synthesized to keep
 *                              a dialed L3 visible — see ghost-L3 prevention
 *                              in `lib/initiatives/select.ts`).
 *   - "reviewed-not-eligible" — explicitly human-led; rationale required from
 *                              the approved set in `docs/context.md` §9.
 */
export type AiCurationStatus =
  | "curated"
  | "pending-discovery"
  | "reviewed-not-eligible";

/**
 * L4 activity: stable id, namespaced by map. Optional AI-initiative metadata
 * is layered on by the editorial migration so Step 4 (AI Initiatives) can
 * render the curated Versant detail directly off the canonical map.
 */
export type CapabilityL4 = {
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
  aiPriority?: AiPriority;
  /** Versant-grounded rationale (or "why not AI" for `reviewed-not-eligible`). */
  aiRationale?: string;
  frequency?: TowerProcessFrequency;
  criticality?: TowerProcessCriticality;
  currentMaturity?: TowerProcessMaturity;
  /** Slug into `processBriefsBySlug` for the lightweight pre/post brief. */
  briefSlug?: string;
  /**
   * Slug into `Process[]` for the full 4-lens deep dive. Set on the "primary"
   * L4 of each L3 (one L4 per L3 maximum carries this).
   */
  initiativeId?: string;
};

export type CapabilityL3 = {
  id: string;
  name: string;
  relatedTowerIds?: Tower["id"][];
  /** Optional plain-text description shown on Step 1 + Step 4 L3 row. */
  description?: string;
  l4: CapabilityL4[];
};

export type CapabilityL2 = {
  id: string;
  name: string;
  /** Optional plain-text description shown on Step 4's L2 card. */
  description?: string;
  /** Lucide icon name (e.g. "FileSpreadsheet") shown on Step 4's L2 card. */
  icon?: string;
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
