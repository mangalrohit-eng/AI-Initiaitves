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
  hasInFlightRows,
  rowCurrentHash,
} from "@/lib/initiatives/curationHash";
import { aiCurationOverlay } from "@/data/capabilityMap/aiCurationOverlay";
import {
  clientCurateInitiatives,
  clientGenerateL4Activities,
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

// ===========================================================================
//   Single-row regenerate (per-L3 "Refine + regenerate" affordance)
// ===========================================================================

export type RegenerateRowOptions = {
  towerId: TowerId;
  rowId: string;
  /** Optional qualitative feedback (≤600 chars). Forwarded to both stages. */
  feedback?: string;
  signal?: AbortSignal;
};

export type RegenerateRowSummary = {
  rowId: string;
  /** True iff Stage 1 (L4 generation) AND Stage 2 (curation) both succeeded. */
  ok: boolean;
  /** Provenance of the verdict path that won — "llm" or "fallback". */
  source?: "llm" | "fallback";
  /** Number of curated L4Items written back to this row. */
  l4Count: number;
  /** Of those, how many came back aiEligible. */
  eligibleL4Count: number;
  /** ≤25-word warning surfaced from either API (e.g. "OPENAI_API_KEY not set"). */
  warning?: string;
  /** Populated when ok === false. */
  error?: string;
};

/**
 * Re-generate the L4 activity list AND re-curate ONE L3 row, optionally with
 * qualitative user feedback to steer the result. The function operates on
 * EXACTLY ONE rowId — never an array — and patches only that row inside
 * `program.towers[towerId].l3Rows`. Other rows in the tower (and every other
 * tower) pass through `l3Rows.map(...)` by reference and are byte-identical
 * before vs after. The dial values, modeled $ pool, and `aiImpactAssessmentPct`
 * for the regenerated row are NEVER touched — only the L4 list and curation.
 *
 * No-nudge invariant. Every patch in this helper writes a `curationContentHash`
 * that matches the row's current `l4Activities` at write time, so the
 * `markRowsStaleByHash` pass inside `setTowerAssess` is a no-op for our row
 * and never auto-flips it to `curationStage: "queued"`. Other rows pass
 * through unchanged so `markRowsStaleByHash` is a no-op for them too. Net
 * result: `hasQueuedRows` does not flip false→true on account of this
 * regenerate, the StaleCurationBanner stays hidden, and the tower-wide
 * "Regenerate AI guidance for N capabilities" toolbar count is unchanged.
 *
 * Failure rollback. If any stage fails (network error, malformed LLM
 * response, server 5xx), the row is restored to its pre-regen snapshot
 * byte-identical (l4Activities, l4Items, curationContentHash, curationStage,
 * curationGeneratedAt, curationError) and then re-stamped with
 * `curationStage: "failed"` + the error message. No partial "Stage 1
 * succeeded, Stage 2 failed" states leak.
 *
 * Concurrency. The helper refuses (returns `{ ok: false, error: "in flight" }`)
 * when any row in the tower is already in flight (`running-l4` /
 * `running-curate`) — protects against a parallel tower-wide `runForRows`
 * call or a parallel single-row regenerate clobbering this row.
 */
export async function regenerateRowWithFeedback(
  opts: RegenerateRowOptions,
): Promise<RegenerateRowSummary> {
  const { towerId, rowId } = opts;
  const feedback = opts.feedback?.trim() || undefined;

  const initialProgram = getAssessProgram();
  const initialTower = initialProgram.towers[towerId];
  if (!initialTower) {
    return {
      rowId,
      ok: false,
      l4Count: 0,
      eligibleL4Count: 0,
      error: "Tower state missing.",
    };
  }
  const targetRow = initialTower.l3Rows.find((r) => r.id === rowId);
  if (!targetRow) {
    return {
      rowId,
      ok: false,
      l4Count: 0,
      eligibleL4Count: 0,
      error: "Row no longer exists.",
    };
  }
  if (hasInFlightRows(initialTower.l3Rows)) {
    return {
      rowId,
      ok: false,
      l4Count: 0,
      eligibleL4Count: 0,
      error: "Another regeneration is already in progress for this tower.",
    };
  }

  // Snapshot the row's current state — used for failure rollback so a
  // partial run never leaves the row in a half-updated state.
  const snapshot = {
    l4Activities: targetRow.l4Activities,
    l4Items: targetRow.l4Items,
    curationContentHash: targetRow.curationContentHash,
    curationStage: targetRow.curationStage,
    curationGeneratedAt: targetRow.curationGeneratedAt,
    curationError: targetRow.curationError,
  };

  // ----- Pre-flight: flip stage to "running-l4" so the UI shows a skeleton.
  // Hash and l4Activities untouched, so markRowsStaleByHash is a no-op.
  patchRow(towerId, rowId, {
    curationStage: "running-l4",
    curationError: undefined,
  });

  if (opts.signal?.aborted) {
    rollbackRow(towerId, rowId, snapshot, "Aborted before generate-l4 call.");
    return {
      rowId,
      ok: false,
      l4Count: 0,
      eligibleL4Count: 0,
      error: "Aborted.",
    };
  }

  // ----- Stage 1: regenerate the L4 activity list with feedback.
  const genRes = await clientGenerateL4Activities(towerId, [
    { l2: targetRow.l2, l3: targetRow.l3, ...(feedback ? { feedback } : {}) },
  ]);
  if (!genRes.ok) {
    const error = `Generate L4 failed (${genRes.status}): ${genRes.error}`;
    rollbackRow(towerId, rowId, snapshot, error);
    return { rowId, ok: false, l4Count: 0, eligibleL4Count: 0, error };
  }
  const generated = genRes.result.groups[0];
  const newL4Activities = (generated?.activities ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (newL4Activities.length === 0) {
    const error =
      "Generate L4 returned no activities. Try different feedback or set the AI dial to zero on Step 2.";
    rollbackRow(towerId, rowId, snapshot, error);
    return { rowId, ok: false, l4Count: 0, eligibleL4Count: 0, error };
  }

  // ----- Post-Stage-1 atomic write. Stamp a matching hash so
  // markRowsStaleByHash is a no-op and the row does NOT get auto-queued.
  const stage1Hash = computeCurationContentHash(
    targetRow.l2,
    targetRow.l3,
    newL4Activities,
  );
  patchRow(towerId, rowId, {
    l4Activities: newL4Activities,
    l4Items: [],
    curationContentHash: stage1Hash,
    curationStage: "running-curate",
    curationError: undefined,
  });

  if (opts.signal?.aborted) {
    rollbackRow(towerId, rowId, snapshot, "Aborted before curate call.");
    return {
      rowId,
      ok: false,
      l4Count: 0,
      eligibleL4Count: 0,
      error: "Aborted.",
    };
  }

  // ----- Stage 2: curate the new L4 list with the same feedback.
  const curRes = await clientCurateInitiatives(towerId, [
    {
      rowId,
      l2: targetRow.l2,
      l3: targetRow.l3,
      l4Activities: newL4Activities,
      ...(feedback ? { feedback } : {}),
    },
  ]);
  if (!curRes.ok) {
    const error = `Curate failed (${curRes.status}): ${curRes.error}`;
    rollbackRow(towerId, rowId, snapshot, error);
    return { rowId, ok: false, l4Count: 0, eligibleL4Count: 0, error };
  }
  const curated: CuratedRow | undefined = curRes.result.rows.find(
    (r) => r.rowId === rowId,
  );
  if (!curated) {
    const error = "Curate returned no result for this row.";
    rollbackRow(towerId, rowId, snapshot, error);
    return { rowId, ok: false, l4Count: 0, eligibleL4Count: 0, error };
  }

  const generatedAt = new Date().toISOString();
  const itemSource: L4Item["source"] =
    curRes.result.source === "llm" ? "llm" : "fallback";
  const l4Items: L4Item[] = curated.l4Items.map((item) => {
    const id = synthId(rowId, item.name);
    const overlay = aiCurationOverlay[id];
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
      initiativeId: overlay?.initiativeId,
      briefSlug: overlay?.briefSlug,
    };
  });
  const finalL4Names = l4Items.map((x) => x.name);
  const finalHash = computeCurationContentHash(
    targetRow.l2,
    targetRow.l3,
    finalL4Names,
  );

  // ----- Post-Stage-2 atomic write. Final state for the row.
  patchRow(towerId, rowId, {
    l4Items,
    l4Activities: finalL4Names,
    curationContentHash: finalHash,
    curationStage: "done",
    curationGeneratedAt: generatedAt,
    curationError: undefined,
  });

  const eligibleCount = l4Items.filter((x) => x.aiEligible).length;
  const summary: RegenerateRowSummary = {
    rowId,
    ok: true,
    source: curRes.result.source,
    l4Count: l4Items.length,
    eligibleL4Count: eligibleCount,
  };
  const warning =
    genRes.result.warning ?? curRes.result.warning ?? undefined;
  if (warning) summary.warning = warning;
  return summary;
}

/**
 * Patch ONE row inside a tower's `l3Rows` array. Re-reads the latest
 * program inside `setTowerAssess`'s `updateAssessProgram` boundary so a
 * parallel write on a different row cannot be clobbered. Other rows pass
 * through by reference; only the matching row is shallow-merged with `patch`.
 */
function patchRow(
  towerId: TowerId,
  rowId: string,
  patch: Partial<L3WorkforceRow>,
): void {
  const fresh = getAssessProgram().towers[towerId];
  if (!fresh) return;
  setTowerAssess(towerId, {
    l3Rows: fresh.l3Rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
  });
}

/**
 * Restore the row to its pre-regen snapshot, then stamp `curationStage: "failed"`
 * with the error string. Used by every failure path in `regenerateRowWithFeedback`
 * so a partial run never leaves the row in a half-updated state.
 */
function rollbackRow(
  towerId: TowerId,
  rowId: string,
  snapshot: {
    l4Activities: L3WorkforceRow["l4Activities"];
    l4Items: L3WorkforceRow["l4Items"];
    curationContentHash: L3WorkforceRow["curationContentHash"];
    curationStage: L3WorkforceRow["curationStage"];
    curationGeneratedAt: L3WorkforceRow["curationGeneratedAt"];
    curationError: L3WorkforceRow["curationError"];
  },
  error: string,
): void {
  patchRow(towerId, rowId, {
    l4Activities: snapshot.l4Activities,
    l4Items: snapshot.l4Items,
    curationContentHash: snapshot.curationContentHash,
    curationGeneratedAt: snapshot.curationGeneratedAt,
    curationStage: "failed",
    curationError: error,
  });
}
