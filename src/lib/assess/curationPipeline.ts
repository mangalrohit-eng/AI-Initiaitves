/**
 * Curation pipeline orchestrator.
 *
 * LLM mode (post-PR2 streaming):
 *   - Stage 1 — L5 Activity name generation: SKIPPED. The pipeline assumes
 *     `row.l5Activities` is already populated; if it isn't, the row is
 *     marked `failed` with a hint pointing the user back to Step 1's
 *     "Generate L5 Activities" button.
 *   - Stages 2 + 3 — Verdict + curation: PER-L4 fan-out via the streaming
 *     variant of `/api/assess/curate-initiatives`. The route makes one
 *     LLM call per L4 Activity Group (bounded concurrency 6) and emits
 *     each row's verdict + curation summary as a streaming NDJSON event
 *     the moment it lands. The route falls back to the deterministic
 *     `composeL4Verdict` rubric per-row on LLM failure — a single row's
 *     LLM error no longer collapses the whole tower. Click-through
 *     fields (`initiativeId` / `briefSlug`) are stamped here from
 *     `aiCurationOverlay` after each event is parsed — they remain
 *     overlay-only so the LLM can't claim a hand-curated brief that
 *     doesn't exist.
 *
 * Progressive UX:
 *   Each row flips to `running-curate` before the stream starts, then
 *   transitions to `done` independently as its `row` event lands. The
 *   user sees rows fill in across the tower view rather than waiting
 *   for the full batch.
 *
 * Per-row atomic write:
 *   When a `row` event arrives we re-read the latest program, patch the
 *   single row with `{l5Items, l5Activities (mirrored from l5Items.name),
 *   curationContentHash, curationStage: "done", curationGeneratedAt}` in
 *   one `setTowerAssess` call so the cache key and the cache contents
 *   cannot drift. Cache invalidation (selector Path 0) relies on this.
 */

