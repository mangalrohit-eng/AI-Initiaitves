/**
 * Client-side wrappers for the v6 L3 Initiative APIs.
 *
 * Sibling to `assessClientApi.ts` (the v5 helpers) — kept in a separate
 * file so the v5 surface stays untouched through the cutover. Phase 7
 * cleanup deletes the v5 helpers and folds these back into the canonical
 * file once the schema flag is retired.
 *
 * Two surfaces:
 *   1. `clientCurateL3Initiatives` — JSON variant for non-streaming
 *      callers (e.g. test scripts, batch refresh).
 *   2. `streamCurateL3Initiatives` — NDJSON streaming variant. The
 *      orchestrator (`curationPipelineV6.ts`) drives this so per-row
 *      events land in the local store as they arrive.
 */

import type { TowerAiReadinessIntake, TowerId } from "@/data/assess/types";
import type {
  CurateL3InitiativePayload,
  CurateL3OverallSource,
  CurateL3RowSource,
  EnrichUploadStreamEvent,
} from "@/lib/assess/curateL3InitiativesStreamProtocol";

/**
 * Subset of `TowerAiReadinessIntake` the curation route needs for the
 * server-side `intakeStatus` validator. Only the four fields read by
 * the validator are forwarded — keeps the wire payload small and avoids
 * leaking unrelated free-text answers (e.g. `biggestImpact`,
 * `dataRelevant`) the validator never inspects.
 */
export type CurateL3IntakeFields = Pick<
  TowerAiReadinessIntake,
  "currentAiTools" | "experimentsLearnings" | "readyNow" | "noGoAreas"
>;

/**
 * One L3 row's worth of input passed to the v6 curation route. Mirrors
 * the server-side `CurateL3LLMRowInput` type exactly so the orchestrator
 * can pass-through without remapping.
 */
export type CurateL3InitiativesRowInput = {
  rowId: string;
  l1: string;
  l2: string;
  l3: string;
  childL4s: Array<{
    id: string;
    name: string;
    l5Activities: string[];
  }>;
  feedback?: string;
};

export type CurateL3InitiativesRowResult = {
  rowId: string;
  l3Initiatives: CurateL3InitiativePayload[];
};

export type CurateL3InitiativesResult = {
  source: CurateL3OverallSource;
  rows: CurateL3InitiativesRowResult[];
  warning?: string;
};

/**
 * Non-streaming variant — POSTs every row in one request, awaits the
 * full JSON response. Mainly for test scripts and batch refresh; the UI
 * path uses `streamCurateL3Initiatives` for progressive hydration.
 */
export async function clientCurateL3Initiatives(
  towerId: TowerId,
  rows: CurateL3InitiativesRowInput[],
  opts?: {
    towerIntakeDigest?: string;
    intakeFields?: CurateL3IntakeFields;
    intakeImportedAt?: string;
  },
): Promise<
  | { ok: true; result: CurateL3InitiativesResult }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch("/api/assess/curate-l3-initiatives", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      towerId,
      rows,
      ...(opts?.towerIntakeDigest ? { towerIntakeDigest: opts.towerIntakeDigest } : {}),
      ...(opts?.intakeFields ? { intakeFields: opts.intakeFields } : {}),
      ...(opts?.intakeImportedAt
        ? { intakeImportedAt: opts.intakeImportedAt }
        : {}),
    }),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  const data = body as {
    ok?: boolean;
    source?: CurateL3OverallSource;
    rows?: CurateL3InitiativesRowResult[];
    warning?: string;
  };
  if (!data.ok || !Array.isArray(data.rows) || !data.source) {
    return { ok: false, error: "Malformed L3 curation response", status: res.status };
  }
  return {
    ok: true,
    result: {
      source: data.source,
      rows: data.rows,
      warning: data.warning,
    },
  };
}

// ===========================================================================
//   Streaming variant — drives the orchestrator's per-row atomic writes
// ===========================================================================

export type StreamCurateL3RowEvent = {
  rowId: string;
  l3Initiatives: CurateL3InitiativePayload[];
  source: CurateL3RowSource;
  warning?: string;
};

export type StreamCurateL3Opts = {
  /** Optional `AbortController.signal` so callers can cancel the stream. */
  signal?: AbortSignal;
  /** Fired once when the server has parsed the request and is about to
   *  start emitting rows. Surfaces total row count for progress UI. */
  onStarted?: (info: { totalRows: number }) => void;
  /** Fired once per L3 row, in completion order (NOT input order). The UI
   *  / orchestrator should key by `rowId` and merge into its row store. */
  onRow?: (ev: StreamCurateL3RowEvent) => void;
};

