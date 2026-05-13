/**
 * Per-tower 2x2 quadrant assignment for AI Solutions.
 *
 * Single source of truth for the (value, effort) bucket each solution
 * lands in inside a tower:
 *   - axis x = effort (curator-set feasibility — High → low effort)
 *   - axis y = value  (initiative **Attributed AI $**; median split inside the
 *     tower so the bucket assignment is in-tower-relative, not absolute)
 *
 * The four buckets mirror the program-level cross-tower 2x2 vocabulary
 * so the words "Quick Win" / "Strategic Bet" / "Fill-in" / "Deprioritize"
 * mean the same thing on Step 4 as they do on the Cross-Tower AI Plan.
 *
 * Used by `SolutionsGallery` for the Quadrant filter. Placeholder rows
 * are skipped — they don't carry a real feasibility yet.
 */
import type { Feasibility } from "@/data/types";

export type Quadrant =
  | "quick-win"
  | "strategic-bet"
  | "fill-in"
  | "deprioritize";

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  "quick-win": "Quick Win",
  "strategic-bet": "Strategic Bet",
  "fill-in": "Fill-in",
  deprioritize: "Deprioritize",
};

export const QUADRANT_HINTS: Record<Quadrant, string> = {
  "quick-win": "High value · low effort",
  "strategic-bet": "High value · high effort",
  "fill-in": "Lower value · low effort",
  deprioritize: "Lower value · high effort",
};

export type QuadrantInput = {
  /** Stable id used as the result map key. */
  id: string;
  /** Feasibility of the underlying solution. `undefined` falls to high effort. */
  feasibility?: Feasibility;
  /** Value axis — initiative Attributed AI $ (median split in-tower). */
  valueUsd: number;
  /** Skip placeholders — they have no feasibility signal yet. */
  isPlaceholder?: boolean;
};

/** Median across an array of numbers (returns 0 for empty). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Assign each row to a quadrant. Returns a Map keyed by the input `id`
 * so callers can look up `quadrants.get(init.id)` without re-walking
 * the array.
 *
 * Placeholders are excluded from both the median calculation (so a
 * tower with one real solution + N placeholders doesn't have its
 * median dragged toward zero) and the output map.
 */
export function assignQuadrants(
  rows: ReadonlyArray<QuadrantInput>,
): Map<string, Quadrant> {
  const real = rows.filter((r) => !r.isPlaceholder);
  const valueMedian = median(real.map((r) => r.valueUsd));
  const out = new Map<string, Quadrant>();
  for (const r of real) {
    const isHighValue = r.valueUsd >= valueMedian;
    const isLowEffort = r.feasibility === "High";
    const q: Quadrant = isHighValue
      ? isLowEffort
        ? "quick-win"
        : "strategic-bet"
      : isLowEffort
        ? "fill-in"
        : "deprioritize";
    out.set(r.id, q);
  }
  return out;
}

/** Convenience — count solutions per quadrant in one pass. */
export function countByQuadrant(
  rows: ReadonlyArray<QuadrantInput>,
): Record<Quadrant, number> {
  const counts: Record<Quadrant, number> = {
    "quick-win": 0,
    "strategic-bet": 0,
    "fill-in": 0,
    deprioritize: 0,
  };
  const map = assignQuadrants(rows);
  map.forEach((q: Quadrant) => {
    counts[q] += 1;
  });
  return counts;
}
