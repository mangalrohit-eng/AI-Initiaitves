/**
 * POST /api/assess/curate-initiatives
 *
 * Curates the candidate AI initiatives for each row in a tower. Under the
 * 5-layer capability map (`AssessProgramV5`) the row is an **L4 Activity
 * Group** and the leaves being scored are **L5 Activities**.
 *
 * Wire-format back-compat: the request payload accepts BOTH the new
 * `l5Activities` field and the legacy `l4Activities` field per row. The
 * response uses `l5Items` as the canonical key — older clients reading
 * `l4Items` should migrate; callers in this repo were updated as part of
 * the V5 cutover.
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     towerIntakeDigest?: string,   // optional; bounded digest from Tower AI Readiness Intake
 *     rows: [{
 *       rowId: string,
 *       l2: string,                  // V5: L2 Job Grouping
 *       l3: string,                  // V5: L3 Job Family
 *       l4?: string,                 // V5: L4 Activity Group — STRONGLY recommended;
 *                                    //     omitting it makes the LLM and the rubric
 *                                    //     misclassify L5 leaves (often as not-eligible).
 *       l5Activities?: string[],     // V5: L5 Activities to score
 *       l4Activities?: string[],     // legacy alias for `l5Activities`
 *     }, ...]
 *   }
 *
 * Returns:
 *   - JSON (default) when `Accept` does NOT include `application/x-ndjson`:
 *     {
 *       ok: true,
 *       source: "llm" | "fallback" | "mixed",
 *       rows: [{ rowId, l5Items: [{ name, ... }] }, ...],
 *       warning?: string
 *     }
 *
 *   - NDJSON stream when `Accept: application/x-ndjson` is sent:
 *     One JSON event per line. Event shape lives in
 *     `@/lib/assess/curateInitiativesStreamProtocol`. Events are:
 *       1. `{ kind: "started", totalRows, totalL5s }`
 *       2. `{ kind: "row", rowId, l5Items, source: "llm"|"fallback", warning? }` per row,
 *          emitted in COMPLETION order (NOT input order — UI keys by `rowId`).
 *       3. `{ kind: "done", source: "llm"|"fallback"|"mixed", warning? }` exactly once.
 *       Errors emit `{ kind: "error", code, message }` and end the stream.
 *
 * Behaviour:
 *   - Always returns a `rows` array of the same length as the input, in order
 *     (JSON mode) — or one `row` event per input row (stream mode).
 *   - Per-row fan-out: PR2 split the single batched LLM call into one call
 *     per L4 row (bounded concurrency 6). Per-row failures fall back to the
 *     deterministic `composeL4Verdict` rubric for THAT row only — a single
 *     row's LLM failure no longer collapses the whole tower.
 *   - Without `OPENAI_API_KEY`, the route runs the deterministic composer
 *     for every row and emits them as `source: "fallback"`.
 *   - Does NOT write `briefSlug` / `initiativeId` — those are overlay-only,
 *     stamped by the pipeline post-call so the LLM can't accidentally claim
 *     a hand-curated brief that doesn't exist.
 *   - Streaming mode never 500s mid-stream — fatal errors are encoded as
 *     `{ kind: "error" }` events so the client can render a friendly
 *     "Connection interrupted" instead of a hung spinner.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  curateInitiativesPerRowWithLLM,
  isLLMConfigured,
  MAX_L4S_PER_CALL,
  type CurateLLMItem,
  type CurateLLMRow,
  type CurateLLMRowInput,
  type CurateLLMRowOutcome,
} from "@/lib/assess/curateInitiativesLLM";
import { composeL4Verdict } from "@/lib/initiatives/composeVerdict";
import type { TowerId } from "@/data/assess/types";
import { TOWER_READINESS_MAX_DIGEST_CHARS } from "@/lib/assess/towerReadinessIntake";
import { resolveRowDescriptions } from "@/data/capabilityMap/descriptions";
import {
  CURATE_STREAM_CONTENT_TYPE,
  encodeStreamEvent,
  type CurateInitiativesStreamEvent,
  type CurateOverallSource,
  type CurateRowSource,
} from "@/lib/assess/curateInitiativesStreamProtocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 100;
const MAX_FEEDBACK_CHARS = 600;

type Body = {
  towerId?: unknown;
  rows?: unknown;
  towerIntakeDigest?: unknown;
};

/**
 * True when the client opted into the NDJSON stream via the `Accept`
 * header. Falls back to JSON when absent so older clients keep working.
 */
