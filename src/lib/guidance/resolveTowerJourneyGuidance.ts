import { getTowerHref } from "@/lib/towerHref";
import type { TowerId } from "@/data/assess/types";
import type {
  AiInitiativesGuidanceInput,
  CapabilityMapGuidanceInput,
  ImpactLeversGuidanceInput,
  ResolvedJourneyGuidance,
} from "./types";

/**
 * Step 1 — per-tower capability map. Tier 0 = no data; 1 = L4 missing; 2 = done with L4, user edits/continue.
 */
export function resolveCapabilityMapGuidance(
  input: CapabilityMapGuidanceInput,
): ResolvedJourneyGuidance {
  const { rowCount, blankL4Count, stale, towerId } = input;
  if (rowCount === 0) {
    return {
      tier: 0,
      title: "Load your tower’s capability map and headcount, or return to the hub to load the illustrative sample program.",
      staleKind: null,
      actionHref: "/capability-map",
      actionLabel: "Back to hub",
    };
  }
  if (blankL4Count > 0 && stale.l4Stale) {
    return {
      tier: 1,
      title: "Refresh the tree: run Generate L4 activities for every blank L3 before you configure dials (Step 2) or design AI initiatives (Step 4).",
      staleKind: "l4",
      actionHref: "#generate-l4-toolbar",
      actionLabel: "Jump to Generate L4",
    };
  }
  if (!input.l1L3JourneyStepComplete) {
    return {
      tier: 2,
      title:
        "Review the L1–L3 tree and headcount for this tower, then mark it validated to continue.",
      staleKind: null,
      actionLabel: "Confirm L1–L3 reviewed",
      actionKind: "confirm",
    };
  }
  return {
    tier: 2,
    title: "Next: open Configure Impact Levers to score offshore and AI dials for each L3.",
    staleKind: null,
    actionHref: getTowerHref(towerId, "impact-levers"),
    actionLabel: "Configure Impact Levers",
  };
}

/**
 * Step 2 — per-tower impact levers.
 */
export function resolveImpactLeversGuidance(
  input: ImpactLeversGuidanceInput,
): ResolvedJourneyGuidance {
  const { rowCount, stale, isTowerLeadComplete, towerName, towerId } = input;
  if (rowCount === 0) {
    return {
      tier: 0,
      title: `No capability map and headcount for ${towerName}—open the Capability Map and upload or load sample data first.`,
      staleKind: null,
      actionHref: getTowerHref(towerId, "capability-map"),
      actionLabel: "Open Capability Map",
    };
  }
  if (stale.dialsStale) {
    return {
      tier: 1,
      title: "Re-score the offshore and AI dials: values are at upload defaults; run the Versant-grounded inference so per-L3 rationales attach to every lever.",
      staleKind: "dials",
      actionHref: "#stale-dials-panel",
      actionLabel: "Jump to re-score",
    };
  }
  if (!isTowerLeadComplete) {
    return {
      tier: 3,
      title: "Align with leadership: use Tower lead sign-off when this tower’s dials and assumptions match your read—this anchors the Step 3 impact view.",
      staleKind: null,
    };
  }
  return {
    tier: 3,
    title: "Dials and sign-off are in place; open this tower in AI Initiatives for the sequenced agenda and 4-lens process detail.",
    staleKind: null,
    actionHref: getTowerHref(towerId, "ai-initiatives"),
    actionLabel: "Open AI Initiatives",
  };
}

/**
 * Step 4 — per-tower AI initiatives. Step-scoped only: no dials nudge here.
 */
export function resolveAiInitiativesGuidance(
  input: AiInitiativesGuidanceInput,
): ResolvedJourneyGuidance {
  const { stale, pendingReviewCount, towerName, towerId } = input;
  if (stale.missingL4ForRefresh) {
    return {
      tier: 1,
      title: `Queued curation is blocked on L4: open ${towerName} on the Capability Map and run Generate L4 activities, then return here to refresh AI guidance.`,
      staleKind: "curation",
      actionHref: getTowerHref(towerId, "capability-map"),
      actionLabel: "Open Capability Map",
    };
  }
  if (stale.initiativesStale) {
    return {
      tier: 1,
      title: "Refresh the initiative list: the capability map changed and AI eligibility is queued—run Refresh AI guidance so the roadmap and dollars match the latest L2–L4 list.",
      staleKind: "curation",
      actionHref: "#stale-curation-panel",
      actionLabel: "Jump to refresh",
    };
  }
  if (pendingReviewCount > 0) {
    return {
      tier: 2,
      title: `Validate or reject every L4 initiative below—the header chip still shows ${pendingReviewCount} pending. Decisions apply across the By capability and Priority roadmap tabs.`,
      staleKind: null,
    };
  }
  return {
    tier: 3,
    title: "Validate the capability map, roadmap, and agent view against the dial set on Configure Impact Levers; change a dial there and this tower’s modeled savings update on the next load.",
    staleKind: null,
  };
}

