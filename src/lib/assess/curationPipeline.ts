/**
 * Curation pipeline orchestrator.
 *
 * LLM mode (current):
 *   - Stage 1 — L4 name generation: SKIPPED. The pipeline assumes
 *     `row.l4Activities` is already populated; if it isn't, the row is
 *     marked `failed` with a hint pointing the user back to Step 1's
 *     "Generate L4 activities" button.
 *   - Stages 2 + 3 — Verdict + curation: ONE batched LLM call per tower
 *     via `/api/assess/curate-initiatives`. The route falls back to the
 *     deterministic `composeL4Verdict` rubric on any LLM failure so the
 *     program never loses Step 4. Click-through fields (`initiativeId`
 *     / `briefSlug`) are stamped here from `aiCurationOverlay` after the
 *     call returns — they remain overlay-only so the LLM can't claim a
 *     hand-curated brief that doesn't exist.
 *
 * Lockstep progress UX:
 *   Because the LLM call is a single tower-wide request, we can't surface
 *   per-row stage transitions. Instead, every row in `opts.rowIds` flips
 *   to `running-curate` together, and they all flip to `done` together
 *   when the response lands. That's a more honest signal than fake
 *   per-row pacing.
 *
 * Atomic write:
 *   On success each row is updated with `{l4Items, l4Activities (mirrored
 *   from l4Items.name), curationContentHash, curationStage: "done",
 *   curationGeneratedAt}` in one `setTowerAssess` call so the cache key
 *   and the cache contents cannot drift. Cache invalidation (selector
 *   Path 0) relies on this.
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
import { aiCurationOverlay } from "@/data/capabilityMap/aiCurationOverlay";
import {
  clientCurateInitiatives,
  type CuratedRow,
} from "@/lib/assess/assessClientApi";

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
  /** Provenance of the verdict path that won — surfaced in the toast. */
  source?: "llm" | "fallback";
  /** Server-side warning text when LLM was unavailable / fell back. */
  warning?: string;
};