function wantsStream(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.toLowerCase().includes("application/x-ndjson");
}

export async function POST(req: Request) {
  const streaming = wantsStream(req);
  if (!(await isAuthed())) {
    return streaming
      ? streamErrorResponse("unauthorized", "Unauthorized", 401)
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return streaming
      ? streamErrorResponse("bad_request", "Invalid JSON body", 400)
      : NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const towerId = typeof body.towerId === "string" ? (body.towerId as TowerId) : null;
  if (!towerId) {
    return streaming
      ? streamErrorResponse("bad_request", "Missing towerId", 400)
      : NextResponse.json({ error: "Missing towerId" }, { status: 400 });
  }

  if (!Array.isArray(body.rows)) {
    return streaming
      ? streamErrorResponse("bad_request", "Missing rows[]", 400)
      : NextResponse.json({ error: "Missing rows[]" }, { status: 400 });
  }
  if (body.rows.length === 0) {
    if (streaming) {
      return streamEmpty();
    }
    return NextResponse.json(
      { ok: true, source: "fallback" as const, rows: [] },
      { status: 200 },
    );
  }
  if (body.rows.length > MAX_ROWS) {
    const msg = `Too many rows (${body.rows.length}); max ${MAX_ROWS} per request.`;
    return streaming
      ? streamErrorResponse("payload_too_large", msg, 413)
      : NextResponse.json({ error: msg }, { status: 413 });
  }

  const rows: CurateLLMRowInput[] = body.rows.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const rowId = typeof r.rowId === "string" ? r.rowId : "";
    const l2 = typeof r.l2 === "string" ? r.l2 : "";
    const l3 = typeof r.l3 === "string" ? r.l3 : "";
    // V5 L4 Activity Group — the dial-bearing parent of the L5 leaves.
    // Strongly recommended; if absent we let the LLM/rubric fall back to
    // using `l3` as the parent (legacy v4 caller path) which lowers
    // scoring fidelity but keeps the call valid.
    const l4Raw = typeof r.l4 === "string" ? r.l4.trim() : "";
    const l4 = l4Raw || undefined;
    // Accept both the new `l5Activities` (post-5-layer-migration) and the
    // legacy `l4Activities` payload key so older clients keep working
    // through the cutover. Prefer the new key when both are present.
    const rawActivities = Array.isArray(r.l5Activities)
      ? (r.l5Activities as unknown[])
      : Array.isArray(r.l4Activities)
        ? (r.l4Activities as unknown[])
        : [];
    const l5Activities = rawActivities
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim());
    const fbRaw = typeof r.feedback === "string" ? r.feedback.trim() : "";
    const feedback = fbRaw ? fbRaw.slice(0, MAX_FEEDBACK_CHARS) : undefined;
    // Resolve per-row L2/L3/L4 narrative context from the canonical
    // map. Towers without authored descriptions return an all-empty
    // bundle, which the LLM module's prompt builder skips entirely —
    // no behavior change for those towers.
    const desc = resolveRowDescriptions(towerId, l2, l3, l4);
    return {
      rowId,
      l2,
      l3,
      ...(l4 ? { l4 } : {}),
      l5Activities,
      ...(feedback ? { feedback } : {}),
      ...(desc.l2Description ? { l2Description: desc.l2Description } : {}),
      ...(desc.l3Description ? { l3Description: desc.l3Description } : {}),
      ...(desc.l4Description ? { l4Description: desc.l4Description } : {}),
    };
  });

  const badRow = rows.findIndex((r) => !r.rowId);
  if (badRow >= 0) {
    const msg = `rows[${badRow}].rowId missing`;
    return streaming
      ? streamErrorResponse("bad_request", msg, 400)
      : NextResponse.json({ error: msg }, { status: 400 });
  }
  const digestRaw =
    typeof body.towerIntakeDigest === "string" ? body.towerIntakeDigest.trim() : "";
  const towerIntakeDigest = digestRaw
    ? digestRaw.slice(0, TOWER_READINESS_MAX_DIGEST_CHARS)
    : undefined;

  const totalL5s = rows.reduce((s, r) => s + r.l5Activities.length, 0);
  if (totalL5s > MAX_L4S_PER_CALL) {
    const msg = `Tower has ${totalL5s} L5 Activities; max ${MAX_L4S_PER_CALL} per call. Split the request.`;
    return streaming
      ? streamErrorResponse("payload_too_large", msg, 413)
      : NextResponse.json({ error: msg }, { status: 413 });
  }

  if (streaming) {
    return runStreamingCuration(req, towerId, rows, towerIntakeDigest, totalL5s);
  }
  return runJsonCuration(towerId, rows, towerIntakeDigest);
}

