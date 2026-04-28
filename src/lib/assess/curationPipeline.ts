/**
 * Curation pipeline orchestrator.
 *
 * Stub mode (Phase 1 / this PR):
 *   - Stage 1 — L4 name generation: SKIPPED. Stub assumes `row.l4Activities`
 *     is already populated; if it isn't, the row is marked `failed` with a
 *     hint pointing the user to the existing "Generate L4 activities" button
 *     on Step 1.
 *   - Stage 2 — Verdict: runs `composeL4Verdict` on each L4 name (canonical
 *     fields → overlay → deterministic rubric).
 *   - Stage 3 — Curation: copies frequency / criticality / vendor / agent
 *     from the overlay where available; leaves the rest undefined.
 *
 * LLM mode (Phase 2 / PR 2):
 *   - Stages 2 + 3 will swap to `/api/assess/eligibility-verdict` and
 *     `/api/assess/curate-initiative` calls. The seven runaway-LLM safeguards
 *     listed in `docs/plans/capability-refresh.md §C.5` land alongside.
 *
 * Atomic write:
 *   On success the row is updated with `{l4Items, l4Activities (mirrored from
 *   l4Items.name), curationContentHash, curationStage: "done",
 *   curationGeneratedAt}` in one `setTowerAssess` call so the cache key and
 *   the cache contents cannot drift. Cache invalidation (selector Path 0)
 *   relies on this.
 */

import type {
  CurationStage,
  L3WorkforceRow,
  L4Item,
  TowerId,
} from "@/data/assess/types";
import { getAssessProgram, setTowerAssess } from "@/lib/localStore";
import {
  computeCurationContentHash,
  rowCurrentHash,
} from "@/lib/initiatives/curationHash";
import { composeL4Verdict } from "@/lib/initiatives/composeVerdict";
import { aiCurationOverlay } from "@/data/capabilityMap/aiCurationOverlay";

export type RunOptions = {
  towerId: TowerId;
  rowIds: string[];
  signal?: AbortSignal;
};

export type RunProgress = {
  rowId: string;
  stage: CurationStage;
  /** Populated when stage === "failed". */
  error?: string;
};

export type RunSummary = {
  totalRows: number;
  succeeded: number;
  failed: number;
  /** Rows that ended with at least one aiEligible L4 (post-refresh split). */
  eligibleRows: number;
  /** Rows that finished but have zero aiEligible L4s (still need manual review). */
  needReviewRows: number;
};

/**
 * Drive the stub pipeline serially across the queued rows. Caller is
 * responsible for filtering rowIds to the queue (typically every row with
 * `curationStage === "queued"` for the tower).
 *
 * Reads program state fresh on each row to tolerate concurrent edits during
 * a run — a parallel patchRow on a different L3 does not corrupt this run.
 */
export async function runForRows(
  opts: RunOptions,
  onProgress?: (p: RunProgress) => void,
): Promise<RunSummary> {
  const summary: RunSummary = {
    totalRows: opts.rowIds.length,
    succeeded: 0,
    failed: 0,
    eligibleRows: 0,
    needReviewRows: 0,
  };

  for (const rowId of opts.rowIds) {
    if (opts.signal?.aborted) break;

    const program = getAssessProgram();
    const towerState = program.towers[opts.towerId];
    if (!towerState) {
      onProgress?.({ rowId, stage: "failed", error: "Tower state missing." });
      summary.failed += 1;
      continue;
    }
    const row = towerState.l3Rows.find((r) => r.id === rowId);
    if (!row) {
      onProgress?.({ rowId, stage: "failed", error: "Row no longer exists." });
      summary.failed += 1;
      continue;
    }

    // Stage 1 stub — requires l4Activities to already exist. Fail fast with
    // a clear hint when it doesn't, so the user knows where to click next.
    const l4Names = row.l4Activities ?? [];
    if (l4Names.length === 0) {
      const error =
        "No L4 activities on this row yet. Use Generate L4 activities on Step 1 first.";
      writeFailure(opts.towerId, rowId, error);
      onProgress?.({ rowId, stage: "failed", error });
      summary.failed += 1;
      continue;
    }

    onProgress?.({ rowId, stage: "running-verdict" });
    if (opts.signal?.aborted) break;

    // Stage 2 stub — composer per L4 name.
    let l4Items: L4Item[];
    try {
      l4Items = buildL4ItemsViaComposer(opts.towerId, row);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      writeFailure(opts.towerId, rowId, error);
      onProgress?.({ rowId, stage: "failed", error });
      summary.failed += 1;
      continue;
    }

    // Stage 3 stub — overlay-only enrichment for eligible items.
    onProgress?.({ rowId, stage: "running-curate" });
    l4Items = enrichEligibleFromOverlay(l4Items);

    if (opts.signal?.aborted) break;

    // Atomic write — l4Items + mirrored l4Activities + hash + stage in one
    // setTowerAssess call. The mirrored l4Activities ensures the next
    // rowCurrentHash call agrees with curationContentHash exactly.
    const generatedAt = new Date().toISOString();
    const nextHash = computeCurationContentHash(
      row.l2,
      row.l3,
      l4Items.map((x) => x.name),
    );
    const fresh = getAssessProgram().towers[opts.towerId];
    if (!fresh) {
      summary.failed += 1;
      continue;
    }
    setTowerAssess(opts.towerId, {
      l3Rows: fresh.l3Rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              l4Items,
              l4Activities: l4Items.map((x) => x.name),
              curationContentHash: nextHash,
              curationStage: "done",
              curationGeneratedAt: generatedAt,
              curationError: undefined,
            }
          : r,
      ),
    });

    onProgress?.({ rowId, stage: "done" });
    summary.succeeded += 1;
    if (l4Items.some((i) => i.aiEligible)) summary.eligibleRows += 1;
    else summary.needReviewRows += 1;
  }

  return summary;
}

