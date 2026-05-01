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
 *
 * Feasibility derivation:
 *
 * Every layer can supply EITHER an explicit `feasibility` field (canonical
 * or overlay rows that have been hand-back-filled) OR the legacy
 * `aiPriority` field, which is mapped through `feasibilityFromAiPriority()`.
 * The mapping is deliberately asymmetric:
 *
 *   - `aiPriority === "P1 — …"`  →  `feasibility === "High"`
 *   - `aiPriority === "P2 — …"`  →  `feasibility === "Low"`
 *   - `aiPriority === "P3 — …"`  →  `feasibility === "Low"`
 *
 * The asymmetry reflects the original P-tier semantics: P1 was reserved for
 * "rules-based + named vendor ready" work; P2/P3 mixed real opportunities
 * with longer build horizons. Defaulting them all to "Low" is the safest
 * back-compat call — the next time the L4 is curated, the LLM or human
 * editor will set `feasibility` directly, and that explicit value wins.
 */

import type {
  AiPriority,
  Feasibility,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import type {
  AiCurationStatus,
  CapabilityL5,
} from "@/data/capabilityMap/types";
import { aiCurationOverlay } from "@/data/capabilityMap/aiCurationOverlay";
import { classifyL4 } from "./eligibilityRubric";
import type { NotEligibleReason } from "@/data/assess/types";

export type ComposedVerdict = {
  status: AiCurationStatus;
  aiEligible: boolean;
  /**
   * Legacy P-tier — passed through for any back-compat reader (e.g. snapshot
   * capture on initiative-review actions). Cross-tower priority is derived
   * from `feasibility` + parent-L4 Activity Group business impact in the
   * program selector; never read this for sequencing decisions.
   *
   * @deprecated Use `feasibility`; will be dropped once snapshots stop
   * referencing the old field.
   */
  aiPriority?: AiPriority;
  /** Binary ship-readiness — feeds the cross-tower 2x2. */
  feasibility?: Feasibility;
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
  /**
   * Parent L3 Job Family name (was L2 Pillar pre-migration). Kept as
   * `l2Name` for back-compat with the rubric input shape; rubric reads it
   * as the bucket-name signal.
   */
  l2Name: string;
  /**
   * Parent L4 Activity Group name (was L3 Capability pre-migration). Kept
   * as `l3Name` for back-compat with the rubric input shape.
   */
  l3Name: string;
  /**
   * The L5 Activity (the leaf — was L4 Activity pre-migration). The AI
   * metadata fields read by the composer (aiCurationStatus, feasibility,
   * aiPriority, aiRationale, etc.) live on the leaf, which is now L5.
   * Field is still named `l4` for back-compat — pre-migration the leaf was
   * an L4. Renaming this field is a Phase 8 cleanup.
   */
  l4: CapabilityL5;
};

/**
 * Map a legacy `AiPriority` string into a binary `Feasibility`. Preserves
 * P1 → High; collapses P2 and P3 to Low. See file-level docs for the
 * asymmetry rationale.
 */
export function feasibilityFromAiPriority(p: AiPriority | undefined): Feasibility | undefined {
  if (!p) return undefined;
  if (p.startsWith("P1")) return "High";
  if (p.startsWith("P2")) return "Low";
  if (p.startsWith("P3")) return "Low";
  return undefined;
}

/**
 * Resolve `feasibility` from a layer that may supply either an explicit
 * `feasibility` field or the legacy `aiPriority`. Explicit feasibility
 * always wins. In dev, warn when both are explicitly set on the same row
 * — that means the curator picked one and forgot the other; the explicit
 * `feasibility` is authoritative, but the inconsistency is worth surfacing.
 */
function resolveFeasibility(
  feas: Feasibility | undefined,
  prio: AiPriority | undefined,
  context: string,
): Feasibility | undefined {
  if (feas && prio) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[forge.composeVerdict] ${context} — both 'feasibility' and 'aiPriority' explicitly set. ` +
          `Honoring 'feasibility'='${feas}'; legacy 'aiPriority'='${prio}' kept only for back-compat snapshot reads.`,
      );
    }
    return feas;
  }
  if (feas) return feas;
  return feasibilityFromAiPriority(prio);
}

/**
 * Compose a final verdict for an L4 by stacking canonical → overlay → rubric.
 * Pure function — safe to call inside the selector loop.
 */
export function composeL4Verdict(input: ComposeInput): ComposedVerdict {
  const { l4 } = input;

  // 1. Canonical L4 carries direct fields — this is the Phase 2 path where
  //    a tower lead has hand-encoded the L4's verdict on the canonical map.
  if (l4.aiCurationStatus) {
    const feasibility = resolveFeasibility(
      l4.feasibility,
      l4.aiPriority,
      `canonical L4 id=${l4.id}`,
    );
    return {
      status: l4.aiCurationStatus,
      aiEligible: l4.aiEligible ?? l4.aiCurationStatus === "curated",
      aiPriority: l4.aiPriority,
      feasibility,
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
    const feasibility = resolveFeasibility(
      // Overlay file shape predates `feasibility`; it only has aiPriority
      // today, so the explicit branch always falls through to the legacy map.
      undefined,
      overlay.aiPriority,
      `overlay id=${l4.id}`,
    );
    return {
      status: overlay.aiCurationStatus,
      aiEligible: overlay.aiCurationStatus === "curated",
      aiPriority: overlay.aiPriority,
      feasibility,
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

  // 3. Rubric — deterministic name-keyword classification. Rubric emits
  //    `feasibility` directly; no aiPriority back-compat needed here.
  const verdict = classifyL4({
    towerId: input.towerId,
    l2Name: input.l2Name,
    l3Name: input.l3Name,
    l4Name: l4.name,
  });
  return {
    status: verdict.status,
    aiEligible: verdict.aiEligible,
    feasibility: verdict.feasibility,
    aiRationale: verdict.aiRationale,
    notEligibleReason: verdict.notEligibleReason,
    source: "rubric",
  };
}