import type {
  CurationStage,
  L4WorkforceRow,
  L4Item,
  TowerId,
} from "@/data/assess/types";
import { getAssessProgram, setTowerAssess } from "@/lib/localStore";
import { buildTowerReadinessDigest } from "@/lib/assess/towerReadinessIntake";
import {
  computeCurationContentHash,
  hasInFlightRows,
  rowCurrentHash,
} from "@/lib/initiatives/curationHash";
import { aiCurationOverlay } from "@/data/capabilityMap/aiCurationOverlay";
import { resolveRowDescriptions } from "@/data/capabilityMap/descriptions";
import {
  clientCurateInitiatives,
  clientGenerateL4Activities,
  streamCurateInitiatives,
  type CuratedRow,
  type CurateInitiativesSource,
  type CuratedL4,
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
  /**
   * Provenance of the verdict path that won — surfaced in the toast.
   * Post-PR2 this can be `"mixed"` when SOME rows used the LLM and
   * others fell back to the deterministic composer (per-row failure).
   */
  source?: CurateInitiativesSource;
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

  // Partition the queue: rows with at least one L5 Activity go to the LLM,
  // rows without are short-circuited as failed with a clear next-step hint.
  const eligibleInputs: {
    rowId: string;
    row: L4WorkforceRow;
    l5Activities: string[];
  }[] = [];
  for (const rowId of opts.rowIds) {
    const row = towerState.l4Rows.find((r) => r.id === rowId);
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
    const l4Names = row.l5Activities ?? [];
    if (l4Names.length === 0) {
      const error =
        "No L5 Activities on this row yet. Use Generate L5 Activities on Step 1 first.";
      writeFailure(opts.towerId, rowId, error);
      onProgress?.({ rowId, stage: "failed", error });
      summary.failed += 1;
      continue;
    }
    eligibleInputs.push({ rowId, row, l5Activities: l4Names });
  }

  if (eligibleInputs.length === 0) {
    return summary;
  }

  if (opts.signal?.aborted) return summary;

  // Every queued row flips to `running-curate` before the stream opens.
  // The user sees a "scoring…" state on each row until that row's NDJSON
  // event lands; rows then transition to `done` independently.
  for (const r of eligibleInputs) {
    onProgress?.({ rowId: r.rowId, stage: "running-curate" });
  }

  // Per-L4 streaming fan-out. The route makes one LLM call per row
  // (bounded concurrency 6) and falls back to the deterministic
  // composer per-row on LLM failure. We patch each row into the local
  // store as its event arrives so the UI hydrates progressively.
  const towerIntakeDigest = buildTowerReadinessDigest(
    getAssessProgram().towers[opts.towerId]?.aiReadinessIntake,
  );

  const succeededRowIds = new Set<string>();

  /**
   * Stamp a single row into the local store. Re-reads the latest
   * program inside `setTowerAssess` (a parallel patch on a different
   * L3 may have landed mid-stream) and rewrites only the matching row.
   */
  const stampRow = (
    rowId: string,
    items: CuratedL4[],
    rowSource: "llm" | "fallback",
  ): void => {
    const fresh = getAssessProgram().towers[opts.towerId];
    if (!fresh) return;
    const generatedAt = new Date().toISOString();
    const itemSource: L4Item["source"] = rowSource === "llm" ? "llm" : "fallback";
    setTowerAssess(opts.towerId, {
      l4Rows: fresh.l4Rows.map((r) => {
        if (r.id !== rowId) return r;
        const l5Items: L4Item[] = items.map((item) => {
          const id = synthId(r.id, item.name);
          const overlay = aiCurationOverlay[id];
          // Click-through fields stay overlay-only — the LLM is not
          // allowed to invent brief slugs or initiative ids.
          const briefSlug = overlay?.briefSlug;
          const initiativeId = overlay?.initiativeId;
          // initiativeName precedence: hand-authored overlay wins, then
          // the LLM- or fallback-emitted title from the route. Stays
          // undefined when the L5 isn't AI-eligible so the UI knows to
          // render the not-eligible state without a misleading headline.
          const initiativeName = item.aiEligible
            ? overlay?.initiativeName ?? item.initiativeName
            : undefined;
          return {
            id,
            name: item.name,
            initiativeName,
            source: itemSource,
            generatedAt,
            aiCurationStatus: item.aiCurationStatus,
            aiEligible: item.aiEligible,
            // The LLM now scores binary feasibility directly; aiPriority is
            // intentionally omitted on new writes so the program-tier 2x2
            // owns priority. Old cached items that still carry aiPriority
            // are honored by the back-compat map in `composeVerdict`.
            feasibility: item.feasibility,
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
        // PR3: include narrative context so the hash matches the
        // staleness check on the read path. Same towerId for the whole
        // streaming batch — captured from the surrounding `runForRows`
        // closure.
        const nextHash = computeCurationContentHash(
          r.l2,
          r.l3,
          l5Items.map((x) => x.name),
          resolveRowDescriptions(opts.towerId, r.l2, r.l3, r.l4),
        );
        return {
          ...r,
          l5Items,
          l5Activities: l5Items.map((x) => x.name),
          curationContentHash: nextHash,
          curationStage: "done" as CurationStage,
          curationGeneratedAt: generatedAt,
          curationError: undefined,
        };
      }),
    });
    succeededRowIds.add(rowId);
    if (items.some((i) => i.aiEligible)) summary.eligibleRows += 1;
    else summary.needReviewRows += 1;
  };

  const apiRes = await streamCurateInitiatives(
    opts.towerId,
    eligibleInputs.map((e) => ({
      rowId: e.rowId,
      l2: e.row.l2,
      l3: e.row.l3,
      // V5 L4 Activity Group — required for the LLM and the deterministic
      // rubric to score L5 leaves with full parent context. Omitting this
      // collapses two hierarchy layers and produces all-not-eligible
      // verdicts.
      l4: e.row.l4,
      l5Activities: e.l5Activities,
    })),
    {
      ...(towerIntakeDigest ? { towerIntakeDigest } : {}),
      signal: opts.signal,
      // Per-row event handler — the heart of the progressive UX. Stamps
      // the row into the local store and emits a `done` progress event
      // the moment the server has scored it.
      onRow: (ev) => {
        if (opts.signal?.aborted) return;
        stampRow(ev.rowId, ev.l5Items, ev.source);
        onProgress?.({ rowId: ev.rowId, stage: "done" });
      },
    },
  );

  if (!apiRes.ok) {
    const error = `Curation API failed (${apiRes.status}): ${apiRes.error}`;
    for (const e of eligibleInputs) {
      // Skip rows we already stamped (`onRow` may have run before the
      // failure landed) — they're already `done`, no need to overwrite.
      if (succeededRowIds.has(e.rowId)) continue;
      writeFailure(opts.towerId, e.rowId, error);
      onProgress?.({ rowId: e.rowId, stage: "failed", error });
      summary.failed += 1;
    }
    return summary;
  }

  summary.source = apiRes.result.source;
  summary.warning = apiRes.result.warning;

  // Belt-and-suspenders: the stream's `done` event arrives after every
  // `row`. Walk eligible inputs and surface any row the stream omitted
  // (should not happen given the length checks server-side) as a
  // failure to preserve the contract that every row gets a final state.
  for (const e of eligibleInputs) {
    if (succeededRowIds.has(e.rowId)) {
      summary.succeeded += 1;
      continue;
    }
    const error = "Curation stream omitted this row.";
    writeFailure(opts.towerId, e.rowId, error);
    onProgress?.({ rowId: e.rowId, stage: "failed", error });
    summary.failed += 1;
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
    l4Rows: fresh.l4Rows.map((r) =>
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
  const ids = t.l4Rows
    .filter((r) => r.curationStage === "queued")
    .map((r) => r.id);
  return { rowIds: ids, total: t.l4Rows.length };
}

/**
 * The selector's cache check uses `rowCurrentHash`. Re-export here for
 * symmetry — pipeline writes the hash that selector compares.
 */
export { rowCurrentHash };

// ===========================================================================
//   Single-row regenerate (per-L4-Activity-Group "Refine + regenerate" affordance)
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
  /**
   * Provenance of the verdict path that won. `"mixed"` is technically
   * possible per the wire shape but cannot occur on the per-row regenerate
   * path (single-row request → single-row outcome). It's still typed
   * here to keep the field aligned with `RunSummary.source`.
   */
  source?: CurateInitiativesSource;
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
 * Re-generate the L5 Activity list AND re-curate ONE L4 Activity Group row,
 * optionally with qualitative user feedback to steer the result. The
 * function operates on EXACTLY ONE rowId — never an array — and patches only
 * that row inside `program.towers[towerId].l4Rows`. Other rows in the tower
 * (and every other tower) pass through `l4Rows.map(...)` by reference and
 * are byte-identical before vs after. The dial values, modeled $ pool, and
 * `aiImpactAssessmentPct` for the regenerated row are NEVER touched — only
 * the L5 Activity list and curation.
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
  const targetRow = initialTower.l4Rows.find((r) => r.id === rowId);
  if (!targetRow) {
    return {
      rowId,
      ok: false,
      l4Count: 0,
      eligibleL4Count: 0,
      error: "Row no longer exists.",
    };
  }
  if (hasInFlightRows(initialTower.l4Rows)) {
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
    l5Activities: targetRow.l5Activities,
    l5Items: targetRow.l5Items,
    curationContentHash: targetRow.curationContentHash,
    curationStage: targetRow.curationStage,
    curationGeneratedAt: targetRow.curationGeneratedAt,
    curationError: targetRow.curationError,
  };

  // ----- Pre-flight: flip stage to "running-l5" so the UI shows a skeleton.
  // Hash and l4Activities untouched, so markRowsStaleByHash is a no-op.
  patchRow(towerId, rowId, {
    curationStage: "running-l5",
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

  // ----- Stage 1: regenerate the L5 Activity list with feedback.
  // Pass the L4 Activity Group name so the LLM generates L5 leaves that
  // belong to THIS Activity Group, not generic activities under the
  // Job Family. Without `l4` the generator falls back to legacy v4 mode
  // and emits much weaker activity names.
  const genRes = await clientGenerateL4Activities(towerId, [
    {
      l2: targetRow.l2,
      l3: targetRow.l3,
      l4: targetRow.l4,
      ...(feedback ? { feedback } : {}),
    },
  ]);
  if (!genRes.ok) {
    const error = `Generate L5 Activities failed (${genRes.status}): ${genRes.error}`;
    rollbackRow(towerId, rowId, snapshot, error);
    return { rowId, ok: false, l4Count: 0, eligibleL4Count: 0, error };
  }
  const generated = genRes.result.groups[0];
  const newL4Activities = (generated?.activities ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (newL4Activities.length === 0) {
    const error =
      "Generate L5 Activities returned no activities. Try different feedback or set the AI dial to zero on Step 2.";
    rollbackRow(towerId, rowId, snapshot, error);
    return { rowId, ok: false, l4Count: 0, eligibleL4Count: 0, error };
  }

  // ----- Post-Stage-1 atomic write. Stamp a matching hash so
  // markRowsStaleByHash is a no-op and the row does NOT get auto-queued.
  // PR3: include the per-row narrative context so the hash matches what
  // `bootstrapHashOnRead` and `markRowsStaleByHash` would compute.
  const stage1Descs = resolveRowDescriptions(
    towerId,
    targetRow.l2,
    targetRow.l3,
    targetRow.l4,
  );
  const stage1Hash = computeCurationContentHash(
    targetRow.l2,
    targetRow.l3,
    newL4Activities,
    stage1Descs,
  );
  patchRow(towerId, rowId, {
    l5Activities: newL4Activities,
    l5Items: [],
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
  const digest = buildTowerReadinessDigest(
    getAssessProgram().towers[towerId]?.aiReadinessIntake,
  );
  const curRes = await clientCurateInitiatives(
    towerId,
    [
      {
        rowId,
        l2: targetRow.l2,
        l3: targetRow.l3,
        // V5 L4 Activity Group context — see the note in `runForRows`.
        l4: targetRow.l4,
        l5Activities: newL4Activities,
        ...(feedback ? { feedback } : {}),
      },
    ],
    digest ? { towerIntakeDigest: digest } : undefined,
  );
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
  const l5Items: L4Item[] = curated.l5Items.map((item) => {
    const id = synthId(rowId, item.name);
    const overlay = aiCurationOverlay[id];
    const initiativeName = item.aiEligible
      ? overlay?.initiativeName ?? item.initiativeName
      : undefined;
    return {
      id,
      name: item.name,
      initiativeName,
      source: itemSource,
      generatedAt,
      aiCurationStatus: item.aiCurationStatus,
      aiEligible: item.aiEligible,
      // See docstring on the batched curation path above — feasibility is the
      // active signal; aiPriority is dropped on new writes.
      feasibility: item.feasibility,
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
  const finalL5Names = l5Items.map((x) => x.name);
  // PR3: include narrative context in the hash so it matches the client's
  // staleness check (which now also folds descriptions into the hash).
  const finalHash = computeCurationContentHash(
    targetRow.l2,
    targetRow.l3,
    finalL5Names,
    resolveRowDescriptions(towerId, targetRow.l2, targetRow.l3, targetRow.l4),
  );

  patchRow(towerId, rowId, {
    l5Items,
    l5Activities: finalL5Names,
    curationContentHash: finalHash,
    curationStage: "done",
    curationGeneratedAt: generatedAt,
    curationError: undefined,
  });

  const eligibleCount = l5Items.filter((x) => x.aiEligible).length;
  const summary: RegenerateRowSummary = {
    rowId,
    ok: true,
    source: curRes.result.source,
    l4Count: l5Items.length,
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
  patch: Partial<L4WorkforceRow>,
): void {
  const fresh = getAssessProgram().towers[towerId];
  if (!fresh) return;
  setTowerAssess(towerId, {
    l4Rows: fresh.l4Rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
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
    l5Activities: L4WorkforceRow["l5Activities"];
    l5Items: L4WorkforceRow["l5Items"];
    curationContentHash: L4WorkforceRow["curationContentHash"];
    curationStage: L4WorkforceRow["curationStage"];
    curationGeneratedAt: L4WorkforceRow["curationGeneratedAt"];
    curationError: L4WorkforceRow["curationError"];
  },
  error: string,
): void {
  patchRow(towerId, rowId, {
    l5Activities: snapshot.l5Activities,
    l5Items: snapshot.l5Items,
    curationContentHash: snapshot.curationContentHash,
    curationGeneratedAt: snapshot.curationGeneratedAt,
    curationStage: "failed",
    curationError: error,
  });
}
