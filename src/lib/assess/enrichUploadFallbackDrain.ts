/**
 * Set-difference helper used by the upload-enrichment route's
 * streaming path to drain rows that the LLM step left unemitted.
 *
 * Lives in its own module — not in the route file — because Next.js
 * route files may only export reserved names (`POST`, `runtime`, etc.).
 * Server-only consumers + the e2e harness both import from here.
 *
 * Context:
 *   - `enrichUploadedInitiativesPerRow` runs bounded-concurrency LLM
 *     calls (4 workers). Rows complete out of input-array order.
 *   - Two paths can leave an input row unemitted to the client:
 *       a) The function throws mid-batch (a worker's `onRowComplete`
 *          callback throws, an unhandled rejection escapes the worker
 *          try/catch, etc.). The previous route caught the throw and
 *          re-emitted `uploads.slice(emittedCount)` as fallback —
 *          positional, which silently drops rows whose gaps fall in
 *          the middle of the array.
 *       b) `req.signal` aborts BETWEEN worker iterations. Each worker
 *          checks `signal.aborted` at the top of its loop and returns
 *          silently without claiming the next index. `Promise.all`
 *          resolves cleanly, the function returns normally, the catch
 *          block never fires, and the unclaimed rows are never
 *          emitted. The 47-of-49 prod symptom.
 *
 * The route now calls `buildPendingFallbackRows` AFTER awaiting the
 * LLM step — regardless of how the step exited — and ships a
 * deterministic fallback row for every input not in the
 * `emittedRowIds` set. The set is populated synchronously next to
 * each successful `send(row event)` call in the route.
 */

import { fallbackEnrichedInitiative } from "@/lib/assess/enrichUploadedInitiativesLLM";
import type {
  EnrichUploadRowInput,
  L3RosterEntry,
} from "@/lib/assess/enrichUploadedInitiativesLLM";
import { buildL3InitiativeId } from "@/lib/assess/curateL3InitiativesLLM";
import type { TowerId } from "@/data/assess/types";
import type { CurateL3InitiativePayload } from "@/lib/assess/curateL3InitiativesStreamProtocol";

export type PendingFallbackRow = {
  uploadRowId: string;
  matchedRowId: string;
  payload: CurateL3InitiativePayload;
  source: "fallback";
};

function stampInitiativeId(
  towerId: TowerId,
  matchedRowId: string,
  payload: CurateL3InitiativePayload,
): CurateL3InitiativePayload {
  return {
    ...payload,
    id: buildL3InitiativeId(towerId, matchedRowId, payload.solutionName),
  };
}

function buildOneFallbackRow(
  towerId: TowerId,
  input: EnrichUploadRowInput,
  roster: ReadonlyArray<L3RosterEntry>,
): PendingFallbackRow {
  const rosterIds = new Set(roster.map((r) => r.rowId));
  const matchedRowId =
    input.preMatchedL3RowId && rosterIds.has(input.preMatchedL3RowId)
      ? input.preMatchedL3RowId
      : roster[0]!.rowId;
  const matchedRow = roster.find((r) => r.rowId === matchedRowId)!;
  const { payload } = fallbackEnrichedInitiative(towerId, input, {
    id: matchedRow.rowId,
    l3: matchedRow.l3,
  });
  return {
    uploadRowId: input.uploadRowId,
    matchedRowId: matchedRow.rowId,
    payload: stampInitiativeId(towerId, matchedRow.rowId, payload),
    source: "fallback",
  };
}

/**
 * Returns one deterministic fallback row for every upload whose
 * `uploadRowId` is NOT in `emittedRowIds`. Pure function — no I/O —
 * so the e2e harness can verify the rescue logic in isolation.
 *
 * Returns `[]` when the roster is empty (defensive guard — the route
 * would have rejected an empty roster up front, but the helper stays
 * total).
 */
export function buildPendingFallbackRows(
  towerId: TowerId,
  uploads: ReadonlyArray<EnrichUploadRowInput>,
  roster: ReadonlyArray<L3RosterEntry>,
  emittedRowIds: ReadonlySet<string>,
): PendingFallbackRow[] {
  if (roster.length === 0) return [];
  const out: PendingFallbackRow[] = [];
  for (const input of uploads) {
    if (emittedRowIds.has(input.uploadRowId)) continue;
    out.push(buildOneFallbackRow(towerId, input, roster));
  }
  return out;
}
