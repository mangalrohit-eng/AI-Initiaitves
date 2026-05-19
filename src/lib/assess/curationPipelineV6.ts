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
  streamEnrichInitiativesFromUpload,
  type CurateL3InitiativesRowInput,
  type EnrichUploadInputRow,
  type EnrichUploadRosterEntry,
  type StreamCurateL3RowEvent,
  type StreamEnrichUploadRowEvent,
} from "@/lib/assess/assessClientApiV6";
import type { CurateL3OverallSource } from "@/lib/assess/curateL3InitiativesStreamProtocol";
import { normalizeL3ForMatch } from "@/lib/assess/parseInitiativeUploadFile";
import type { ParsedInitiativeUploadRow } from "@/lib/assess/parseInitiativeUploadFile";

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

  const intake = getAssessProgram().towers[opts.towerId]?.aiReadinessIntake;
  const towerIntakeDigest = buildTowerReadinessDigest(intake);
  const intakeFields = intake
    ? {
        currentAiTools: intake.currentAiTools,
        experimentsLearnings: intake.experimentsLearnings,
        readyNow: intake.readyNow,
        noGoAreas: intake.noGoAreas,
      }
    : undefined;
  const intakeImportedAt = intake?.importedAt;

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
        // Preservation guardrail: discovery / regenerate must NEVER
        // wipe user-uploaded initiatives. Any item with
        // `source === "manual"` survives the regenerate and is
        // re-attached ahead of the new LLM batch. The Step 4 upload
        // path is the only writer of `"manual"`.
        const preservedManual: L3Initiative[] = (r.l3Initiatives ?? []).filter(
          (it) => it.source === "manual",
        );
        const llmInitiatives: L3Initiative[] = ev.l3Initiatives.map((p) => ({
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
          ...(p.intakeStatus ? { intakeStatus: p.intakeStatus } : {}),
          source: itemSource,
          generatedAt,
        }));
        return {
          ...r,
          l3Initiatives: [...preservedManual, ...llmInitiatives],
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
    intakeFields,
    intakeImportedAt,
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

/**
 * Count `source: "manual"` initiatives across the given L3 row ids on
 * a tower. Used by `RegenerateAiGuidanceToolbar` to surface a "N manual
 * initiatives will be preserved" line in the confirm dialog so the
 * facilitator knows the upload survives the regenerate.
 */
export function countManualInitiativesForRows(
  towerId: TowerId,
  rowIds: ReadonlyArray<string>,
): number {
  const t = getAssessProgram().towers[towerId];
  if (!t || !t.l3Rows) return 0;
  const ids = new Set(rowIds);
  let count = 0;
  for (const r of t.l3Rows) {
    if (!ids.has(r.id)) continue;
    for (const init of r.l3Initiatives ?? []) {
      if (init.source === "manual") count += 1;
    }
  }
  return count;
}

/**
 * Count every `source: "manual"` initiative on a tower, regardless of
 * row id. Surfaces the "Clear uploaded initiatives (N)" badge in the
 * upload panel.
 */
export function countAllManualInitiatives(towerId: TowerId): number {
  const t = getAssessProgram().towers[towerId];
  if (!t || !t.l3Rows) return 0;
  let count = 0;
  for (const r of t.l3Rows) {
    for (const init of r.l3Initiatives ?? []) {
      if (init.source === "manual") count += 1;
    }
  }
  return count;
}

/**
 * Hard-delete every `source: "manual"` initiative on the tower. The
 * symmetric inverse of `runEnrichmentFromUpload` — undoes a bad upload
 * so discovery can re-run cleanly without the manual entries clinging
 * to L3 rows. LLM-discovered (`"llm"`) and deterministic-fallback
 * (`"fallback"`) initiatives are left untouched.
 *
 * Returns the number of initiatives removed.
 */
export function clearManualInitiativesForTower(towerId: TowerId): number {
  const t = getAssessProgram().towers[towerId];
  if (!t || !t.l3Rows) return 0;
  let removed = 0;
  const nextL3 = t.l3Rows.map((r) => {
    const existing = r.l3Initiatives ?? [];
    const kept = existing.filter((it) => it.source !== "manual");
    if (kept.length === existing.length) return r;
    removed += existing.length - kept.length;
    return { ...r, l3Initiatives: kept } as L3WorkforceRowV6;
  });
  if (removed === 0) return 0;
  setTowerAssess(towerId, { l3Rows: nextL3 });
  return removed;
}

/**
 * Hard-delete a single `source: "manual"` initiative by id. Used by
 * the per-card trash affordance in `SolutionCardV2`. Refuses to delete
 * `"llm"` or `"fallback"` entries — those go through reject / regen.
 *
 * Returns `true` when an item was removed; `false` when nothing matched.
 */
export function deleteManualInitiative(
  towerId: TowerId,
  initiativeId: string,
): boolean {
  const t = getAssessProgram().towers[towerId];
  if (!t || !t.l3Rows) return false;
  let removed = false;
  const nextL3 = t.l3Rows.map((r) => {
    const existing = r.l3Initiatives ?? [];
    const idx = existing.findIndex(
      (it) => it.id === initiativeId && it.source === "manual",
    );
    if (idx < 0) return r;
    const kept = existing.filter((_, i) => i !== idx);
    removed = true;
    return { ...r, l3Initiatives: kept } as L3WorkforceRowV6;
  });
  if (!removed) return false;
  setTowerAssess(towerId, { l3Rows: nextL3 });
  return true;
}

// ===========================================================================
//   Upload-initiative enrichment — the "user supplied the list" path.
// ===========================================================================

export type RunEnrichmentOptions = {
  towerId: TowerId;
  /** Parsed rows from the upload UI. Empty array is a no-op. */
  parsedRows: ParsedInitiativeUploadRow[];
  /**
   * Optional `useAssessSync().flushSave` callback. The panel passes
   * this in so the orchestrator can drain the localStorage → Postgres
   * write pipeline at end-of-run. Hooks can't be consumed from a pure
   * module — passing the callback keeps the orchestrator hook-free.
   */
  flushSave?: () => Promise<void>;
  signal?: AbortSignal;
};

export type RunEnrichmentProgress = {
  /** Total upload rows (post-parse, post-filter). */
  total: number;
  /** Successfully enriched and stamped to the store so far. */
  enriched: number;
  /** Failed (LLM error path that fell back to the deterministic stub). */
  failed: number;
};

export type RunEnrichmentSummary = {
  totalUploads: number;
  enriched: number;
  failed: number;
  /** Number of rows whose L3 was LLM-picked (no client-side match). */
  llmMatchedL3Count: number;
  /**
   * How many pre-existing initiative cards were wiped on this tower at
   * the start of the run. Includes LLM-discovered, fallback, and prior
   * manual entries — the upload is the new source of truth.
   */
  wipedCount: number;
  /**
   * Subset of `wipedCount` whose cached brief (`generatedProcess`) was
   * carried forward onto a new card with the same `solutionName`. Lets
   * the toast surface "M briefs preserved" so the user knows they won't
   * pay the 30-90s brief regen cost.
   */
  briefsPreservedCount: number;
  /**
   * `true` when the tower was wiped at the start of the run but every
   * enrichment chunk failed, leaving the tower empty. UI surfaces a
   * recovery hint ("re-upload or run Regenerate AI guidance").
   */
  wipedButFailed: boolean;
  source?: CurateL3OverallSource;
  warning?: string;
};

const MAX_UPLOADS_PER_REQUEST = 50;

/**
 * Drive the per-upload enrichment LLM stream across a parsed list of
 * uploaded initiatives. The upload is the new source of truth — the
 * orchestrator wipes every existing initiative card on the tower
 * (LLM-discovered, fallback, and prior manual entries) before stamping
 * the parsed rows as the only remaining cards.
 *
 *   1. Loads the tower's L3 roster and pre-matches each parsed row's
 *      L3 column (exact / case-insensitive / normalized) against it.
 *   2. Snapshots every existing card's id + `generatedProcess` keyed
 *      by lowercased `solutionName` so a same-name re-upload can carry
 *      forward the cached brief (avoids the 30-90s regen cost).
 *   3. Wipes `l3Initiatives = []` on every L3 row in a single atomic
 *      `setTowerAssess` patch.
 *   4. Chunks the uploads into batches of `MAX_UPLOADS_PER_REQUEST` (50)
 *      to respect the route's per-call cap.
 *   5. For each batch, streams the enrichment NDJSON. Each `row` event
 *      atomically appends to the matched L3 row's `l3Initiatives` with
 *      `source: "manual"`. Within-file duplicates auto-suffix `(N)`.
 *   6. Calls `flushSave()` once at end-of-run so Postgres drains in
 *      one shot (mirrors `BulkGenerateBriefsToolbar`).
 *
 * Does NOT flip `curationStage` — that flag is reserved for the
 * discovery pipeline. Card progress is panel-level via `onProgress`.
 */
export async function runEnrichmentFromUpload(
  opts: RunEnrichmentOptions,
  onProgress?: (p: RunEnrichmentProgress) => void,
): Promise<RunEnrichmentSummary> {
  const summary: RunEnrichmentSummary = {
    totalUploads: opts.parsedRows.length,
    enriched: 0,
    failed: 0,
    llmMatchedL3Count: 0,
    wipedCount: 0,
    briefsPreservedCount: 0,
    wipedButFailed: false,
  };

  if (opts.parsedRows.length === 0) return summary;

  const program = getAssessProgram();
  const towerState = program.towers[opts.towerId];
  if (!towerState || !towerState.l3Rows || towerState.l3Rows.length === 0) {
    summary.failed = opts.parsedRows.length;
    summary.warning =
      "Tower has no L3 rows yet — import the capability map first, then upload initiatives.";
    onProgress?.({
      total: summary.totalUploads,
      enriched: 0,
      failed: summary.failed,
    });
    return summary;
  }

  // L3 roster for the LLM and the client-side pre-match.
  const l4ById = new Map(towerState.l4Rows.map((r) => [r.id, r.l4]));
  const roster: EnrichUploadRosterEntry[] = towerState.l3Rows.map((r) => ({
    rowId: r.id,
    l1: r.l1,
    l2: r.l2,
    l3: r.l3,
    childL4Names: r.childL4RowIds
      .map((id) => l4ById.get(id))
      .filter((s): s is string => !!s),
  }));
  const rosterByNormalizedL3 = new Map<string, string>();
  for (const r of roster) {
    const norm = normalizeL3ForMatch(r.l3);
    if (norm) rosterByNormalizedL3.set(norm, r.rowId);
  }

  // Build the API inputs: stable client-side `uploadRowId`s, pre-match
  // when the user typed an exact L3 we recognize.
  const apiInputs: EnrichUploadInputRow[] = opts.parsedRows.map((row, i) => {
    const normalized = normalizeL3ForMatch(row.l3Raw);
    const preMatched = normalized ? rosterByNormalizedL3.get(normalized) : undefined;
    if (!preMatched) summary.llmMatchedL3Count += 1;
    return {
      uploadRowId: `upload-${row.index}-${i}`,
      solutionName: row.solutionName,
      solutionDescription: row.solutionDescription,
      tech: row.tech,
      ...(preMatched ? { preMatchedL3RowId: preMatched } : {}),
      ...(row.l3Raw ? { l3Hint: row.l3Raw } : {}),
    };
  });

  // Intake threading — same shape as discovery.
  const intake = towerState.aiReadinessIntake;
  const towerIntakeDigest = buildTowerReadinessDigest(intake);
  const intakeFields = intake
    ? {
        currentAiTools: intake.currentAiTools,
        experimentsLearnings: intake.experimentsLearnings,
        readyNow: intake.readyNow,
        noGoAreas: intake.noGoAreas,
      }
    : undefined;
  const intakeImportedAt = intake?.importedAt;

  // -------------------------------------------------------------------
  // WIPE — the upload is the new source of truth for this tower.
  // -------------------------------------------------------------------
  //
  // Snapshot existing cards keyed by lowercased solutionName so a same-
  // name re-upload can carry forward the cached `generatedProcess`
  // (avoids the 30-90s brief regen cost). We keep only the id and the
  // cached brief — provenance, tagline, rationale, etc. all come from
  // the new enrichment payload.
  type BriefSnapshot = {
    id: string;
    generatedProcess?: L3Initiative["generatedProcess"];
  };
  const briefCacheByName = new Map<string, BriefSnapshot>();
  let wipedCount = 0;
  for (const r of towerState.l3Rows) {
    for (const it of r.l3Initiatives ?? []) {
      wipedCount += 1;
      const key = it.solutionName.trim().toLowerCase();
      if (!key) continue;
      // Prefer the entry that already has a cached brief; if multiple
      // duplicates exist (shouldn't, but be defensive), the first one
      // with a cache wins.
      const prior = briefCacheByName.get(key);
      if (!prior || (it.generatedProcess && !prior.generatedProcess)) {
        briefCacheByName.set(key, {
          id: it.id,
          ...(it.generatedProcess ? { generatedProcess: it.generatedProcess } : {}),
        });
      }
    }
  }
  summary.wipedCount = wipedCount;
  if (wipedCount > 0) {
    setTowerAssess(opts.towerId, {
      l3Rows: towerState.l3Rows.map(
        (r) =>
          ({ ...r, l3Initiatives: [] }) as L3WorkforceRowV6,
      ),
    });
  }

  // Atomic per-row stamper. Within-file duplicates get a `(N)` suffix.
  // Cached briefs are re-attached by exact-name match against the
  // pre-wipe snapshot.
  const stampOne = (ev: StreamEnrichUploadRowEvent): void => {
    const fresh = getAssessProgram().towers[opts.towerId];
    if (!fresh || !fresh.l3Rows) return;

    const generatedAt = new Date().toISOString();
    const targetRowId = ev.matchedRowId;
    const payload = ev.payload;
    const targetRow = fresh.l3Rows.find((r) => r.id === targetRowId);
    if (!targetRow) {
      summary.failed += 1;
      return;
    }
    const existing = targetRow.l3Initiatives ?? [];

    // Within-file dedupe: if the SAME solutionName already landed on
    // this L3 in this run, auto-suffix the second arrival with `(N)`.
    let finalName = payload.solutionName;
    let finalId = payload.id;
    const baseLower = payload.solutionName.trim().toLowerCase();
    const lowerExisting = new Set(
      existing.map((it) => it.solutionName.trim().toLowerCase()),
    );
    if (lowerExisting.has(baseLower)) {
      let n = 2;
      const baseName = payload.solutionName.trim();
      while (
        lowerExisting.has(`${baseName} (${n})`.toLowerCase())
      ) {
        n += 1;
      }
      finalName = `${baseName} (${n})`;
      finalId = payload.id.replace(/[^:]*$/, slugifyForId(finalName));
    }

    // Brief-cache reattachment by exact (case-insensitive) name match.
    const cacheHit = briefCacheByName.get(finalName.trim().toLowerCase());
    const reuseId = cacheHit?.id;
    const reuseBrief = cacheHit?.generatedProcess;
    if (cacheHit) {
      summary.briefsPreservedCount += 1;
    }

    const newInitiative: L3Initiative = {
      id: reuseId ?? finalId,
      solutionName: finalName,
      tagline: payload.tagline,
      aiRationale: payload.aiRationale,
      feasibility: payload.feasibility,
      ...(payload.iconKey ? { iconKey: payload.iconKey } : {}),
      ...(payload.primaryVendor ? { primaryVendor: payload.primaryVendor } : {}),
      ...(payload.coversL4RowIds && payload.coversL4RowIds.length > 0
        ? { coversL4RowIds: payload.coversL4RowIds }
        : {}),
      ...(payload.promptVersion ? { promptVersion: payload.promptVersion } : {}),
      ...(payload.intakeStatus ? { intakeStatus: payload.intakeStatus } : {}),
      ...(reuseBrief ? { generatedProcess: reuseBrief } : {}),
      source: "manual",
      generatedAt,
    };

    setTowerAssess(opts.towerId, {
      l3Rows: fresh.l3Rows.map((r) =>
        r.id === targetRowId
          ? ({ ...r, l3Initiatives: [...existing, newInitiative] } as L3WorkforceRowV6)
          : r,
      ),
    });
    if (ev.source === "fallback") {
      summary.failed += 1;
    } else {
      summary.enriched += 1;
    }
  };

  // Chunk + stream.
  const chunks: EnrichUploadInputRow[][] = [];
  for (let i = 0; i < apiInputs.length; i += MAX_UPLOADS_PER_REQUEST) {
    chunks.push(apiInputs.slice(i, i + MAX_UPLOADS_PER_REQUEST));
  }

  let llmCount = 0;
  let fallbackCount = 0;
  let lastWarning: string | undefined;
  let aborted = false;

  for (const chunk of chunks) {
    if (opts.signal?.aborted) {
      aborted = true;
      break;
    }
    const apiRes = await streamEnrichInitiativesFromUpload(
      opts.towerId,
      chunk,
      roster,
      {
        towerIntakeDigest,
        intakeFields,
        intakeImportedAt,
        signal: opts.signal,
        onRow: (ev) => {
          stampOne(ev);
          if (ev.source === "llm") llmCount += 1;
          else fallbackCount += 1;
          onProgress?.({
            total: summary.totalUploads,
            enriched: summary.enriched,
            failed: summary.failed,
          });
        },
      },
    );
    if (!apiRes.ok) {
      summary.failed += chunk.length;
      summary.warning = apiRes.error;
      break;
    }
    if (apiRes.result.warning) lastWarning = apiRes.result.warning;
  }

  summary.source = computeOverallSource(llmCount, fallbackCount);
  summary.warning = summary.warning ?? lastWarning;
  // If we wiped at the top but nothing landed, surface a recovery hint.
  if (summary.wipedCount > 0 && summary.enriched === 0) {
    summary.wipedButFailed = true;
  }

  if (opts.flushSave && !aborted) {
    try {
      await opts.flushSave();
    } catch {
      // best-effort; debounce will retry.
    }
  }

  return summary;
}

function computeOverallSource(
  llmCount: number,
  fallbackCount: number,
): CurateL3OverallSource {
  if (llmCount > 0 && fallbackCount === 0) return "llm";
  if (llmCount === 0 && fallbackCount > 0) return "fallback";
  if (llmCount > 0 && fallbackCount > 0) return "mixed";
  return "fallback";
}

function slugifyForId(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "x"
  );
}
