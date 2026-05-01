/**
 * Capability-map content hash + staleness machinery.
 *
 * The hybrid refresh strategy (Step 4 AI Initiatives) treats an L4 Activity
 * Group row as "stale" when its name footprint (L2 + L3 + L4 + sorted L5
 * Activity names) has changed since the last successful pipeline run. Dial
 * values, headcount, and annualSpendUsd are intentionally excluded from the
 * hash — those don't change which L5 Activities exist, only their dollar
 * impact, so dial sweeps during a workshop never light up the refresh
 * banner.
 *
 * Three pure helpers, all idempotent:
 *
 *   1. computeCurationContentHash(l2, l3, l4Names) — the one-line key.
 *      (Argument names retained for back-compat; under V5 callers pass the
 *      L4 Activity Group label as `l3` and the L5 Activity names as
 *      `l4Names`. The hash itself is opaque.)
 *   2. markRowsStaleByHash(rows)      — write path: mark queued when names
 *                                       changed (called from the upload /
 *                                       L5-regen helpers in `useTowerAssessOps`).
 *   3. bootstrapHashOnRead(rows)      — read path: stamp seed / legacy rows
 *                                       to `idle` with a current hash so the
 *                                       banner never blasts on first load.
 *
 * The selector's cache short-circuit (`select.ts` Path 0) re-derives the
 * current hash on render and compares with `row.curationContentHash` to
 * decide whether `row.l5Items` is still valid.
 */

import type { L3WorkforceRow, TowerAssessState } from "@/data/assess/types";

/**
 * djb2 — a small, dependency-free, deterministic 32-bit hash. Cryptographic
 * strength is not required; the only goal is "two name-equivalent rows
 * produce the same key, two different rows produce different keys."
 */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Stable content hash for a single L3 row's name footprint. Shape:
 *   "<l2-norm>::<l3-norm>::<sorted, normalized L4 names joined by '|'>"
 * djb2-encoded as base-36.
 *
 * Pure function. Same inputs always yield the same output across the entire
 * codebase — selector, write-path, and bootstrap migration must agree.
 */
export function computeCurationContentHash(
  l2Name: string,
  l3Name: string,
  l4Names: ReadonlyArray<string>,
): string {
  const sortedL4 = (l4Names ?? [])
    .map(norm)
    .filter((s) => s.length > 0)
    .sort()
    .join("|");
  const payload = `${norm(l2Name)}::${norm(l3Name)}::${sortedL4}`;
  return djb2(payload).toString(36);
}

/**
 * Compute the current content hash for a row from its own fields. Re-used by
 * the selector cache check and by the pipeline orchestrator.
 */
export function rowCurrentHash(row: L3WorkforceRow): string {
  return computeCurationContentHash(row.l2, row.l3, row.l5Activities ?? []);
}

/**
 * Write-path helper: walk the rows and mark any whose current hash differs
 * from the stored `curationContentHash` as `curationStage: "queued"`.
 * Rows without a stored hash are intentionally left alone — those should
 * have already passed through `bootstrapHashOnRead` first.
 *
 * The hash itself is NOT stamped here. Stamping happens only after a
 * successful pipeline run (in `curationPipeline.ts`), so a failed run
 * preserves the old hash and the banner stays visible.
 */
export function markRowsStaleByHash(rows: L3WorkforceRow[]): L3WorkforceRow[] {
  return rows.map((r) => {
    if (r.curationContentHash == null) return r;
    const next = rowCurrentHash(r);
    if (r.curationContentHash === next) return r;
    if (r.curationStage === "queued") return r; // already queued — no-op
    return { ...r, curationStage: "queued" };
  });
}

/**
 * Read-path helper: rows that have NEVER been seen by the pipeline (no
 * `curationContentHash`) get one stamped on first read with stage `idle`.
 *
 * This protects the seeded program (and any localStorage payload predating
 * this migration) from blasting the StaleCurationBanner on first load.
 * The selector still uses the deterministic composer for these rows on
 * render — the bootstrap is purely about the staleness predicate.
 *
 * Idempotent: calling on already-stamped rows is a no-op.
 */
export function bootstrapHashOnRead(rows: L3WorkforceRow[]): L3WorkforceRow[] {
  let touched = false;
  const next = rows.map((r) => {
    if (r.curationContentHash != null) return r;
    touched = true;
    return {
      ...r,
      curationContentHash: rowCurrentHash(r),
      curationStage: r.curationStage ?? ("idle" as const),
    };
  });
  return touched ? next : rows;
}

