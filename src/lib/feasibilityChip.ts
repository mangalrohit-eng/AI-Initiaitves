/**
 * Visual tokens for the binary `Feasibility` signal.
 *
 * Per-tower (Step 4) views show feasibility but never priority — priority is
 * an emergent property of the cross-tower 2x2 in `selectInitiativesForProgram`.
 * The chip palette below is deliberately neutral (teal/slate) so it doesn't
 * compete with the program-level priority chips on the Cross-Tower AI Plan
 * page, which use the bolder TIER_STYLES navy/amber/teal palette.
 */

import type { Feasibility } from "@/data/types";

export type FeasibilityChipStyle = {
  /** Tailwind classes for the rounded badge. */
  badge: string;
  /** Tailwind classes for an inline 6px dot indicator. */
  dot: string;
  /** Short, executive-friendly label. */
  label: string;
  /** Tooltip-grade explanation surfaced on hover. */
  tooltip: string;
};

/**
 * High feasibility — leverages an existing platform / pattern (BlackLine,
 * Eightfold, Amagi, Workday, etc.) and ships in the first half-year. Maps
 * to the HF axis of the cross-tower 2x2.
 */
const HIGH: FeasibilityChipStyle = {
  badge: "border-accent-teal/40 bg-accent-teal/10 text-emerald-900",
  dot: "bg-accent-teal",
  label: "Ship-ready",
  tooltip:
    "High feasibility — leverages a proven Versant platform or pattern; suitable for a first-half-year ship. Final program priority is set by the cross-tower 2x2.",
};

/**
 * Low feasibility — needs new platform stand-up, multi-system integration, or
 * heavier change management. Maps to the LF axis of the 2x2 (P3 if the parent
 * L3 carries high impact, Deprioritized otherwise).
 */
const LOW: FeasibilityChipStyle = {
  badge: "border-slate-300 bg-slate-100 text-slate-700",
  dot: "bg-slate-500",
  label: "Investigate",
  tooltip:
    "Low feasibility — likely needs new platform, deeper integration, or heavier change management. Held for the cross-tower 2x2 to decide priority (Strategic Build vs. Deprioritized).",
};

const UNKNOWN: FeasibilityChipStyle = {
  badge: "border-forge-border bg-forge-well text-forge-subtle",
  dot: "bg-forge-border",
  label: "Pending",
  tooltip:
    "Feasibility not yet scored. Re-run capability curation on Step 1 to populate the cross-tower 2x2 input.",
};

export function feasibilityChip(
  feasibility: Feasibility | undefined,
): FeasibilityChipStyle {
  if (feasibility === "High") return HIGH;
  if (feasibility === "Low") return LOW;
  return UNKNOWN;
}