// ===========================================================================
//   JSON path — back-compat for clients that don't opt into NDJSON.
//   Internally still uses the per-row fan-out + per-row deterministic
//   fallback, then collapses into a single JSON response.
// ===========================================================================

async function runJsonCuration(
  towerId: TowerId,
  rows: CurateLLMRowInput[],
  towerIntakeDigest: string | undefined,
): Promise<Response> {
  const llmConfigured = isLLMConfigured();
  let warning: string | undefined;
  let outcomes: CurateLLMRowOutcome[] = [];
  if (llmConfigured) {
    try {
      outcomes = await curateInitiativesPerRowWithLLM(towerId, rows, {
        towerIntakeDigest,
      });
    } catch (e) {
      warning =
        "AI curation unavailable; used deterministic verdict composer for every row. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
      outcomes = [];
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; used deterministic verdict composer for every row." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  let llmRowCount = 0;
  let fallbackRowCount = 0;
  const responseRows: (CurateLLMRow & { _source: CurateRowSource })[] = rows.map(
    (input) => {
      const outcome = outcomes.find((o) => o.rowId === input.rowId);
      if (outcome && outcome.ok) {
        llmRowCount += 1;
        return {
          rowId: input.rowId,
          l5Items: outcome.l5Items,
          _source: "llm",
        };
      }
      fallbackRowCount += 1;
      return {
        rowId: input.rowId,
        l5Items: composerFallbackForRow(towerId, input),
        _source: "fallback",
      };
    },
  );

  const overallSource: CurateOverallSource = computeOverallSource(
    llmRowCount,
    fallbackRowCount,
  );

  // Strip the internal `_source` flag before serialising — the JSON
  // response shape doesn't carry per-row provenance (the tower-level
  // `source` field already covers `mixed`). Streaming mode emits
  // per-row provenance via the NDJSON `row` event instead.
  const cleanRows: CurateLLMRow[] = responseRows.map((r) => ({
    rowId: r.rowId,
    l5Items: r.l5Items,
  }));
  return NextResponse.json(
    {
      ok: true,
      source: overallSource,
      rows: cleanRows,
      warning,
    },
    { status: 200 },
  );
}

// ===========================================================================
//   Streaming path — emits per-row events as they complete, ending with a
//   single `done` event. Per-row failures emit fallback rows immediately
//   instead of failing the stream.
// ===========================================================================

function runStreamingCuration(
  req: Request,
  towerId: TowerId,
  rows: CurateLLMRowInput[],
  towerIntakeDigest: string | undefined,
  totalL5s: number,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: CurateInitiativesStreamEvent) => {
        try {
          controller.enqueue(encodeStreamEvent(ev));
        } catch {
          // Client aborted; downstream writes will throw and we'll close.
        }
      };

      send({
        kind: "started",
        totalRows: rows.length,
        totalL5s,
      });

      let llmRowCount = 0;
      let fallbackRowCount = 0;
      let towerWarning: string | undefined;

      const llmConfigured = isLLMConfigured();
      if (!llmConfigured) {
        // No API key — emit every row as a deterministic fallback in
        // input order. We still emit per-row events (not one mega event)
        // so the UI hydrates progressively just like the LLM path.
        towerWarning =
          "OPENAI_API_KEY not set on this deployment; used deterministic verdict composer for every row." +
          ` [env=${describeRuntimeEnv()}]`;
        for (const input of rows) {
          if (req.signal.aborted) break;
          const fallback = composerFallbackForRow(towerId, input);
          fallbackRowCount += 1;
          send({
            kind: "row",
            rowId: input.rowId,
            l5Items: fallback,
            source: "fallback",
          });
        }
      } else {
        try {
          await curateInitiativesPerRowWithLLM(towerId, rows, {
            towerIntakeDigest,
            signal: req.signal,
            onRowComplete: (outcome) => {
              const input = rows.find((r) => r.rowId === outcome.rowId);
              if (!input) return;
              if (outcome.ok) {
                llmRowCount += 1;
                send({
                  kind: "row",
                  rowId: outcome.rowId,
                  l5Items: outcome.l5Items,
                  source: "llm",
                });
                return;
              }
              fallbackRowCount += 1;
              send({
                kind: "row",
                rowId: outcome.rowId,
                l5Items: composerFallbackForRow(towerId, input),
                source: "fallback",
                warning:
                  "AI curation failed for this row; used deterministic verdict composer. " +
                  outcome.error.slice(0, 240),
              });
            },
          });
        } catch (e) {
          // Catastrophic failure — emit a fallback for every row that
          // hasn't already been streamed. We track which rows were
          // already streamed via a Set so we don't double-emit.
          const message = e instanceof Error ? e.message : "Unknown LLM error";
          towerWarning =
            "AI curation orchestration failed mid-batch; used deterministic verdict composer for remaining rows. " +
            message +
            ` [env=${describeRuntimeEnv()}]`;
          // Heuristic: any row that didn't increment llm/fallback counts
          // hasn't been streamed yet. Walk the input rows and emit a
          // fallback for any whose count slot is still empty.
          const emittedTotal = llmRowCount + fallbackRowCount;
          if (emittedTotal < rows.length) {
            const remaining = rows.slice(emittedTotal);
            for (const input of remaining) {
              if (req.signal.aborted) break;
              const fallback = composerFallbackForRow(towerId, input);
              fallbackRowCount += 1;
              send({
                kind: "row",
                rowId: input.rowId,
                l5Items: fallback,
                source: "fallback",
              });
            }
          }
        }
      }

      send({
        kind: "done",
        source: computeOverallSource(llmRowCount, fallbackRowCount),
        warning: towerWarning,
      });
      try {
        controller.close();
      } catch {
        // already closed (client abort)
      }
    },
    cancel() {
      // Client aborted — `curateInitiativesPerRowWithLLM` honors
      // `req.signal` so in-flight OpenAI calls cancel. No state to
      // unwind here.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": CURATE_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      // Disables proxy buffering on Vercel/NGINX so events flush in
      // real time. Same setting the Ask Forge stream uses.
      "X-Accel-Buffering": "no",
    },
  });
}

