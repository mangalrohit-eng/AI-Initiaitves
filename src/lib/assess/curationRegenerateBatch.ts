/**
 * Step 4 "Regenerate AI guidance" — row selection + API batching.
 *
 * Scopes to the same L3 rows as `selectInitiativesForTower` (modeled AI pct > 0)
 * plus at least one L4 activity. Chunks requests to satisfy
 * `/api/assess/curate-initiatives` limits (row count + total L4 count).
 */

import type { AssessProgramV2, L3WorkforceRow, TowerId } from "@/data/assess/types";
import type { RunSummary } from "@/lib/assess/curationPipeline";
import { rowModeledSaving } from "@/lib/assess/scenarioModel";

/**
 * Must stay aligned with `MAX_L4S_PER_CALL` in `curateInitiativesLLM.ts` and
 * `/api/assess/curate-initiatives` — duplicated here so client code does not
 * import the LLM module (large vendor list + server helpers).
 */
export const MAX_L4S_PER_CURATION_CALL = 100;

/** Matches `MAX_ROWS` in `app/api/assess/curate-initiatives/route.ts`. */
export const MAX_ROWS_PER_CURATION_REQUEST = 100;

export type RegenerableRowsResult = {
  rowIds: string[];
  rows: L3WorkforceRow[];
};

/**
 * L3 rows that appear on AI Initiatives (modeled AI dial > 0) with at least
 * one L4 activity — same gate as `selectInitiativesForTower` / `rowModeledSaving`.
 */
export function regenerableRowsForStep4(
  program: AssessProgramV2,
  towerId: TowerId,
): RegenerableRowsResult {
  const t = program.towers[towerId];
  if (!t) return { rowIds: [], rows: [] };
  const baseline = t.baseline;
  const g = program.global;
  const rows: L3WorkforceRow[] = [];
  for (const row of t.l3Rows) {
    if ((row.l4Activities ?? []).length === 0) continue;
    const saving = rowModeledSaving(row, baseline, g);
    if (saving.aiPct <= 0) continue;
    rows.push(row);
  }
  return { rowIds: rows.map((r) => r.id), rows };
}

export type CurationChunkPlan = {
  batches: string[][];
  /** Row ids whose L4 count alone exceeds `MAX_L4S_PER_CURATION_CALL` — API cannot process. */
  oversizeRowIds: string[];
};

/**
 * Greedy pack: each batch respects both `MAX_ROWS_PER_CURATION_REQUEST` and
 * `MAX_L4S_PER_CURATION_CALL` (same limits as the curate-initiatives route).
 */
export function chunkRowsForCurationApi(rows: L3WorkforceRow[]): CurationChunkPlan {
  const oversizeRowIds: string[] = [];
  const batches: string[][] = [];
  let current: string[] = [];
  let currentL4 = 0;

  const l4Len = (r: L3WorkforceRow) => (r.l4Activities ?? []).length;

  for (const row of rows) {
    const n = l4Len(row);
    if (n > MAX_L4S_PER_CURATION_CALL) {
      oversizeRowIds.push(row.id);
      continue;
    }
    const wouldRows = current.length + 1;
    const wouldL4 = currentL4 + n;
    if (
      current.length > 0 &&
      (wouldRows > MAX_ROWS_PER_CURATION_REQUEST || wouldL4 > MAX_L4S_PER_CURATION_CALL)
    ) {
      batches.push(current);
      current = [];
      currentL4 = 0;
    }
    current.push(row.id);
    currentL4 += n;
  }
  if (current.length > 0) batches.push(current);

  return { batches, oversizeRowIds };
}

/** Merge sequential `runForRows` results for a single toast. */
export function aggregateRunSummaries(summaries: RunSummary[]): RunSummary {
  if (summaries.length === 0) {
    return {
      totalRows: 0,
      succeeded: 0,
      failed: 0,
      eligibleRows: 0,
      needReviewRows: 0,
    };
  }
  const warnings = summaries.map((s) => s.warning).filter(Boolean);
  const anyLlm = summaries.some((s) => s.source === "llm");
  const anyFb = summaries.some((s) => s.source === "fallback");
  let source: RunSummary["source"];
  if (anyLlm && anyFb) source = "llm";
  else if (anyLlm) source = "llm";
  else if (anyFb) source = "fallback";
  return {
    totalRows: summaries.reduce((a, s) => a + s.totalRows, 0),
    succeeded: summaries.reduce((a, s) => a + s.succeeded, 0),
    failed: summaries.reduce((a, s) => a + s.failed, 0),
    eligibleRows: summaries.reduce((a, s) => a + s.eligibleRows, 0),
    needReviewRows: summaries.reduce((a, s) => a + s.needReviewRows, 0),
    source,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}