/**
 * Build the rich L4Item array for a row using the deterministic composer.
 * Mirrors what the selector does on render today, but persists the result
 * onto the row so the selector's Path 0 cache short-circuit takes over.
 */
function buildL4ItemsViaComposer(
  towerId: TowerId,
  row: L3WorkforceRow,
): L4Item[] {
  const l4Names = row.l4Activities ?? [];
  return l4Names.map((name) => {
    // Synthetic CapabilityL4 — composer only reads `name` and (optionally)
    // canonical-curation fields, neither of which we have for ad-hoc names.
    const verdict = composeL4Verdict({
      towerId,
      l2Name: row.l2,
      l3Name: row.l3,
      l4: { id: synthId(row, name), name },
    });
    return {
      id: synthId(row, name),
      name,
      source: "fallback",
      generatedAt: new Date().toISOString(),
      aiCurationStatus: verdict.status,
      aiEligible: verdict.aiEligible,
      aiPriority: verdict.aiPriority,
      aiRationale: verdict.aiRationale,
      notEligibleReason: verdict.notEligibleReason,
      frequency: verdict.frequency,
      criticality: verdict.criticality,
      currentMaturity: verdict.currentMaturity,
      primaryVendor: verdict.primaryVendor,
      agentOneLine: verdict.agentOneLine,
      initiativeId: verdict.initiativeId,
      briefSlug: verdict.briefSlug,
    };
  });
}

/**
 * Stub Stage 3: when an eligible item happens to share an id with a
 * hand-curated overlay entry, copy through the overlay's deep-curation
 * (frequency / criticality / vendor / agent / brief). Items without an
 * overlay match keep whatever the composer surfaced — usually nothing for
 * stage-3 fields, since the rubric doesn't synthesize vendors.
 */
function enrichEligibleFromOverlay(items: L4Item[]): L4Item[] {
  return items.map((item) => {
    if (!item.aiEligible) return item;
    const overlay = aiCurationOverlay[item.id];
    if (!overlay) return item;
    return {
      ...item,
      frequency: item.frequency ?? overlay.frequency,
      criticality: item.criticality ?? overlay.criticality,
      currentMaturity: item.currentMaturity ?? overlay.currentMaturity,
      primaryVendor: item.primaryVendor ?? overlay.primaryVendor,
      agentOneLine: item.agentOneLine ?? overlay.agentOneLine,
      briefSlug: item.briefSlug ?? overlay.briefSlug,
      initiativeId: item.initiativeId ?? overlay.initiativeId,
    };
  });
}

function synthId(row: L3WorkforceRow, l4Name: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${row.id}::${norm(l4Name)}`;
}

function writeFailure(towerId: TowerId, rowId: string, error: string) {
  const fresh = getAssessProgram().towers[towerId];
  if (!fresh) return;
  setTowerAssess(towerId, {
    l3Rows: fresh.l3Rows.map((r) =>
      r.id === rowId
        ? { ...r, curationStage: "failed", curationError: error }
        : r,
    ),
  });
}

/**
 * Convenience: collect the rowIds in a tower whose curationStage is "queued".
 * Used by the StaleCurationBanner CTA to fire `runForRows(towerId, queuedIds)`.
 */
export function queuedRowIdsForTower(
  towerId: TowerId,
): { rowIds: string[]; total: number } {
  const program = getAssessProgram();
  const t = program.towers[towerId];
  if (!t) return { rowIds: [], total: 0 };
  const ids = t.l3Rows
    .filter((r) => r.curationStage === "queued")
    .map((r) => r.id);
  return { rowIds: ids, total: t.l3Rows.length };
}

/**
 * The selector's cache check uses `rowCurrentHash`. Re-export here for
 * symmetry — pipeline writes the hash that selector compares.
 */
export { rowCurrentHash };
