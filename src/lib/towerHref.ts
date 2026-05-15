import type { TowerId } from "@/data/assess/types";

/**
 * Single source of truth for cross-module tower URLs.
 *
 * Tower id is the same string across modules (verified for all 14 towers in
 * `src/data/slices/*`). Centralising the path construction here prevents the
 * stepper, handoff CTA, and kebab links from drifting if a route ever changes.
 */
export type TowerScopedModule =
  | "capability-map"
  | "offshore-view"
  | "impact-levers"
  | "ai-initiatives";

export function getTowerHref(towerId: TowerId, module: TowerScopedModule): string {
  switch (module) {
    case "capability-map":
      return `/capability-map/tower/${towerId}`;
    case "offshore-view":
      return `/offshore-view/tower/${towerId}`;
    case "impact-levers":
      return `/impact-levers/tower/${towerId}`;
    case "ai-initiatives":
      return `/tower/${towerId}`;
  }
}

/**
 * Modules surfaced in the per-tower journey stepper. The program-level
 * Cross-Tower AI Plan is NOT in this stepper — it is a peer program-scoped
 * artifact and lives in program-home navigation.
 */
export const TOWER_JOURNEY_MODULES: ReadonlyArray<{
  id: TowerScopedModule;
  /** Step label for the stepper. */
  label: string;
  /** Whether this module is live today. */
  active: boolean;
}> = [
  { id: "capability-map", label: "Capability Map", active: true },
  { id: "offshore-view", label: "Offshore View", active: true },
  { id: "impact-levers", label: "Impact Levers", active: true },
  { id: "ai-initiatives", label: "AI Initiatives", active: true },
];
