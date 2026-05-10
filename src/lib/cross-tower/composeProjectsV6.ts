/**
 * Cross-Tower AI Plan — deterministic project composition.
 *
 * AI initiatives are authored at L3 grain and each one becomes ONE
 * `AIProjectResolved`. The composer is therefore a 1-to-1 map from
 * `ProgramInitiativeRowV6` → `AIProjectResolved`, with:
 *
 *   - **Deterministic 2x2** at the program median:
 *       value = parent-L3 modeled $ (median split across the program)
 *       effort = inverse of `feasibility` (High → "Low" effort, else "High")
 *   - **Timing** from the `phasePlanTiming` helpers using the
 *     `programTier` already stamped by the selector (so P1/P2/P3 windows
 *     stay consistent with the page assumptions and the Gantt math).
 *   - **Narrative** from LLM synthesis when supplied; otherwise the
 *     deterministic L3Initiative `aiRationale` + `tagline` carry the card.
 *
 * What the composer does NOT populate:
 *   - `brief` — v6 generates the four-lens brief lazily on the deep-dive
 *     page, stored on `L3Initiative.generatedProcess`. Cross-tower cards
 *     link to that page; they don't render the brief inline.
 *   - `effortDrivers` — v6 derives effort from `feasibility` directly so
 *     there's nothing for the LLM to author here.
 *   - `constituents` — v6 has no roll-up (the project IS the initiative).
 */
import type {
  AIProjectResolved,
  EffortBucket,
  Quadrant,
  ValueBucket,
} from "@/lib/cross-tower/aiProjects";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import {
  buildMonthsForTier,
  effectiveProjectStartMonth,
  type ComposePlanTier,
} from "@/lib/cross-tower/phasePlanTiming";
import type { ProgramInitiativeRowV6 } from "@/lib/initiatives/selectV6Program";
import type { ProgramTier } from "@/data/types";

export type ProgramSynthesisLLMV6 = {
  /** ≤55 words; the page-header executive summary. */
  executiveSummary: string;
  /** 3-8 program-level risks (LLM-authored). */
  risks: { title: string; description: string; mitigation: string }[];
  /** Roadmap narrative — replaces phase-keyed copy. */
  roadmapNarrative: {
    overall: string;
    ladder: string;
    milestones: string[];
    ownerNotes: string[];
  };
  /** ≤45 words; vendor + ecosystem commentary. */
  architectureVendors: string;
  /** ≤45 words; data + digital core commentary. */
  architectureDataCore: string;
  /** ≤45 words; agentic-pattern + delivery commentary (replaces orchestration). */
  architectureDelivery: string;
};

/**
 * Per-initiative narrative that the v6 program synthesis call may author.
 * Optional — when absent we fall back to the deterministic `aiRationale`
 * already on the row.
 */
export type InitiativeNarrativeV6 = {
  initiativeId: string;
  /** ≤25 words; cross-tower framing — not just "what the AI does". */
  narrative: string;
  /** ≤22 words; why this is value-{High|Low}. */
  valueRationale: string;
  /** ≤22 words; why this is effort-{High|Low}. */
  effortRationale: string;
};

export type ComposeProjectsV6Input = {
  initiatives: ProgramInitiativeRowV6[];
  /** Optional per-initiative narrative authored by the program synthesis call. */
  narratives?: InitiativeNarrativeV6[];
  assumptions: CrossTowerAssumptions;
};