/**
 * Drive the LLM-backed pipeline across the queued rows for a tower in a
 * single batched call. The caller (typically `StaleCurationBanner` /
 * `OperatingModelSection`'s "Refresh AI guidance") supplies every row
 * whose `curationStage === "queued"` for this tower.
 *
 * All rows that lack `l4Activities` are marked `failed` BEFORE the LLM
 * call so we don't waste tokens on guaranteed-empty inputs. The remaining
 * rows transition to `running-curate` together, then `done` together when
 * the response lands.
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

  const program = getAssessProgram();
  const towerState = program.towers[opts.towerId];
  if (!towerState) {
    for (const rowId of opts.rowIds) {
      onProgress?.({
        rowId,
        stage: "failed",
        error: "Tower state missing.",
      });
    }
    summary.failed = opts.rowIds.length;
    return summary;
  }

  // Partition the queue: rows with at least one L4 activity go to the LLM,
  // rows without are short-circuited as failed with a clear next-step hint.
  const eligibleInputs: {
    rowId: string;
    row: L3WorkforceRow;
    l4Activities: string[];
  }[] = [];
  for (const rowId of opts.rowIds) {
    const row = towerState.l3Rows.find((r) => r.id === rowId);
    if (!row) {
      writeFailure(opts.towerId, rowId, "Row no longer exists.");
      onProgress?.({
        rowId,
        stage: "failed",
        error: "Row no longer exists.",
      });
      summary.failed += 1;
      continue;
    }
    const l4Names = row.l4Activities ?? [];
    if (l4Names.length === 0) {
      const error =
        "No L4 activities on this row yet. Use Generate L4 activities on Step 1 first.";
      writeFailure(opts.towerId, rowId, error);
      onProgress?.({ rowId, stage: "failed", error });
      summary.failed += 1;
      continue;
    }
    eligibleInputs.push({ rowId, row, l4Activities: l4Names });
  }

  if (eligibleInputs.length === 0) {
    return summary;
  }

  if (opts.signal?.aborted) return summary;

  // Lockstep: every queued row flips to `running-curate` before the call.
  for (const r of eligibleInputs) {
    onProgress?.({ rowId: r.rowId, stage: "running-curate" });
  }

  // Single batched call. The server route owns the LLM-vs-fallback decision
  // and validates vendor names + canonical not-eligible reasons before
  // returning.
  const apiRes = await clientCurateInitiatives(
    opts.towerId,
    eligibleInputs.map((e) => ({
      rowId: e.rowId,
      l2: e.row.l2,
      l3: e.row.l3,
      l4Activities: e.l4Activities,
    })),
  );

  if (!apiRes.ok) {
    const error = `Curation API failed (${apiRes.status}): ${apiRes.error}`;
    for (const e of eligibleInputs) {
      writeFailure(opts.towerId, e.rowId, error);
      onProgress?.({ rowId: e.rowId, stage: "failed", error });
      summary.failed += 1;
    }
    return summary;
  }

  if (opts.signal?.aborted) return summary;

  summary.source = apiRes.result.source;
  summary.warning = apiRes.result.warning;

  // Build a fast lookup so we apply server results back to rows in O(1).
  const resultByRow = new Map<string, CuratedRow>();
  for (const r of apiRes.result.rows) resultByRow.set(r.rowId, r);

  // Atomic write per tower: re-read the latest program (a parallel patch on
  // a different L3 may have landed during the LLM call) and rewrite every
  // touched row in one `setTowerAssess`.
  const fresh = getAssessProgram().towers[opts.towerId];
  if (!fresh) {
    for (const e of eligibleInputs) {
      writeFailure(
        opts.towerId,
        e.rowId,
        "Tower state lost while curation was running.",
      );
      onProgress?.({
        rowId: e.rowId,
        stage: "failed",
        error: "Tower state lost while curation was running.",
      });
      summary.failed += 1;
    }
    return summary;
  }

  const generatedAt = new Date().toISOString();
  const itemSource: L4Item["source"] =
    apiRes.result.source === "llm" ? "llm" : "fallback";

  const succeededRowIds = new Set<string>();
  const writeBackRows = fresh.l3Rows.map((r) => {
    const e = eligibleInputs.find((x) => x.rowId === r.id);
    if (!e) return r;
    const curated = resultByRow.get(r.id);
    if (!curated) {
      // Server omitted this row — should not happen given the length checks
      // server-side, but treat it as a failure to preserve invariants.
      return {
        ...r,
        curationStage: "failed" as CurationStage,
        curationError: "Server returned no results for this row.",
      };
    }

    const l4Items: L4Item[] = curated.l4Items.map((item) => {
      const id = synthId(r.id, item.name);
      const overlay = aiCurationOverlay[id];
      // Click-through fields stay overlay-only — the LLM is not allowed
      // to invent brief slugs or initiative ids.
      const briefSlug = overlay?.briefSlug;
      const initiativeId = overlay?.initiativeId;
      return {
        id,
        name: item.name,
        source: itemSource,
        generatedAt,
        aiCurationStatus: item.aiCurationStatus,
        aiEligible: item.aiEligible,
        aiPriority: item.aiPriority,
        aiRationale: item.aiRationale,
        notEligibleReason: item.notEligibleReason,
        frequency: item.frequency,
        criticality: item.criticality,
        currentMaturity: item.currentMaturity,
        primaryVendor: item.primaryVendor,
        agentOneLine: item.agentOneLine,
        initiativeId,
        briefSlug,
      };
    });

    const nextHash = computeCurationContentHash(
      r.l2,
      r.l3,
      l4Items.map((x) => x.name),
    );
    succeededRowIds.add(r.id);
    if (l4Items.some((i) => i.aiEligible)) summary.eligibleRows += 1;
    else summary.needReviewRows += 1;
    return {
      ...r,
      l4Items,
      l4Activities: l4Items.map((x) => x.name),
      curationContentHash: nextHash,
      curationStage: "done" as CurationStage,
      curationGeneratedAt: generatedAt,
      curationError: undefined,
    };
  });

  setTowerAssess(opts.towerId, { l3Rows: writeBackRows });

  for (const e of eligibleInputs) {
    if (succeededRowIds.has(e.rowId)) {
      onProgress?.({ rowId: e.rowId, stage: "done" });
      summary.succeeded += 1;
    } else {
      onProgress?.({
        rowId: e.rowId,
        stage: "failed",
        error: "Server returned no results for this row.",
      });
      summary.failed += 1;
    }
  }

  return summary;
}

function synthId(rowId: string, l4Name: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${rowId}::${norm(l4Name)}`;
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
