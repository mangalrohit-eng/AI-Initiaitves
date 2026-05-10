import type { TowerId } from "@/data/assess/types";
import type { ProgramTier } from "@/data/types";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import type {
  ProgramInitiativeRowV6,
  SelectProgramResultV6,
} from "@/lib/initiatives/selectV6Program";

/** Active phases available on the Cross-Tower AI Plan filter (in-plan tiers only). */
export const CROSS_TOWER_VIEW_PHASES = ["P1", "P2", "P3"] as const satisfies readonly ProgramTier[];

export type CrossTowerViewPhaseId = (typeof CROSS_TOWER_VIEW_PHASES)[number];

/**
 * Multi-select filters: **empty array** means no restriction on that
 * dimension (same as "all towers" / "all phases").
 *
 * When both dimensions have selections, logic is AND (tower ∈ selection
 * AND project matches phase).
 */
export function filterProjectsByView(
  projects: AIProjectResolved[],
  selectedTowerIds: readonly TowerId[],
  selectedPhases: readonly CrossTowerViewPhaseId[],
): AIProjectResolved[] {
  const towerSet =
    selectedTowerIds.length > 0 ? new Set(selectedTowerIds) : null;
  const phaseSet =
    selectedPhases.length > 0 ? new Set(selectedPhases) : null;

  return projects.filter((p) => {
    if (towerSet && !towerSet.has(p.primaryTowerId)) return false;
    if (phaseSet) {
      if (!p.programTier) return false;
      if (!phaseSet.has(p.programTier as CrossTowerViewPhaseId)) return false;
    }
    return true;
  });
}

export function crossTowerViewFiltersActive(
  selectedTowerIds: readonly TowerId[],
  selectedPhases: readonly CrossTowerViewPhaseId[],
): boolean {
  return selectedTowerIds.length > 0 || selectedPhases.length > 0;
}

/**
 * Narrow `ProgramInitiativeRowV6[]` for tabs that filter by tower / phase.
 */
export function filterProgramInitiativesV6ByView(
  initiatives: ProgramInitiativeRowV6[],
  selectedTowerIds: readonly TowerId[],
  selectedPhases: readonly CrossTowerViewPhaseId[],
): ProgramInitiativeRowV6[] {
  const towerSet =
    selectedTowerIds.length > 0 ? new Set(selectedTowerIds) : null;
  const phaseSet =
    selectedPhases.length > 0 ? new Set(selectedPhases) : null;

  return initiatives.filter((r) => {
    if (towerSet && !towerSet.has(r.towerId)) return false;
    if (phaseSet && !phaseSet.has(r.programTier as CrossTowerViewPhaseId)) {
      return false;
    }
    return true;
  });
}

/**
 * Narrow `SelectProgramResultV6` for tabs that only need `initiatives` +
 * `towersInScope` (Approach). Other fields stay full-program for cache
 * keys and any incidental reads (inputHash, threshold, programImpact).
 */
export function sliceProgramV6ForView(
  program: SelectProgramResultV6,
  selectedTowerIds: readonly TowerId[],
  selectedPhases: readonly CrossTowerViewPhaseId[],
): SelectProgramResultV6 {
  const initiatives = filterProgramInitiativesV6ByView(
    program.initiatives,
    selectedTowerIds,
    selectedPhases,
  );
  const towerIds = new Set(initiatives.map((i) => i.towerId));
  const towersInScope = program.towersInScope.filter((t) =>
    towerIds.has(t.id),
  );
  return {
    ...program,
    initiatives,
    towersInScope,
  };
}