export function composeProjectsV6(
  input: ComposeProjectsV6Input,
): AIProjectResolved[] {
  const { initiatives, narratives, assumptions } = input;
  const narrativeById = new Map<string, InitiativeNarrativeV6>();
  for (const n of narratives ?? []) narrativeById.set(n.initiativeId, n);

  // --- Median split for value × effort -----------------------------------
  // Value axis: parent-L3 modeled $. Effort axis: 0 (Low) when feasibility
  // is High, 1 (High) otherwise. Two-bucket effort means a strict median
  // doesn't apply — feasibility IS the bucket. Value uses the program
  // median (post-tier, post-threshold).
  const valueScores = initiatives.map((r) => r.aiUsd);
  const valueMedian = median(valueScores);
  const useMedianSplit = initiatives.length >= 2;

  const resolved: AIProjectResolved[] = initiatives.map((row) => {
    const valueBucket: ValueBucket = !useMedianSplit
      ? row.aiUsd >= 1_000_000
        ? "High"
        : "Low"
      : row.aiUsd >= valueMedian
        ? "High"
        : "Low";
    const effortBucket: EffortBucket =
      row.feasibility === "High" ? "Low" : "High";
    const quadrant: Quadrant = deriveQuadrant(valueBucket, effortBucket);
    const isDeprioritized = quadrant === "Deprioritize";

    const tier = composePlanTierFromProgramTier(row.programTier);
    const startMonth = effectiveProjectStartMonth(assumptions, tier);
    const buildMonths = buildMonthsForTier(assumptions, tier);
    const valueStartMonth = Math.max(1, startMonth + buildMonths);

    const synth = narrativeById.get(row.id);
    const narrative = synth?.narrative ?? row.aiRationale;
    const valueRationale = synth?.valueRationale ?? buildValueRationale(row, valueBucket);
    const effortRationale = synth?.effortRationale ?? buildEffortRationale(row, effortBucket);

    return {
      id: row.id,
      parentL4ActivityGroupId: row.id,
      parentL4ActivityGroupName: row.l3Name,
      primaryTowerId: row.towerId,
      primaryTowerName: row.towerName,
      programTier: row.programTier,
      name: row.solutionName,
      narrative,
      constituentInitiativeIds: [row.id],
      valueBucket,
      effortBucket,
      valueRationale,
      effortRationale,
      quadrant,
      attributedAiUsd: row.attributedAiUsd,
      startMonth,
      buildMonths,
      rampMonths: assumptions.rampMonths,
      valueStartMonth,
      isStub: false,
      isDeprioritized,
      aiRationale: row.aiRationale,
      primaryVendor: row.primaryVendor,
      feasibility: row.feasibility,
      tagline: row.tagline,
      l3FamilyName: row.l3Name,
      deepDiveHref: `/tower/${row.towerId}/initiative/${encodeURIComponent(row.l3RowId)}/${encodeURIComponent(row.id)}`,
    };
  });

  return resolved.sort(compareResolvedV6);
}

function deriveQuadrant(value: ValueBucket, effort: EffortBucket): Quadrant {
  if (value === "High" && effort === "Low") return "Quick Win";
  if (value === "High" && effort === "High") return "Strategic Bet";
  if (value === "Low" && effort === "Low") return "Fill-in";
  return "Deprioritize";
}

function buildValueRationale(
  row: ProgramInitiativeRowV6,
  bucket: ValueBucket,
): string {
  const headline =
    bucket === "High"
      ? `High-value: parent ${row.l3Name} carries program-leading modeled $.`
      : `Lower-value relative to peers in plan; parent ${row.l3Name} sits below the program median.`;
  return headline;
}

function buildEffortRationale(
  row: ProgramInitiativeRowV6,
  bucket: EffortBucket,
): string {
  if (bucket === "Low") {
    return row.primaryVendor
      ? `High-feasibility AI Solution; ${row.primaryVendor} is a proven anchor for this pattern.`
      : "High-feasibility AI Solution: the curator marked this as a proven pattern against the program's tooling baseline.";
  }
  return row.primaryVendor
    ? `Lower-feasibility build (${row.primaryVendor} integration / change management lift); plan accordingly.`
    : "Lower-feasibility build — the curator flagged change-management or platform-readiness as the binding constraint.";
}

function quadrantRank(q: Quadrant | null): number {
  switch (q) {
    case "Quick Win":
      return 0;
    case "Strategic Bet":
      return 1;
    case "Fill-in":
      return 2;
    case "Deprioritize":
      return 3;
    default:
      return 90;
  }
}

function compareResolvedV6(a: AIProjectResolved, b: AIProjectResolved): number {
  const qa = quadrantRank(a.quadrant);
  const qb = quadrantRank(b.quadrant);
  if (qa !== qb) return qa - qb;
  const usd = b.attributedAiUsd - a.attributedAiUsd;
  if (Math.abs(usd) > 1) return usd;
  const tower = a.primaryTowerName.localeCompare(b.primaryTowerName);
  if (tower !== 0) return tower;
  return a.name.localeCompare(b.name);
}

function composePlanTierFromProgramTier(pt: ProgramTier): ComposePlanTier {
  if (pt === "P1" || pt === "P2" || pt === "P3") return pt;
  // Deprioritized rows are filtered out before they reach this composer; if
  // one slips through, route to P3 (latest start) so the math stays well-
  // defined and the row still shows up at the back of the queue.
  return "P3";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
