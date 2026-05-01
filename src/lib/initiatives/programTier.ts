/**
 * Program-level priority tiering — the deterministic 2x2 over
 * `(feasibility, parent-L4 Activity Group business impact)`.
 *
 *                          ┌──────────────────┬──────────────────┐
 *                          │  HIGH FEASIBILITY│  LOW FEASIBILITY │
 *  ┌───────────────────────┼──────────────────┼──────────────────┤
 *  │  HIGH BUSINESS IMPACT │  P1 — Quick Wins │  P3 — Strategic  │
 *  │                       │       (HF / HBI) │     Builds       │
 *  │                       │                  │       (LF / HBI) │
 *  ├───────────────────────┼──────────────────┼──────────────────┤
 *  │   LOW BUSINESS IMPACT │  P2 — Fill-ins   │   Deprioritized  │
 *  │                       │       (HF / LBI) │   (Below the     │
 *  │                       │                  │      line)       │
 *  └───────────────────────┴──────────────────┴──────────────────┘
 *
 * Business impact is **the parent L4 Activity Group's full `aiUsd`**, NOT
 * the per-initiative `attributedAiUsd`. Reason: an L4 Activity Group with a
 * $20M opportunity that splits across five L5 Activity initiatives shouldn't
 * have any one of those L5s called "low impact" just because the even-split
 * per-L5 is small. The business impact is the prize at the L4 Activity Group
 * level; whichever L5 you ship moves the needle on the same $20M.
 *
 * The High / Low cutoff is the **median of `l3.aiUsd`** (field name retained
 * from V4; semantically the L4 Activity Group prize under V5) across all
 * unique active L4 Activity Groups in the program input, with a hard `$1M
 * absolute floor`. The floor exists so that on small or low-dollar programs
 * the median doesn't land at, say, $200K and accidentally promote a $300K
 * L4 Activity Group to "high impact."
 *
 * Edge cases:
 *
 *   - **N === 0 active L4 Activity Groups** — nothing to tier; return empty
 *     rows + a diagnostic. Callers render the empty-plan state.
 *   - **N === 1 active L4 Activity Group** — median is degenerate. The single
 *     row lands High iff its aiUsd >= $1M floor; otherwise Low. No volatility
 *     warning (the setup is structurally degenerate, not noisy).
 *   - **N === 2 or 3 active L4 Activity Groups** — median is mathematically
 *     defined but extremely sensitive to dial changes on Step 2. Compute as
 *     normal but stamp `medianVolatilityWarning: true` so the UI can surface
 *     a banner ("Tiering is sensitive at this program size — add more
 *     towers / Activity Groups for stable cuts").
 *   - **N >= 4** — standard median split; no warning.
 *
 * The function is pure; safe to call inside `selectInitiativesForProgram`.
 */

import type { ProgramTier } from "@/data/types";

/**
 * Minimum input shape the function needs from each initiative row. Keeping
 * it narrow lets `selectInitiativesForProgram` pass any subset that carries
 * the parent-L4-Activity-Group dollars + the L5 Activity feasibility,
 * without dragging the full `ProgramInitiativeRow` shape into this module.
 */
export type ProgramTierInput = {
  /** Stable id — used to key the output map. */
  id: string;
  /**
   * Parent L4 Activity Group row id — used to dedupe Activity Groups for the
   * median sample. Field name `l3RowId` retained from V4 for back-compat.
   */
  l3RowId: string;
  /**
   * Full L4 Activity Group modeled AI $; the business-impact axis input.
   * Field name `l3AiUsd` retained from V4 for back-compat.
   */
  l3AiUsd: number;
  /** Binary ship-readiness on this L5 Activity. Undefined → treated as Low. */
  feasibility?: "High" | "Low";
};

export type ProgramTierResult = {
  /** Stamped tier per input id, indexed by `id`. */
  tierById: Map<string, ProgramTier>;
  /** Human-readable reason per input id (used in tooltips). */
  reasonById: Map<string, string>;
  /**
   * Median `l3.aiUsd` (V4 field name; semantically the L4 Activity Group
   * prize under V5) across the active sample (post `$1M` floor).
   */
  medianL3Usd: number;
  /** $1M absolute floor — exposed for KPI strip rendering. */
  floorUsd: number;
  /** Effective threshold actually applied: `max(median, floor)`. */
  thresholdUsd: number;
  /** Number of unique active L4 Activity Groups contributing to the median sample. */
  activeL3Count: number;
  /**
   * True when the active L4 Activity Group count is small enough (N < 4)
   * that the median is sensitive to a single dial change on Step 2. UI
   * surfaces this as a "tiering is volatile at this program size" banner.
   */
  medianVolatilityWarning: boolean;
};

