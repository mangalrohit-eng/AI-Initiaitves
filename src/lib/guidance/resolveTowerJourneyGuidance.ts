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
      title: "Load this tower’s map and headcount here, or open the Capability Map hub for the illustrative sample.",
      staleKind: null,
      actionHref: "/capability-map",
      actionLabel: "Back to hub",
    };
  }
  if (blankL4Count > 0 && stale.l4Stale) {
    return {
      tier: 1,
      title: "Run Generate L4 for every blank L3 before you open Step 2 or Step 4.",
      staleKind: "l4",
      actionHref: "#generate-l4-toolbar",
      actionLabel: "Jump to Generate L4",
    };
  }
  if (!input.l1L3JourneyStepComplete) {
    return {
      tier: 2,
      title: "Review this tower’s L1–L3 tree and headcount, then confirm below.",
      staleKind: null,
      actionLabel: "Confirm L1–L3 reviewed",
      actionKind: "confirm",
    };
  }
  return {
    tier: 2,
    title: "Open Configure Impact Levers to set offshore and AI for each L3.",
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
      title: `No map or headcount for ${towerName} yet — open the Capability Map and upload or load sample data.`,
      staleKind: null,
      actionHref: getTowerHref(towerId, "capability-map"),
      actionLabel: "Open Capability Map",
    };
  }
  if (stale.dialsStale) {
    return {
      tier: 1,
      title:
        "Set offshore and AI for every L3 — this tower is still on upload-default levers (use the panel below or set sliders row by row).",
      staleKind: "dials",
      actionHref: "#stale-dials-panel",
      actionLabel: "Jump to dial tools",
    };
  }
  if (!isTowerLeadComplete) {
    return {
      tier: 3,
      title:
        "When these dial positions match your read, scroll to Tower lead sign-off and mark this tower reviewed.",
      staleKind: null,
      actionHref: "#tower-lead-signoff",
      actionLabel: "Jump to sign-off",
    };
  }
  return {
    tier: 3,
    title: "Open AI Initiatives for this tower’s sequenced roadmap and 4-lens process detail.",
    staleKind: null,
    actionHref: getTowerHref(towerId, "ai-initiatives"),
    actionLabel: "Open AI Initiatives",
    secondaryActionHref: "#tower-lead-signoff",
    secondaryActionLabel: "Jump to sign-off section",
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
      title: `Open ${towerName} on the Capability Map and run Generate L4 for blank rows — curation cannot refresh until L4 exists.`,
      staleKind: "curation",
      actionHref: getTowerHref(towerId, "capability-map"),
      actionLabel: "Open Capability Map",
    };
  }
  if (stale.initiativesStale) {
    return {
      tier: 1,
      title: "Run Refresh AI guidance so the roadmap and dollars match your latest L2–L4 list.",
      staleKind: "curation",
      actionHref: "#stale-curation-panel",
      actionLabel: "Jump to refresh",
    };
  }
  if (pendingReviewCount > 0) {
    return {
      tier: 2,
      title: `Validate or reject each L4 below — ${pendingReviewCount} still pending in the header chip.`,
      staleKind: null,
    };
  }
  return {
    tier: 3,
    title:
      "Spot-check roadmap rows against your Step 2 dials; change a dial on Configure Impact Levers and reload this view to refresh modeled savings.",
    staleKind: null,
  };
}

export function hubCapabilityMapLine(hasAnyTowerData: boolean): ResolvedJourneyGuidance {
  if (!hasAnyTowerData) {
    return {
      tier: 0,
      title: "Load the illustrative sample or pick a tower below, then upload a map and run Generate L4 on any blank L3.",
      staleKind: null,
      actionHref: "#tower-list",
      actionLabel: "Jump to towers",
    };
  }
  return {
    tier: 2,
    title: "Open each tower, confirm map and headcount on Step 1, then move to Step 2 — progress is tracked in the grid below.",
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
      title: `${nextTower.name} still has upload-default levers — open that tower on Step 2 and set offshore and AI for each L3.`,
      staleKind: null,
      actionHref: getTowerHref(nextTower.id as TowerId, "impact-levers"),
      actionLabel: `Open ${nextTower.name}`,
    };
  }
  return {
    tier: 3,
    title: "Review the program roll-up here, then open Step 3 (impact estimate summary) when you are ready to brief leadership.",
    staleKind: null,
    actionHref: "/impact-levers/summary",
    actionLabel: "Open impact estimate",
  };
}

export function impactEstimateSummaryLine(hasFootprint: boolean): ResolvedJourneyGuidance {
  if (!hasFootprint) {
    return {
      tier: 0,
      title: "Add tower data on Step 1 first — or load the illustrative sample on the Capability Map hub to explore the model.",
      staleKind: null,
    };
  }
  return {
    tier: 3,
    title:
      "Validate the program roll-up against your workshop read — open Assumptions if blended offshore or AI rates need changing.",
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
      title: `Start with ${resume.name} — refresh AI guidance on Step 4 if the banner is lit, then clear pending L4 validations.`,
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
