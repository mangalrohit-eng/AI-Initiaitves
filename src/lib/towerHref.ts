import type { TowerId } from "@/data/assess/types";

/**
 * Single source of truth for cross-module tower URLs.
 *
 * Tower id is the same string across modules (verified for all 13 towers in
 * `src/data/slices/*`). Centralising the path construction here prevents the
 * stepper, handoff CTA, and kebab links from drifting if a route ever changes.
 */
export type TowerScopedModule = "capability-map" | "ai-initiatives" | "offshore-plan";

export function getTowerHref(towerId: TowerId, module: TowerScopedModule): string {
  switch (module) {
    case "capability-map":
      return `/assess/tower/${towerId}`;
    case "ai-initiatives":
      return `/tower/${towerId}`;
    case "offshore-plan":
      return `/offshore-plan?tower=${towerId}`;
  }
}

/**
 * Modules surfaced in the per-tower journey stepper.
 *
 * Restricted to tower-scoped modules — Prototypes and Delivery Plan are
 * program-scoped and only appear on the program-home journey.
 */
export const TOWER_JOURNEY_MODULES: ReadonlyArray<{
  id: TowerScopedModule;
  /** Step label for the stepper. */
  label: string;
  /** Whether this module is live today. */
  active: boolean;
}> = [
  { id: "capability-map", label: "Capability Map", active: true },
  { id: "ai-initiatives", label: "AI Initiatives", active: true },
  { id: "offshore-plan", label: "Offshore Plan", active: false },
];