// ===========================================================================
//   Helpers
// ===========================================================================

/**
 * Run the deterministic `composeL4Verdict` ladder for every L5 Activity
 * on a row. Used both as the per-row LLM failure fallback (streaming and
 * JSON) and as the no-API-key path. Mirrors the contract pre-PR2 — same
 * canonical/overlay/rubric ladder, same field shape — so the cache and
 * UI stay consistent regardless of which path produced the row.
 *
 * Layer mapping into the composer (which keeps V4-era parameter names):
 *   composer.l2Name  ←  row.l3   (V5 Job Family — the bucket signal)
 *   composer.l3Name  ←  row.l4   (V5 Activity Group — the row signal)
 *                                  Fallback: row.l3 when l4 is absent.
 *   composer.l4      ←  the L5 leaf being scored
 * Without this mapping the rubric collapses two layers and tags most
 * L5s as `pending-discovery` (aiEligible=false), which surfaces as
 * "all AI initiatives empty" in the UI after a regen.
 */
function composerFallbackForRow(
  towerId: TowerId,
  row: CurateLLMRowInput,
): CurateLLMItem[] {
  return row.l5Activities.map((name) => {
    const verdict = composeL4Verdict({
      towerId,
      l2Name: row.l3,
      l3Name: row.l4 ?? row.l3,
      l4: { id: synthId(row.rowId, name), name },
    });
    return {
      name,
      // Deterministic AI-initiative title from the composer (only set
      // for `curated` verdicts) — keeps the "what AI does" headline
      // working even on the fallback path.
      initiativeName: verdict.initiativeName,
      aiCurationStatus: verdict.status,
      aiEligible: verdict.aiEligible,
      // Pass through the binary feasibility computed in composeL4Verdict.
      // We deliberately do NOT echo the legacy `aiPriority` field — the
      // CuratedL4 schema dropped it; the back-compat map runs inside
      // composeL4Verdict so feasibility is already populated for every
      // canonical / overlay / rubric path.
      feasibility: verdict.feasibility,
      aiRationale: verdict.aiRationale,
      notEligibleReason: verdict.notEligibleReason,
      frequency: verdict.frequency,
      criticality: verdict.criticality,
      currentMaturity: verdict.currentMaturity,
      primaryVendor: verdict.primaryVendor,
      agentOneLine: verdict.agentOneLine,
    };
  });
}

