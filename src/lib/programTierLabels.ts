// Display copy for `ProgramTier`. Centralized so the cross-tower KPI strip,
// roadmap headers, Gantt panels, and the rejected-from-plan drawer all share
// the same wording. The labels carry the 2x2 axes inline so an executive
// reading any single chip can trace it back to "feasibility × business
// impact" without flipping pages.

import type { ProgramTier } from "@/data/types";

export type ProgramTierLabel = {
  /** Numeral form, e.g. "P1". `null` for Deprioritized. */
  numeral: ProgramTier | null;
  /** One- to two-word semantic name, e.g. "Quick Wins". */
  name: string;
  /** Full axis annotation, e.g. "P1 — Quick Wins (HF · HBI)". */
  axisLabel: string;
  /** Long-form sentence used in tooltips, narratives, and roadmap captions. */
  longLabel: string;
};

const LABELS: Record<ProgramTier, ProgramTierLabel> = {
  P1: {
    numeral: "P1",
    name: "Quick Wins",
    axisLabel: "P1 — Quick Wins (HF · HBI)",
    longLabel:
      "High feasibility, high parent-L4 Activity Group business impact — sequenced first because they ship fast and move the most material $.",
  },
  P2: {
    numeral: "P2",
    name: "Fill-ins",
    axisLabel: "P2 — Fill-ins (HF · LBI)",
    longLabel:
      "High feasibility, smaller parent-L4 Activity Group impact — slotted into capacity once the Quick Wins are in flight.",
  },
  P3: {
    numeral: "P3",
    name: "Strategic Builds",
    axisLabel: "P3 — Strategic Builds (LF · HBI)",
    longLabel:
      "Lower feasibility but high parent-L4 Activity Group impact — worth the longer build window because the prize is large; later start reflects build duration, not lower importance.",
  },
  Deprioritized: {
    numeral: null,
    name: "Below the line",
    axisLabel: "Deprioritized (LF · LBI)",
    longLabel:
      "Lower feasibility and lower parent-L4 Activity Group impact — held outside the active plan; revisit when feasibility moves or scope expands.",
  },
};

export function programTierLabel(pt: ProgramTier): ProgramTierLabel {
  return LABELS[pt];
}

/**
 * Sort key for `ProgramTier`. P1 < P2 < P3 < Deprioritized. Used by every
 * cross-tower roster + Gantt row sorter.
 */
export function programTierRank(pt: ProgramTier | undefined | null): number {
  if (pt === "P1") return 0;
  if (pt === "P2") return 1;
  if (pt === "P3") return 2;
  if (pt === "Deprioritized") return 3;
  return 4;
}
