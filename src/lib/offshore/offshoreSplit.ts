/**
 * Headcount split primitives for the binary GCC / Retained offshore model.
 *
 * Every L4 Activity Group carries a single `gccPct` (0-100) — the share of
 * its total HC that migrates to the primary India GCC. Onshore / retained
 * is the complement. There are no "lanes" any more; the four-lane vocab
 * (`GccEligible | GccWithOverlay | OnshoreRetained | EditorialCarveOut`)
 * and the `offshoreStrictCarveOut` reason set were collapsed into this
 * single number per row by the `migrateLanesToGccPct` migration.
 *
 * Two helpers, used everywhere the split is rendered or aggregated:
 *
 *   - `l4Split(row)`          — per-row split { totalHc, gccFte, retainedFte }.
 *   - `rollupSplit(rows)`     — HC-weighted aggregate over a set of L4 rows,
 *                               returning { totalHc, gccFte, retainedFte, gccPct }.
 *
 * Total HC convention matches `scenarioModel.computeRowOffshore`:
 *   totalHc = fteOnshore + fteOffshore + contractorOnshore + contractorOffshore.
 * Rounding: per-row `gccFte` uses `round`, retained is `max(0, totalHc - gccFte)`
 * so the two always sum to `totalHc` and no negative phantom row can sneak in.
 */
import type { L4WorkforceRow } from "@/data/assess/types";

/** Sum of all four HC buckets on an L4 row. Always >= 0. */
export function totalRowHc(row: {
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
}): number {
  return (
    (row.fteOnshore || 0) +
    (row.fteOffshore || 0) +
    (row.contractorOnshore || 0) +
    (row.contractorOffshore || 0)
  );
}

/**
 * Per-row headcount split. Pure function — no I/O. `gccPct` is clamped to
 * `[0, 100]` so a corrupt persisted value can never produce a negative
 * `retainedFte` or `gccFte > totalHc`.
 */
export function l4Split(row: {
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  gccPct: number;
}): { totalHc: number; gccFte: number; retainedFte: number } {
  const totalHc = totalRowHc(row);
  const pct = clampPct(row.gccPct);
  const gccFte = Math.round((totalHc * pct) / 100);
  const retainedFte = Math.max(0, totalHc - gccFte);
  return { totalHc, gccFte, retainedFte };
}

/**
 * HC-weighted aggregate split across a set of L4 rows. Returns the four
 * scalars Step 2's capability map needs at every tier (L1 banner, L2 group
 * header, L3 column header) and Step 3's read-only Offshore column.
 *
 * `gccPct` is `0` when `totalHc === 0` (empty tier — show "0 / 0" without
 * dividing by zero). Otherwise `gccPct = round(gccFte / totalHc * 100)`.
 *
 * Idempotent and order-independent: `rollupSplit([a, b]) ===
 * rollupSplit([b, a])`.
 */
export function rollupSplit(
  rows: ReadonlyArray<{
    fteOnshore: number;
    fteOffshore: number;
    contractorOnshore: number;
    contractorOffshore: number;
    gccPct: number;
  }>,
): {
  totalHc: number;
  gccFte: number;
  retainedFte: number;
  gccPct: number;
} {
  let totalHc = 0;
  let gccFte = 0;
  let retainedFte = 0;
  for (const r of rows) {
    const s = l4Split(r);
    totalHc += s.totalHc;
    gccFte += s.gccFte;
    retainedFte += s.retainedFte;
  }
  const gccPct =
    totalHc === 0 ? 0 : Math.round((gccFte / totalHc) * 100);
  return { totalHc, gccFte, retainedFte, gccPct };
}

/**
 * Clamp a (possibly corrupted / out-of-range) `gccPct` value into the
 * `[0, 100]` interval. Defensive — every store-write path validates already,
 * but `l4Split` is called from render code that has no chance to re-validate
 * persisted data, so the clamp lives here.
 */
export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

/**
 * Short, human-readable label for a row's binary disposition. Used on
 * Step 4 cards and applicability chips when a single-word read of the
 * row's primary destination is helpful:
 *
 *   - `gccPct >= 50` → "GCC India"
 *   - else            → "Retained"
 *
 * This is purely a display label — it never gates math. Roll-ups always
 * use the actual `gccPct` value, never this binary collapse.
 */
export function rowPrimaryLabel(row: { gccPct: number }): "GCC India" | "Retained" {
  return clampPct(row.gccPct) >= 50 ? "GCC India" : "Retained";
}

/**
 * Re-export the `L4WorkforceRow` shape constraint for callers that want a
 * stricter input contract. Equivalent to picking the four HC fields plus
 * `gccPct` — kept here so a future refactor can swap in a narrower row
 * type without touching call sites.
 */
export type SplitInputRow = Pick<
  L4WorkforceRow,
  "fteOnshore" | "fteOffshore" | "contractorOnshore" | "contractorOffshore" | "gccPct"
>;
