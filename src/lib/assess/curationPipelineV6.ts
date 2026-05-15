/**
 * Curation pipeline orchestrator — drives the per-L3 LLM streaming route
 * and writes per-row atomic patches into the local store as each `row`
 * event lands.
 *
 * Streaming UX:
 *   - Each row flips to `running-curate` before the stream opens.
 *   - Each row transitions to `done` independently as its `row` event
 *     lands. The user sees rows fill in across the L3 view rather than
 *     waiting for the full batch.
 *   - Per-row atomic write: when a `row` event arrives we re-read the
 *     latest program, patch the single L3 row with `{l3Initiatives,
 *     curationContentHash, curationStage: "done", curationGeneratedAt}`
 *     in one `setTowerAssess` call so cache key and cache contents
 *     cannot drift.
 *
 * Failure isolation:
 *   - A single L3's LLM failure never collapses the whole tower — the
 *     server emits a deterministic stub for that row as
 *     `source: "fallback"` and the orchestrator writes it through the
 *     same atomic patch path.
 *   - A catastrophic stream error (network drop / server crash) leaves
 *     unwritten rows with `curationStage: "running-curate"`; the user
 *     can re-run via the StaleCurationBanner to retry just those rows.
 */

import type {
  CurationStage,
  L3Initiative,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import { getAssessProgram, setTowerAssess } from "@/lib/localStore";
import { buildTowerReadinessDigest } from "@/lib/assess/towerReadinessIntake";
import {
  streamCurateL3Initiatives,
  type CurateL3InitiativesRowInput,
  type StreamCurateL3RowEvent,
} from "@/lib/assess/assessClientApiV6";
import type { CurateL3OverallSource } from "@/lib/assess/curateL3InitiativesStreamProtocol";

export type RunV6Options = {
  towerId: TowerId;
  /** L3 row ids to curate. Typically every row whose `curationStage === "queued"`. */
  rowIds: string[];
  signal?: AbortSignal;
};

export type RunV6Progress = {
  rowId: string;
  stage: CurationStage;
  /** Populated when stage === "failed". */
  error?: string;
};

export type RunV6Summary = {
  totalRows: number;
  succeeded: number;
  failed: number;
  /**
   * Provenance of the curation path that won. Post-streaming this is the
   * stream's `source` field — `"mixed"` when SOME rows used the LLM and
   * others fell back to the deterministic stub.
   */
  source?: CurateL3OverallSource;
  /** Server-side warning text when LLM was unavailable / fell back. */
  warning?: string;
};

/**
 * Drive the per-L3 LLM streaming pipeline across the queued rows for a
 * tower. Caller (typically `StaleCurationBanner` / Step 4 "Refresh AI
 * guidance") supplies every L3 whose `curationStage === "queued"`.
 *
 * The orchestrator:
 *   1. Resolves the L4 child context for each L3 row by walking the
 *      tower's `l4Rows` and matching `childL4RowIds`.
 *   2. Marks every row `running-curate` so the UI shows a "scoring..."
 *      pill on each L3 card.
 *   3. Opens the streaming POST to `/api/assess/curate-l3-initiatives`
 *      with `Accept: application/x-ndjson`.
 *   4. On each `row` event, atomically patches the local store with the
 *      stamped `L3Initiative[]` and flips the row to `done`.
 *   5. Returns the aggregate `RunV6Summary` for the toast.
 */
export async function runForL3Rows(
  opts: RunV6Options,
  onProgress?: (p: RunV6Progress) => void,
): Promise<RunV6Summary> {
  const summary: RunV6Summary = {
    totalRows: opts.rowIds.length,
    succeeded: 0,
    failed: 0,
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

  // Resolve the L4 child context for each L3 row. Rows whose L3 row
  // doesn't exist any more get failed immediately.
  const inputs: CurateL3InitiativesRowInput[] = [];
  const liveRowIds = new Set<string>();
  for (const rowId of opts.rowIds) {
    const l3Row = towerState.l3Rows?.find((r) => r.id === rowId);
    if (!l3Row) {
      writeRowFailure(opts.towerId, rowId, "L3 row no longer exists.");
      onProgress?.({
        rowId,
        stage: "failed",
        error: "L3 row no longer exists.",
      });
      summary.failed += 1;
      continue;
    }
    const childL4s = l3Row.childL4RowIds
      .map((cid) => {
        const l4Row = towerState.l4Rows.find((r) => r.id === cid);
        if (!l4Row) return null;
        return {
          id: l4Row.id,
          name: l4Row.l4,
          l5Activities: l4Row.l5Activities ?? [],
        };
      })
      .filter((c): c is { id: string; name: string; l5Activities: string[] } =>
        c != null,
      );
    inputs.push({
      rowId: l3Row.id,
      l1: l3Row.l1,
      l2: l3Row.l2,
      l3: l3Row.l3,
      childL4s,
    });
    liveRowIds.add(rowId);
  }

  if (inputs.length === 0) return summary;
  if (opts.signal?.aborted) return summary;

  // Mark every input row `running-curate` so each L3 card shows a
  // scoring pill immediately. The streaming row events below flip them
  // to `done` (or `failed`) one at a time as they land.
  for (const r of inputs) {
    markRowStage(opts.towerId, r.rowId, "running-curate");
    onProgress?.({ rowId: r.rowId, stage: "running-curate" });
  }

  const towerIntakeDigest = buildTowerReadinessDigest(
    getAssessProgram().towers[opts.towerId]?.aiReadinessIntake,
  );

  /**
   * Per-row atomic stamp — re-reads the latest program inside
   * `setTowerAssess` (a parallel patch on a different L3 may have landed
   * mid-stream) and rewrites only the matching row.
   */
  const stampRow = (
    ev: StreamCurateL3RowEvent,
  ): void => {
    const fresh = getAssessProgram().towers[opts.towerId];
    if (!fresh || !fresh.l3Rows) return;
    const generatedAt = new Date().toISOString();
    const itemSource: L3Initiative["source"] =
      ev.source === "llm" ? "llm" : "fallback";
    setTowerAssess(opts.towerId, {
      l3Rows: fresh.l3Rows.map((r) => {
        if (r.id !== ev.rowId) return r;
        const initiatives: L3Initiative[] = ev.l3Initiatives.map((p) => ({
          id: p.id,
          solutionName: p.solutionName,
          tagline: p.tagline,
          aiRationale: p.aiRationale,
          feasibility: p.feasibility,
          ...(p.iconKey ? { iconKey: p.iconKey } : {}),
          ...(p.primaryVendor ? { primaryVendor: p.primaryVendor } : {}),
          ...(p.coversL4RowIds && p.coversL4RowIds.length > 0
            ? { coversL4RowIds: p.coversL4RowIds }
            : {}),
          ...(p.promptVersion ? { promptVersion: p.promptVersion } : {}),
          source: itemSource,
          generatedAt,
        }));
        return {
          ...r,
          l3Initiatives: initiatives,
          curationStage: "done",
          curationGeneratedAt: generatedAt,
          curationContentHash: r.curationContentHash ?? generatedAt,
          // Clear any stale error from a previous failed attempt.
          curationError: undefined,
        };
      }),
    });
  };

  const succeededRowIds = new Set<string>();

  const apiRes = await streamCurateL3Initiatives(opts.towerId, inputs, {
    towerIntakeDigest,
    signal: opts.signal,
    onRow: (ev) => {
      stampRow(ev);
      succeededRowIds.add(ev.rowId);
      onProgress?.({ rowId: ev.rowId, stage: "done" });
    },
  });

  if (!apiRes.ok) {
    // Stream failed catastrophically — every row that hadn't streamed a
    // success event gets marked `failed` so the user knows what to retry.
    for (const r of inputs) {
      if (succeededRowIds.has(r.rowId)) {
        summary.succeeded += 1;
        continue;
      }
      writeRowFailure(opts.towerId, r.rowId, apiRes.error);
      onProgress?.({ rowId: r.rowId, stage: "failed", error: apiRes.error });
      summary.failed += 1;
    }
    return summary;
  }

  // Stream succeeded for every row (rows that fell back deterministically
  // also count as "succeeded" — the row landed, just with a stub).
  for (const r of inputs) {
    if (succeededRowIds.has(r.rowId)) {
      summary.succeeded += 1;
    } else {
      writeRowFailure(opts.towerId, r.rowId, "Row event never arrived");
      onProgress?.({
        rowId: r.rowId,
        stage: "failed",
        error: "Row event never arrived",
      });
      summary.failed += 1;
    }
  }
  summary.source = apiRes.result.source;
  summary.warning = apiRes.result.warning;
  return summary;
}

/**
 * Atomic stage flip on a single L3 row. Used both for `running-curate`
 * (pre-stream) and `failed` (post-error). Re-reads the latest program
 * inside `setTowerAssess` so concurrent stage flips on different rows
 * don't clobber each other.
 */
function markRowStage(
  towerId: TowerId,
  rowId: string,
  stage: CurationStage,
): void {
  const fresh = getAssessProgram().towers[towerId];
  if (!fresh || !fresh.l3Rows) return;
  setTowerAssess(towerId, {
    l3Rows: fresh.l3Rows.map((r) =>
      r.id === rowId ? ({ ...r, curationStage: stage } as L3WorkforceRowV6) : r,
    ),
  });
}

function writeRowFailure(towerId: TowerId, rowId: string, error: string): void {
  const fresh = getAssessProgram().towers[towerId];
  if (!fresh || !fresh.l3Rows) return;
  setTowerAssess(towerId, {
    l3Rows: fresh.l3Rows.map((r) =>
      r.id === rowId
        ? ({ ...r, curationStage: "failed", curationError: error } as L3WorkforceRowV6)
        : r,
    ),
  });
}

/**
 * Sweep any L3 rows in this tower stuck on a `running-*` curation stage
 * back to `"failed"` with a clear interrupted message. Used as a one-shot
 * recovery on toolbar mount: the regenerate pipeline is entirely
 * client-driven, so a persisted `running-*` flag with no live runner is
 * by definition orphaned (server crash, dev-server restart, tab closed
 * mid-stream). Returns the count of rows unstuck.
 *
 * Idempotent. Safe to call on every toolbar mount — only touches rows
 * that are actually orphaned.
 */
export function unstickInterruptedCurationRows(
  towerId: TowerId,
): { unstuck: number } {
  const fresh = getAssessProgram().towers[towerId];
  if (!fresh || !fresh.l3Rows || fresh.l3Rows.length === 0) {
    return { unstuck: 0 };
  }
  const INTERRUPTED_MSG =
    "Previous regenerate run was interrupted before it finished. Try Regenerate again.";
  let unstuck = 0;
  const nextL3Rows = fresh.l3Rows.map((r) => {
    if (
      r.curationStage === "running-l5" ||
      r.curationStage === "running-verdict" ||
      r.curationStage === "running-curate"
    ) {
      unstuck += 1;
      return {
        ...r,
        curationStage: "failed" as const,
        curationError: r.curationError ?? INTERRUPTED_MSG,
      };
    }
    return r;
  });
  if (unstuck > 0) {
    setTowerAssess(towerId, { l3Rows: nextL3Rows });
  }
  return { unstuck };
}

/**
 * Collect the L3 row ids in a tower whose `curationStage === "queued"`.
 * Used by the StaleCurationBanner CTA to fire `runForL3Rows(towerId,
 * queuedL3Ids)` against the L3-grain pipeline.
 */
export function queuedL3RowIdsForTower(
  towerId: TowerId,
): { rowIds: string[]; total: number } {
  const program = getAssessProgram();
  const t = program.towers[towerId];
  if (!t || !t.l3Rows) return { rowIds: [], total: 0 };
  const ids = t.l3Rows
    .filter((r) => r.curationStage === "queued")
    .map((r) => r.id);
  return { rowIds: ids, total: t.l3Rows.length };
}