export function hubCapabilityMapLine(hasAnyTowerData: boolean): ResolvedJourneyGuidance {
  if (!hasAnyTowerData) {
    return {
      tier: 0,
      title: "Start by loading the illustrative sample or scrolling to a tower, uploading a capability map, and running Generate L4 where rows are still blank.",
      staleKind: null,
      actionHref: "#tower-list",
      actionLabel: "Jump to towers",
    };
  }
  return {
    tier: 2,
    title: "Open each tower, confirm the map and headcount, then go to Step 2—my towers and completed counts are tracked in the grid below.",
    staleKind: null,
  };
}

export function hubImpactLeversLine(
  hasFootprint: boolean,
  hasDefaultOnlyTower: boolean,
  nextTower: { name: string; id: string } | null,
): ResolvedJourneyGuidance {
  if (!hasFootprint) {
    return {
      tier: 0,
      title: "Complete Step 1 (Capability Map) for at least one tower so the blended pool and dials can run on real headcount.",
      staleKind: null,
    };
  }
  if (hasDefaultOnlyTower && nextTower) {
    return {
      tier: 2,
      title: `Configure dials: ${nextTower.name} still has upload-default levers—open that tower, run Re-score, or set sliders manually, then return here to see the roll-up refresh.`,
      staleKind: null,
      actionHref: getTowerHref(nextTower.id as TowerId, "impact-levers"),
      actionLabel: `Open ${nextTower.name}`,
    };
  }
  return {
    tier: 3,
    title: "Review the program-wide total; open a tower in Step 2 to stress-test levers, then go to the Impact estimate summary in Step 3.",
    staleKind: null,
    actionHref: "/impact-levers/summary",
    actionLabel: "Open impact estimate",
  };
}

export function impactEstimateSummaryLine(hasFootprint: boolean): ResolvedJourneyGuidance {
  if (!hasFootprint) {
    return {
      tier: 0,
      title: "Add tower data in Step 1 so this program-wide view shows blended offshore and AI savings; load the sample on the hub if you are exploring the model.",
      staleKind: null,
    };
  }
  return {
    tier: 3,
    title: "Validate the program roll-up, adjust offshore and AI under Assumptions if the blended rates are wrong, and export a CSV or PNG for MS NOW, CNBC, and Golf leadership reviews.",
    staleKind: null,
    actionHref: "/assumptions",
    actionLabel: "Open Assumptions",
  };
}

export function towersPageLine(
  resume: { name: string; id: TowerId } | null,
): ResolvedJourneyGuidance {
  if (resume) {
    return {
      tier: 2,
      title: `Start with ${resume.name}: curation and dial logic are still in motion. Open the tower, refresh AI guidance on Step 4 if the banner is lit, and clear pending validations before you go deep on a single process.`,
      staleKind: null,
      actionHref: getTowerHref(resume.id, "ai-initiatives"),
      actionLabel: `Open ${resume.name}`,
    };
  }
  return {
    tier: 2,
    title: "Select a tower to read the P1 / P2 / P3 AI roadmap, agent graph, and 4-lens (work, workforce, workbench, digital core) for every named L4 initiative.",
    staleKind: null,
  };
}

export function processDetailStaticLine(
  processName: string,
  towerName: string,
): ResolvedJourneyGuidance {
  return {
    tier: 2,
    title: `Work the Work, Workforce, Workbench, and Digital core tabs for ${processName} (${towerName}), then return to the tower view to align initiatives with the dials and validation chip.`,
    staleKind: null,
  };
}

export function briefDetailStaticLine(briefName: string, towerName: string): ResolvedJourneyGuidance {
  return {
    tier: 2,
    title: `Read the brief, evidence, and linked operating context for ${briefName} on ${towerName}, then return to the tower to validate the initiative row or follow the agent link from the list.`,
    staleKind: null,
  };
}