/**
 * Streams the per-L3 curation as it lands. Sends `Accept:
 * application/x-ndjson` so the route emits the v6 NDJSON event protocol
 * (`curateL3InitiativesStreamProtocol`).
 *
 * Failure modes mirror the v5 streaming variant:
 *  - HTTP 4xx (auth / validation) → `{ ok: false, error, status }`.
 *  - Network failure mid-stream → `{ ok: false }` with rows-so-far
 *    discarded; orchestrator decides whether to retry.
 *  - Per-row LLM failure → server emits `source: "fallback"` for that
 *    row; the caller's `onRow` sees the deterministic stub and the
 *    final `result.source` is `"mixed"`.
 */
export async function streamCurateL3Initiatives(
  towerId: TowerId,
  rows: CurateL3InitiativesRowInput[],
  opts: StreamCurateL3Opts & {
    towerIntakeDigest?: string;
    /**
     * Structured intake fields for the post-LLM `intakeStatus` validator
     * on the server. When omitted, the server skips classification and
     * the LLM is instructed (via the digest's absence) to omit the
     * `intakeStatus` block entirely.
     */
    intakeFields?: CurateL3IntakeFields;
    /** ISO timestamp of the latest intake import — server stamps it onto every classification. */
    intakeImportedAt?: string;
  } = {},
): Promise<
  | { ok: true; result: CurateL3InitiativesResult }
  | { ok: false; error: string; status: number }
> {
  const { decodeL3StreamEvents, CURATE_L3_STREAM_CONTENT_TYPE } = await import(
    "./curateL3InitiativesStreamProtocol"
  );

  let res: Response;
  try {
    res = await fetch("/api/assess/curate-l3-initiatives", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: CURATE_L3_STREAM_CONTENT_TYPE,
      },
      body: JSON.stringify({
        towerId,
        rows,
        ...(opts.towerIntakeDigest
          ? { towerIntakeDigest: opts.towerIntakeDigest }
          : {}),
        ...(opts.intakeFields ? { intakeFields: opts.intakeFields } : {}),
        ...(opts.intakeImportedAt
          ? { intakeImportedAt: opts.intakeImportedAt }
          : {}),
      }),
      signal: opts.signal,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
      status: 0,
    };
  }

  if (!res.body) {
    return {
      ok: false,
      error: "L3 curation stream returned no body",
      status: res.status,
    };
  }

  const collected = new Map<string, CurateL3InitiativesRowResult>();
  let finalSource: CurateL3OverallSource | undefined;
  let warning: string | undefined;
  let serverError: { code: string; message: string } | undefined;

  try {
    for await (const ev of decodeL3StreamEvents(res.body)) {
      if (ev.kind === "started") {
        opts.onStarted?.({ totalRows: ev.totalRows });
      } else if (ev.kind === "row") {
        collected.set(ev.rowId, {
          rowId: ev.rowId,
          l3Initiatives: ev.l3Initiatives,
        });
        opts.onRow?.({
          rowId: ev.rowId,
          l3Initiatives: ev.l3Initiatives,
          source: ev.source,
          warning: ev.warning,
        });
      } else if (ev.kind === "done") {
        finalSource = ev.source;
        if (ev.warning) warning = ev.warning;
      } else if (ev.kind === "error") {
        serverError = { code: ev.code, message: ev.message };
        break;
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "L3 curation stream interrupted",
      status: res.status,
    };
  }

  if (serverError) {
    const status =
      serverError.code === "unauthorized"
        ? 401
        : serverError.code === "bad_request"
          ? 400
          : serverError.code === "payload_too_large"
            ? 413
            : 500;
    return { ok: false, error: serverError.message, status };
  }

  if (!finalSource) {
    return {
      ok: false,
      error: "L3 curation stream ended without 'done' event",
      status: res.status,
    };
  }

  const orderedRows: CurateL3InitiativesRowResult[] = rows.map(
    (input) =>
      collected.get(input.rowId) ?? { rowId: input.rowId, l3Initiatives: [] },
  );

  return {
    ok: true,
    result: {
      source: finalSource,
      rows: orderedRows,
      warning,
    },
  };
}

// ===========================================================================
//   Enrich-initiatives-from-upload — streaming client wrapper
// ===========================================================================

export type EnrichUploadInputRow = {
  uploadRowId: string;
  solutionName: string;
  solutionDescription: string;
  tech?: string;
  preMatchedL3RowId?: string;
  l3Hint?: string;
};