/** $1M absolute floor below which an L4 Activity Group is never called "high impact." */
export const BUSINESS_IMPACT_FLOOR_USD = 1_000_000;

/**
 * Compute `ProgramTier` for every initiative row in one pass.
 *
 * Steps:
 *   1. Dedupe L4 Activity Group rows by `l3RowId` (V4 field name retained
 *      for back-compat) and gather their `l3AiUsd`.
 *   2. Compute the median across that unique L4 Activity Group sample.
 *   3. Effective business-impact threshold = `max(median, $1M floor)`.
 *   4. For each input, classify (feasibility, l3.aiUsd >= threshold) into
 *      the 2x2.
 */
export function computeProgramTiers(
  inputs: readonly ProgramTierInput[],
): ProgramTierResult {
  const tierById = new Map<string, ProgramTier>();
  const reasonById = new Map<string, string>();

  // Edge case: empty input.
  if (inputs.length === 0) {
    return {
      tierById,
      reasonById,
      medianL3Usd: 0,
      floorUsd: BUSINESS_IMPACT_FLOOR_USD,
      thresholdUsd: BUSINESS_IMPACT_FLOOR_USD,
      activeL3Count: 0,
      medianVolatilityWarning: false,
    };
  }

  // Dedupe L4 Activity Group sample. An Activity Group with five L5
  // Activities contributes to the median ONCE, not five times — otherwise
  // the cut would slide toward whichever Activity Group has the most
  // surfaced L5 children.
  const l3UsdByRow = new Map<string, number>();
  for (const r of inputs) {
    if (!l3UsdByRow.has(r.l3RowId)) l3UsdByRow.set(r.l3RowId, r.l3AiUsd);
  }
  const sample = Array.from(l3UsdByRow.values()).sort((a, b) => a - b);
  const activeL3Count = sample.length;

  const medianL3Usd = computeMedian(sample);
  const thresholdUsd = Math.max(medianL3Usd, BUSINESS_IMPACT_FLOOR_USD);
  const medianVolatilityWarning = activeL3Count > 0 && activeL3Count < 4;

  for (const r of inputs) {
    const fHigh = r.feasibility === "High";
    const biHigh = r.l3AiUsd >= thresholdUsd;
    const tier: ProgramTier = fHigh
      ? biHigh
        ? "P1"
        : "P2"
      : biHigh
        ? "P3"
        : "Deprioritized";
    tierById.set(r.id, tier);
    reasonById.set(
      r.id,
      buildReason({
        tier,
        feasibility: r.feasibility ?? "Low",
        l3AiUsd: r.l3AiUsd,
        thresholdUsd,
        medianL3Usd,
        floorUsd: BUSINESS_IMPACT_FLOOR_USD,
        medianVolatilityWarning,
      }),
    );
  }

  return {
    tierById,
    reasonById,
    medianL3Usd,
    floorUsd: BUSINESS_IMPACT_FLOOR_USD,
    thresholdUsd,
    activeL3Count,
    medianVolatilityWarning,
  };
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/**
 * Standard sample median. For even N, average the two middle values.
 * For N === 1, the single value IS the median.
 */
function computeMedian(sorted: readonly number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildReason(args: {
  tier: ProgramTier;
  feasibility: "High" | "Low";
  l3AiUsd: number;
  thresholdUsd: number;
  medianL3Usd: number;
  floorUsd: number;
  medianVolatilityWarning: boolean;
}): string {
  const { tier, feasibility, l3AiUsd, thresholdUsd, medianL3Usd, floorUsd, medianVolatilityWarning } = args;
  const fStr = feasibility === "High" ? "high feasibility" : "low feasibility";
  const biStr =
    l3AiUsd >= thresholdUsd
      ? "high parent-L4 Activity Group impact"
      : "low parent-L4 Activity Group impact";
  const thresholdSource =
    medianL3Usd >= floorUsd
      ? `program median (${formatUsd(medianL3Usd)})`
      : `$1M absolute floor (median ${formatUsd(medianL3Usd)} fell below)`;
  const volatilityTag = medianVolatilityWarning
    ? " · median volatile at this program size"
    : "";
  const tierLabel: Record<ProgramTier, string> = {
    P1: "P1 — Quick Wins",
    P2: "P2 — Fill-ins",
    P3: "P3 — Strategic Builds",
    Deprioritized: "Deprioritized — Below the line",
  };
  return `${tierLabel[tier]} · ${fStr} × ${biStr} · L4 Activity Group impact ${formatUsd(l3AiUsd)} vs threshold ${formatUsd(thresholdUsd)} (${thresholdSource})${volatilityTag}.`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