/**
 * Predicate for the StaleCurationBanner. Returns true when at least one row
 * has stage `queued`. Pipeline-running rows (`running-*`) are intentionally
 * NOT shown as stale — they're being worked on right now.
 */
export function hasQueuedRows(rows: ReadonlyArray<L3WorkforceRow>): boolean {
  return rows.some((r) => r.curationStage === "queued");
}

/**
 * Predicate for "is a pipeline currently in flight on this tower?" Used by
 * the banner CTA disabled-state and the per-tower in-flight lock.
 */
export function hasInFlightRows(rows: ReadonlyArray<L3WorkforceRow>): boolean {
  return rows.some(
    (r) =>
      r.curationStage === "running-l5" ||
      r.curationStage === "running-verdict" ||
      r.curationStage === "running-curate",
  );
}

/**
 * Selector cache validity: row.l5Items is the source of truth for L4 view-
 * models when (a) the row has a populated cache, and (b) the stored hash
 * matches the row's current name footprint.
 */
export function isCacheValidForRow(row: L3WorkforceRow): boolean {
  if (!row.l5Items || row.l5Items.length === 0) return false;
  if (row.curationContentHash == null) return false;
  return row.curationContentHash === rowCurrentHash(row);
}

/**
 * Upload-path helper: stamp every freshly-uploaded row with the current
 * content hash AND queue it. Used by `importOp` (CSV upload) where the
 * incoming rows have no `curationContentHash` and `markRowsStaleByHash`
 * would no-op them. Idempotent — rows already queued or in-flight stay
 * unchanged.
 *
 * Rows ride out of this function with `curationStage: "queued"` and a
 * fresh hash so the staleness predicate fires immediately on every
 * downstream step. Sample-loaded rows do NOT pass through this helper —
 * they keep their pre-populated `l4Activities` / dials and bootstrap
 * silently to `idle`.
 */
export function markRowsQueuedOnUpload(
  rows: L3WorkforceRow[],
): L3WorkforceRow[] {
  return rows.map((r) => {
    if (
      r.curationStage === "running-l5" ||
      r.curationStage === "running-verdict" ||
      r.curationStage === "running-curate"
    ) {
      // Don't disturb in-flight rows — extremely unlikely on upload but safe.
      return r;
    }
    return {
      ...r,
      curationContentHash: rowCurrentHash(r),
      curationStage: "queued",
    };
  });
}

/**
 * Tower-level stale derivation. Single source of truth for the three
 * banner predicates so Steps 1, 2, and 4 don't fork the logic.
 *
 *   - `l4Stale`               — at least one row is missing L5 Activities;
 *                               drives the Step 1 StaleL4Banner. (Field name
 *                               retained from V4 for back-compat.)
 *   - `dialsStale`            — every row has both dial overrides null AND
 *                               `dialsRationaleSource == null` (the post-
 *                               upload signature). Sample-loaded rows have
 *                               `dialsRationaleSource: "starter"` so they
 *                               are NOT flagged as stale. Drives the Step 2
 *                               StaleDialsBanner.
 *   - `initiativesStale`      — at least one row has `curationStage:
 *                               "queued"` (existing `hasQueuedRows`
 *                               predicate). Drives the Step 4
 *                               StaleCurationBanner.
 *   - `missingL4ForRefresh`   — at least one queued row has no L4
 *                               activities. The Step 4 banner uses this
 *                               to redirect users back to Step 1 instead
 *                               of firing a refresh that's guaranteed to
 *                               fail in `curationPipeline.ts`.
 */
export type TowerStaleState = {
  l4Stale: boolean;
  dialsStale: boolean;
  initiativesStale: boolean;
  missingL4ForRefresh: boolean;
};

export function getTowerStaleState(
  towerState: Pick<TowerAssessState, "l4Rows"> | undefined,
): TowerStaleState {
  const rows = towerState?.l4Rows ?? [];
  if (rows.length === 0) {
    return {
      l4Stale: false,
      dialsStale: false,
      initiativesStale: false,
      missingL4ForRefresh: false,
    };
  }
  const l4Stale = rows.some(
    (r) => !r.l5Activities || r.l5Activities.length === 0,
  );
  const dialsStale = rows.every(
    (r) =>
      r.offshoreAssessmentPct == null &&
      r.aiImpactAssessmentPct == null &&
      r.dialsRationaleSource == null,
  );
  const initiativesStale = hasQueuedRows(rows);
  const missingL4ForRefresh = rows.some(
    (r) =>
      r.curationStage === "queued" &&
      (!r.l5Activities || r.l5Activities.length === 0),
  );
  return { l4Stale, dialsStale, initiativesStale, missingL4ForRefresh };
}
