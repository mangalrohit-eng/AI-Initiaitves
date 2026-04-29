import type { Tower } from "@/data/types";
import { towers } from "@/data/towers";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { getTowerStaleState } from "@/lib/initiatives/curationHash";
import { getTowerHref } from "@/lib/towerHref";
import type { ResolvedJourneyGuidance } from "./types";

function orderedTowersList(
  minePicked: boolean,
  mineSet: Set<TowerId>,
): readonly Tower[] {
  return minePicked
    ? [
        ...towers.filter((t) => mineSet.has(t.id as TowerId)),
        ...towers.filter((t) => !mineSet.has(t.id as TowerId)),
      ]
    : [...towers];
}

function towersWithRows(
  ordered: readonly Tower[],
  program: AssessProgramV2,
): Tower[] {
  return ordered.filter((t) => {
    const rows = program.towers[t.id as TowerId]?.l3Rows ?? [];
    return rows.length > 0;
  });
}

/**
 * Program-home next step: L4 → dials → curation → sign-off.
 * Tower order: my towers first (if any), else catalog order.
 * When My towers is empty and more than one tower matches a gate, return a
 * program-level line + hub link so the first catalog tower (Finance) is not implied.
 */
export function resolveProgramHomeGuidance(
  program: AssessProgramV2,
  mine: ReadonlyArray<TowerId>,
): ResolvedJourneyGuidance {
  const minePicked = mine.length > 0;
  const mineSet = new Set(mine);
  const ordered = orderedTowersList(minePicked, mineSet);
  const withData = towersWithRows(ordered, program);

  const l4Need = withData.filter((t) => {
    const tw = program.towers[t.id as TowerId];
    return getTowerStaleState(tw).l4Stale;
  });
  if (l4Need.length > 0) {
    if (!minePicked && l4Need.length > 1) {
      return {
        tier: 1,
        title:
          "Several towers still have blank L3 rows on Step 1 — open the Capability Map hub and run Generate L4 where needed.",
        staleKind: null,
        actionHref: "/capability-map",
        actionLabel: "Open Capability Map hub",
      };
    }
    const t = l4Need[0];
    const tid = t.id as TowerId;
    return {
      tier: 1,
      title: `Resume Step 1 on ${t.name}: add L4 activities for every blank L3 on the Capability Map.`,
      staleKind: null,
      actionHref: getTowerHref(tid, "capability-map"),
      actionLabel: `Open ${t.name}`,
    };
  }

  const dialsNeed = withData.filter((t) => {
    const tw = program.towers[t.id as TowerId];
    return getTowerStaleState(tw).dialsStale;
  });
  if (dialsNeed.length > 0) {
    if (!minePicked && dialsNeed.length > 1) {
      return {
        tier: 1,
        title:
          "Several towers are still on upload-default dials on Step 2 — open Configure Impact Levers and set offshore and AI for each L3.",
        staleKind: null,
        actionHref: "/impact-levers",
        actionLabel: "Open Impact Levers hub",
      };
    }
    const t = dialsNeed[0];
    const tid = t.id as TowerId;
    return {
      tier: 1,
      title: `Resume Step 2 on ${t.name}: set offshore and AI for every L3 (inference or sliders).`,
      staleKind: null,
      actionHref: getTowerHref(tid, "impact-levers"),
      actionLabel: `Open ${t.name}`,
    };
  }

  const curationNeed = withData.filter((t) => {
    const tw = program.towers[t.id as TowerId];
    return getTowerStaleState(tw).initiativesStale;
  });
  if (curationNeed.length > 0) {
    if (!minePicked && curationNeed.length > 1) {
      return {
        tier: 1,
        title:
          "Several towers are queued for Step 4 refresh — open the towers list and run Refresh AI guidance on each tower that shows the banner.",
        staleKind: null,
        actionHref: "/towers",
        actionLabel: "Open towers",
      };
    }
    const t = curationNeed[0];
    const tid = t.id as TowerId;
    return {
      tier: 1,
      title: `Resume Step 4 on ${t.name}: run Refresh AI guidance so the roadmap matches the current L2–L4 list.`,
      staleKind: null,
      actionHref: getTowerHref(tid, "ai-initiatives"),
      actionLabel: `Open ${t.name}`,
    };
  }

  const signoffNeed = withData.filter((t) => {
    const tw = program.towers[t.id as TowerId];
    return tw?.status !== "complete";
  });
  if (signoffNeed.length > 0) {
    if (!minePicked && signoffNeed.length > 1) {
      return {
        tier: 3,
        title:
          "Several towers still need Step 2 tower-lead sign-off — open Configure Impact Levers and mark each reviewed when dials match your read.",
        staleKind: null,
        actionHref: "/impact-levers",
        actionLabel: "Open Impact Levers hub",
      };
    }
    const t = signoffNeed[0];
    const tid = t.id as TowerId;
    return {
      tier: 3,
      title: `Complete Step 2 sign-off for ${t.name} on Configure Impact Levers when dials match your read.`,
      staleKind: null,
      actionHref: getTowerHref(tid, "impact-levers"),
      actionLabel: `Open ${t.name}`,
    };
  }

  return {
    tier: 2,
    title:
      "Pick a step from the left rail: map and headcount, dials, impact total, then AI Initiatives.",
    staleKind: null,
  };
}
