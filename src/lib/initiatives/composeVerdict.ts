/**
 * Verdict composer — single source of truth for an L4's curation status.
 *
 * Layers, in precedence order (highest first):
 *
 *   1. **Canonical L4 carries `aiCurationStatus`**         (manual seed in the
 *      capability-map files; Phase 2 path)
 *   2. **`aiCurationOverlay` has an entry for this L4 id** (manual P1
 *      deep-curation + rubric corrections)
 *   3. **Rubric output**                                   (deterministic
 *      name-keyword classification — covers all 489 L4s)
 *
 * The LLM pipeline (PR 2) writes to `L3WorkforceRow.l4Items`, which the
 * selector prefers over the canonical-map path entirely. So this composer
 * is only consulted when the row's `l4Items` don't carry a verdict for
 * this specific L4 id.
 */

import type {
  AiPriority,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import type {
  AiCurationStatus,
  CapabilityL4,
} from "@/data/capabilityMap/types";
import { aiCurationOverlay } from "@/data/capabilityMap/aiCurationOverlay";
import { classifyL4 } from "./eligibilityRubric";
import type { NotEligibleReason } from "@/data/assess/types";

export type ComposedVerdict = {
  status: AiCurationStatus;
  aiEligible: boolean;
  aiPriority?: AiPriority;
  aiRationale: string;
  notEligibleReason?: NotEligibleReason;
  frequency?: TowerProcessFrequency;
  criticality?: TowerProcessCriticality;
  currentMaturity?: TowerProcessMaturity;
  primaryVendor?: string;
  agentOneLine?: string;
  initiativeId?: string;
  briefSlug?: string;
  /**
   * Provenance — used by the selector's source-mix log.
   * `l4item` = persisted `L3WorkforceRow.l4Items` from Step 4 curation.
   */
  source: "canonical" | "overlay" | "rubric" | "l4item";
};

export type ComposeInput = {
  towerId: string;
  l2Name: string;
  l3Name: string;
  l4: CapabilityL4;
};

/**
 * Compose a final verdict for an L4 by stacking canonical → overlay → rubric.
 * Pure function — safe to call inside the selector loop.
 */
export function composeL4Verdict(input: ComposeInput): ComposedVerdict {
  const { l4 } = input;

  // 1. Canonical L4 carries direct fields — this is the Phase 2 path where
  //    a tower lead has hand-encoded the L4's verdict on the canonical map.
  if (l4.aiCurationStatus) {
    return {
      status: l4.aiCurationStatus,
      aiEligible: l4.aiEligible ?? l4.aiCurationStatus === "curated",
      aiPriority: l4.aiPriority,
      aiRationale: l4.aiRationale ?? "",
      frequency: l4.frequency,
      criticality: l4.criticality,
      currentMaturity: l4.currentMaturity,
      initiativeId: l4.initiativeId,
      briefSlug: l4.briefSlug,
      source: "canonical",
    };
  }

  // 2. Overlay file — hand-curated P1s and rubric corrections.
  const overlay = aiCurationOverlay[l4.id];
  if (overlay) {
    return {
      status: overlay.aiCurationStatus,
      aiEligible: overlay.aiCurationStatus === "curated",
      aiPriority: overlay.aiPriority,
      aiRationale: overlay.aiRationale,
      notEligibleReason: overlay.notEligibleReason,
      frequency: overlay.frequency,
      criticality: overlay.criticality,
      currentMaturity: overlay.currentMaturity,
      primaryVendor: overlay.primaryVendor,
      agentOneLine: overlay.agentOneLine,
      initiativeId: overlay.initiativeId,
      briefSlug: overlay.briefSlug,
      source: "overlay",
    };
  }

  // 3. Rubric — deterministic name-keyword classification.
  const verdict = classifyL4({
    towerId: input.towerId,
    l2Name: input.l2Name,
    l3Name: input.l3Name,
    l4Name: l4.name,
  });
  return {
    status: verdict.status,
    aiEligible: verdict.aiEligible,
    aiPriority: verdict.aiPriority,
    aiRationale: verdict.aiRationale,
    notEligibleReason: verdict.notEligibleReason,
    source: "rubric",
  };
}
