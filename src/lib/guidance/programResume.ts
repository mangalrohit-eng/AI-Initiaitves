import { towers } from "@/data/towers";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { getTowerStaleState } from "@/lib/initiatives/curationHash";
import { getTowerHref } from "@/lib/towerHref";
import type { ResolvedJourneyGuidance } from "./types";

/**
 * Deterministic program-home next step: L4 → dials → curation, then first unsigned tower.
 * Tower order: my towers first (if any), else `towers` order.
 */
export function resolveProgramHomeGuidance(
  program: AssessProgramV2,
  mine: ReadonlyArray<TowerId>,
): ResolvedJourneyGuidance {
  const minePicked = mine.length > 0;
  const mineSet = new Set(mine);
  const orderedTowers = minePicked
    ? [
        ...towers.filter((t) => mineSet.has(t.id as TowerId)),
        ...towers.filter((t) => !mineSet.has(t.id as TowerId)),
      ]
    : [...towers];

  for (const t of orderedTowers) {
    const tid = t.id as TowerId;
    const tw = program.towers[tid];
    const rows = tw?.l3Rows ?? [];
    if (rows.length === 0) continue;
    const stale = getTowerStaleState(tw);
    if (stale.l4Stale) {
      return {
        tier: 1,
        title: `Resume on ${t.name} (Step 1): add L4 activities to every blank L3 on the Capability Map before you move dials on Step 2.`,
        staleKind: null,
        actionHref: getTowerHref(tid, "capability-map"),
        actionLabel: "Open",
      };
    }
  }
  for (const t of orderedTowers) {
    const tid = t.id as TowerId;
    const tw = program.towers[tid];
    const rows = tw?.l3Rows ?? [];
    if (rows.length === 0) continue;
    const stale = getTowerStaleState(tw);
    if (stale.dialsStale) {
      return {
        tier: 1,
        title: `Resume on ${t.name} (Step 2): re-score or set offshore and AI dials so the program impact is not sitting on upload defaults.`,
        staleKind: null,
        actionHref: getTowerHref(tid, "impact-levers"),
        actionLabel: "Open",
      };
    }
  }
  for (const t of orderedTowers) {
    const tid = t.id as TowerId;
    const tw = program.towers[tid];
    const rows = tw?.l3Rows ?? [];
    if (rows.length === 0) continue;
    const stale = getTowerStaleState(tw);
    if (stale.initiativesStale) {
      return {
        tier: 1,
        title: `Resume on ${t.name} (Step 4): refresh AI guidance on the AI Initiatives view so curation matches the current L2–L4 list.`,
        staleKind: null,
        actionHref: getTowerHref(tid, "ai-initiatives"),
        actionLabel: "Open",
      };
    }
  }
  for (const t of orderedTowers) {
    const tid = t.id as TowerId;
    const tw = program.towers[tid];
    const rows = tw?.l3Rows ?? [];
    if (rows.length === 0) continue;
    if (tw?.status !== "complete") {
      return {
        tier: 3,
        title: `Complete Step 2 for ${t.name}: apply Tower lead sign-off on Configure Impact Levers so the impact estimate and AI Initiatives handoff stay defensible to MS NOW, CNBC, and Golf leadership.`,
        staleKind: null,
        actionHref: getTowerHref(tid, "impact-levers"),
        actionLabel: "Open",
      };
    }
  }
  return {
    tier: 2,
    title: "Start or continue the five-step path on the left: map and headcount, dials, impact total, then AI Initiatives and the offshore design track when it opens.",
    staleKind: null,
  };
}
