import { getTowerHref } from "@/lib/towerHref";
import type { TowerId } from "@/data/assess/types";
import type {
  AiInitiativesGuidanceInput,
  CapabilityMapGuidanceInput,
  ImpactLeversGuidanceInput,
  ResolvedJourneyGuidance,
} from "./types";

/**
 * Step 1 — per-tower capability map. Tier 0 = no data; 1 = L5 Activities
 * missing on one or more L4 Activity Groups; 2 = done with L5 generation,
 * user edits / continues.
 */
export function resolveCapabilityMapGuidance(
  input: CapabilityMapGuidanceInput,
): ResolvedJourneyGuidance {
  const { rowCount, blankL4Count, stale, towerId } = input;
  if (rowCount === 0) {
    return {
      tier: 0,
      title: "Upload this tower’s capability map and headcount here, or jump back to the Capability Map hub to switch towers.",
      staleKind: null,
      actionHref: "/capability-map",
      actionLabel: "Back to hub",
    };
  }
  if (blankL4Count > 0 && stale.l4Stale) {
    return {
      tier: 1,
      title: "Run Generate L5 Activities for every L4 Activity Group with no leaves before you open Step 2 or Step 4.",
      staleKind: "l4",
      actionHref: "#generate-l4-toolbar",
      actionLabel: "Jump to Generate L5",
    };
  }
  if (!input.l1L3JourneyStepComplete) {
    return {
      tier: 2,
      title: "Review this tower’s L1–L4 hierarchy and headcount, then mark Step 1 reviewed below.",
      staleKind: null,
      actionLabel: "Mark Step 1 reviewed",
      actionKind: "confirm",
    };
  }
  return {
    tier: 2,
    title: "Open Configure Impact Levers to set offshore and AI for each L4 Activity Group.",
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
      title: `No map or headcount for ${towerName} yet — open the Capability Map and upload your CSV / XLSX.`,
      staleKind: null,
      actionHref: getTowerHref(towerId, "capability-map"),
      actionLabel: "Open Capability Map",
    };
  }
  if (stale.dialsStale) {
    return {
      tier: 1,
      title:
        "Set offshore and AI for every L4 Activity Group — this tower is still on upload-default levers (use the panel below or set sliders row by row).",
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
  const { stale, pendingReviewCount, towerName, towerId, stepFourValidated } = input;
  if (stale.missingL4ForRefresh) {
    return {
      tier: 1,
      title: `Open ${towerName} on the Capability Map and run Generate L5 Activities for blank L4 Activity Group rows — curation cannot refresh until L5 Activities exist.`,
      staleKind: "curation",
      actionHref: getTowerHref(towerId, "capability-map"),
      actionLabel: "Open Capability Map",
    };
  }
  if (stale.initiativesStale) {
    return {
      tier: 1,
      title: "Run Refresh AI guidance so the roadmap and dollars match your latest L2–L5 list.",
      staleKind: "curation",
      actionHref: "#stale-curation-panel",
      actionLabel: "Jump to refresh",
    };
  }
  if (pendingReviewCount > 0) {
    return {
      tier: 2,
      title: `Validate or reject each L5 Activity below — ${pendingReviewCount} still pending in the header chip.`,
      staleKind: null,
    };
  }
  if (!stepFourValidated) {
    return {
      tier: 2,
      title: `Mark Step 4 reviewed for ${towerName} when the AI roadmap and agent architectures are workshop-ready.`,
      staleKind: null,
      actionHref: "#tower-lead-signoff",
      actionLabel: "Jump to sign-off",
    };
  }
  return {
    tier: 3,
    title:
      "Spot-check roadmap rows against your Step 2 dials; change a dial on Configure Impact Levers and reload this view to refresh impact.",
    staleKind: null,
  };
}

export function hubCapabilityMapLine(hasAnyTowerData: boolean): ResolvedJourneyGuidance {
  if (!hasAnyTowerData) {
    return {
      tier: 0,
      title: "Pick a tower below, upload its capability map and headcount, then run Generate L5 Activities on any blank L4 Activity Group.",
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

export function impactEstimateSummaryLine(
  hasFootprint: boolean,
  pendingStep3Count = 0,
): ResolvedJourneyGuidance {
  if (!hasFootprint) {
    return {
      tier: 0,
      title: "Add tower data on Step 1 first — once at least one tower has its capability map uploaded the program roll-up lights up here.",
      staleKind: null,
    };
  }
  if (pendingStep3Count > 0) {
    return {
      tier: 2,
      title: `${pendingStep3Count} tower${pendingStep3Count === 1 ? "" : "s"} still awaiting Step 3 validation — scroll to each tower row and mark reviewed once the roll-up matches your workshop read.`,
      staleKind: null,
    };
  }
  return {
    tier: 3,
    title:
      "Every tower's impact estimate is signed off. Open Assumptions if blended offshore or AI rates need changing before you brief leadership.",
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
    title: "Select a tower to read its feasibility roster (Ship-ready vs. Investigate), agent graph, and 4-lens (work, workforce, workbench, digital core) for every named L4 initiative. Final P1 / P2 / P3 sequencing is set on the Cross-Tower AI Plan.",
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