export type EnrichUploadRosterEntry = {
  rowId: string;
  l1: string;
  l2: string;
  l3: string;
  childL4Names?: string[];
};

export type StreamEnrichUploadRowEvent = {
  uploadRowId: string;
  matchedRowId: string;
  l3MatchRationale?: string;
  payload: CurateL3InitiativePayload;
  source: CurateL3RowSource;
  warning?: string;
};

export type StreamEnrichUploadOpts = {
  signal?: AbortSignal;
  onStarted?: (info: { totalUploads: number }) => void;
  onRow?: (ev: StreamEnrichUploadRowEvent) => void;
  towerIntakeDigest?: string;
  intakeFields?: CurateL3IntakeFields;
  intakeImportedAt?: string;
};

export type EnrichUploadResult = {
  source: CurateL3OverallSource;
  /** Rows in COMPLETION order, not input order. */
  rows: StreamEnrichUploadRowEvent[];
  warning?: string;
};

/**
 * Stream the per-upload-row enrichment as it lands. Sends `Accept:
 * application/x-ndjson` so the route emits the upload-enrichment NDJSON
 * event protocol (`EnrichUploadStreamEvent`). Failure modes mirror the
 * discovery stream.
 */
export async function streamEnrichInitiativesFromUpload(
  towerId: TowerId,
  uploads: EnrichUploadInputRow[],
  l3Roster: EnrichUploadRosterEntry[],
  opts: StreamEnrichUploadOpts = {},
): Promise<
  | { ok: true; result: EnrichUploadResult }
  | { ok: false; error: string; status: number }
> {
  const {
    decodeEnrichUploadStreamEvents,
    ENRICH_UPLOAD_STREAM_CONTENT_TYPE,
  } = await import("./curateL3InitiativesStreamProtocol");

  let res: Response;
  try {
    res = await fetch("/api/assess/enrich-initiatives-from-upload", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: ENRICH_UPLOAD_STREAM_CONTENT_TYPE,
      },
      body: JSON.stringify({
        towerId,
        uploads,
        l3Roster,
        ...(opts.towerIntakeDigest
          ? { towerIntakeDigest: opts.towerIntakeDigest }
          : {}),
        ...(opts.intakeFields ? { intakeFields: opts.intakeFields } : {}),
        ...(opts.intakeImportedAt
          ? { intakeImportedAt: opts.intakeImportedAt }
          : {}),
      }),
      signal: opts.signal,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
      status: 0,
    };
  }

  if (!res.body) {
    return {
      ok: false,
      error: "Enrich-upload stream returned no body",
      status: res.status,
    };
  }

  const collected: StreamEnrichUploadRowEvent[] = [];
  let finalSource: CurateL3OverallSource | undefined;
  let warning: string | undefined;
  let serverError: { code: string; message: string } | undefined;

  try {
    for await (const ev of decodeEnrichUploadStreamEvents(
      res.body,
    ) as AsyncGenerator<EnrichUploadStreamEvent>) {
      if (ev.kind === "started") {
        opts.onStarted?.({ totalUploads: ev.totalUploads });
      } else if (ev.kind === "row") {
        const rowEv: StreamEnrichUploadRowEvent = {
          uploadRowId: ev.uploadRowId,
          matchedRowId: ev.matchedRowId,
          payload: ev.payload,
          source: ev.source,
          ...(ev.l3MatchRationale
            ? { l3MatchRationale: ev.l3MatchRationale }
            : {}),
          ...(ev.warning ? { warning: ev.warning } : {}),
        };
        collected.push(rowEv);
        opts.onRow?.(rowEv);
      } else if (ev.kind === "done") {
        finalSource = ev.source;
        if (ev.warning) warning = ev.warning;
      } else if (ev.kind === "error") {
        serverError = { code: ev.code, message: ev.message };
        break;
      }
    }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Enrich-upload stream interrupted",
      status: res.status,
    };
  }

  if (serverError) {
    const status =
      serverError.code === "unauthorized"
        ? 401
        : serverError.code === "bad_request"
          ? 400
          : serverError.code === "payload_too_large"
            ? 413
            : 500;
    return { ok: false, error: serverError.message, status };
  }

  if (!finalSource) {
    return {
      ok: false,
      error: "Enrich-upload stream ended without 'done' event",
      status: res.status,
    };
  }

  return {
    ok: true,
    result: {
      source: finalSource,
      rows: collected,
      warning,
    },
  };
}