function computeOverallSource(
  llmCount: number,
  fallbackCount: number,
): CurateOverallSource {
  if (llmCount > 0 && fallbackCount === 0) return "llm";
  if (llmCount === 0 && fallbackCount > 0) return "fallback";
  if (llmCount > 0 && fallbackCount > 0) return "mixed";
  // No rows produced at all (e.g. zero-input edge case) — report fallback.
  return "fallback";
}

/** Synthetic id used by `composeL4Verdict` when no canonical id exists. */
function synthId(rowId: string, l4Name: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${rowId}::${norm(l4Name)}`;
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

function describeRuntimeEnv(): string {
  const raw = process.env.OPENAI_API_KEY;
  const hasVar = typeof raw === "string";
  const keyLen = hasVar ? raw.trim().length : 0;
  const vercelEnv = process.env.VERCEL_ENV ?? "local";
  return `vercel=${vercelEnv}, hasVar=${hasVar}, keyLen=${keyLen}`;
}

/**
 * Build a single-event NDJSON stream that emits ONLY an `error` event,
 * then closes. Used for streaming-mode validation failures so the
 * client always sees a coherent stream rather than an HTTP error body.
 *
 * The HTTP status reflects the underlying error (401/400/413) so any
 * generic fetch error handlers still see the right code; the
 * `Content-Type` is the NDJSON one so the client's stream consumer
 * can parse the single error line and surface it as a typed event.
 */
function streamErrorResponse(
  code: "unauthorized" | "bad_request" | "payload_too_large" | "internal",
  message: string,
  status: number,
): Response {
  const ev: CurateInitiativesStreamEvent = { kind: "error", code, message };
  // Serialise as a plain string body — `Response` accepts strings
  // directly, and the NDJSON consumer only cares about the bytes on the
  // wire. Avoids a TS narrowing issue with `Uint8Array<ArrayBufferLike>`
  // vs `Uint8Array<ArrayBuffer>` in the lib.dom typings.
  const body = JSON.stringify(ev) + "\n";
  return new Response(body, {
    status,
    headers: {
      "Content-Type": CURATE_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * Stream-mode "no rows" terminator. Emits a `started` (totals = 0) +
 * `done` (source = fallback) so the client sees a complete, well-formed
 * stream and can run the same code path as the populated case.
 */
function streamEmpty(): Response {
  const events: CurateInitiativesStreamEvent[] = [
    { kind: "started", totalRows: 0, totalL5s: 0 },
    { kind: "done", source: "fallback" },
  ];
  const body = events.map((ev) => JSON.stringify(ev) + "\n").join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": CURATE_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
