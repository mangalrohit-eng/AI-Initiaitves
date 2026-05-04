import type { Quadrant } from "@/lib/cross-tower/aiProjects";

/** Same render order as ValueEffortMatrix (2×2 grid). */
export const DECK_QUADRANT_ORDER: Quadrant[] = [
  "Strategic Bet",
  "Quick Win",
  "Deprioritize",
  "Fill-in",
];

export const DECK_QUADRANT_META: Record<
  Quadrant,
  { hint: string; border: string; bg: string; titleClass: string }
> = {
  "Strategic Bet": {
    hint: "High value · High effort",
    border: "border-accent-purple/35",
    bg: "bg-accent-purple/[0.06]",
    titleClass: "text-accent-purple-dark",
  },
  "Quick Win": {
    hint: "High value · Low effort",
    border: "border-accent-green/35",
    bg: "bg-accent-green/[0.07]",
    titleClass: "text-accent-green",
  },
  "Deprioritize": {
    hint: "Low value · High effort",
    border: "border-accent-red/35",
    bg: "bg-accent-red/[0.06]",
    titleClass: "text-accent-red",
  },
  "Fill-in": {
    hint: "Low value · Low effort",
    border: "border-accent-teal/35",
    bg: "bg-accent-teal/[0.06]",
    titleClass: "text-accent-teal",
  },
};

export const DECK_APPROACH_STEPS: readonly {
  num: string;
  title: string;
  line: string;
}[] = [
  {
    num: "01",
    title: "Capability map",
    line: "Signed-off L1→L4 per Versant function — backbone for modeled dollars.",
  },
  {
    num: "02",
    title: "AI impact by L4",
    line: "Impact tier + rationale — TSA exit, BB- covenant, split rights, SEC controls.",
  },
  {
    num: "03",
    title: "L5 opportunities",
    line: "Feasibility-evidence tagged paths — case study, vendor, or adjacent use case.",
  },
  {
    num: "04",
    title: "L4 AI Projects",
    line: "One GPT-5.5 brief per L4 — Work, Workforce, Workbench, Digital Core.",
  },
  {
    num: "05",
    title: "Value × Effort",
    line: "Median-split portfolio — Quick Win, Strategic Bet, Fill-in, Deprioritize.",
  },
  {
    num: "06",
    title: "24-month sequence",
    line: "Build, ramp, scale from Assumptions — Quick Wins first; Deprioritized off the build.",
  },
];

export const DECK_SCORING_BULLETS: readonly string[] = [
  "Value score = modeled L4 prize; effort score = weighted brief signals (complexity, integrations, agents, platforms, proven-elsewhere).",
  "High / Low labels are median-split across the program so the matrix reads as portfolio context.",
  "GPT-5.5 authors rationales; engine owns cohort grouping and dollar rollups.",
  "P1 / P2 / P3 phase anchors set build start months; ramp months linear to full attributed run-rate.",
  "Deprioritize quadrant is visible but excluded from the active Gantt and value curve.",
];
