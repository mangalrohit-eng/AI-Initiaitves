/**
 * POST /api/assess/curate-l3-initiatives
 *
 * Curates 1-N specific AI Solution products for each L3 Job Family in a
 * tower under the v6 schema. One LLM call per L3 row (bounded
 * concurrency 4); per-row failures fall back to a deterministic stub.
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     towerIntakeDigest?: string,
 *     rows: [{
 *       rowId: string,                  // L3WorkforceRowV6.id
 *       l1: string,                     // Function name
 *       l2: string,                     // Job Grouping
 *       l3: string,                     // Job Family — the row being scored
 *       childL4s: [{                    // What's inside this L3
 *         id: string,                   // L4 row id (echoed back in coversL4RowIds)
 *         name: string,                 // L4 Activity Group name
 *         l5Activities: string[],       // L5 names under this L4
 *       }, ...],
 *       feedback?: string,              // Optional Refine + regenerate text
 *     }, ...]
 *   }
 *
 * Returns:
 *   - JSON (default) when `Accept` does NOT include `application/x-ndjson`:
 *     {
 *       ok: true,
 *       source: "llm" | "fallback" | "mixed",
 *       rows: [{ rowId, l3Initiatives: [{ id, solutionName, ... }] }, ...],
 *       warning?: string
 *     }
 *
 *   - NDJSON stream when `Accept: application/x-ndjson` is sent:
 *     One JSON event per line. Event shape lives in
 *     `@/lib/assess/curateL3InitiativesStreamProtocol`. Events are:
 *       1. `{ kind: "started", totalRows }`
 *       2. `{ kind: "row", rowId, l3Initiatives, source: "llm"|"fallback", warning? }`
 *          per row, emitted in COMPLETION order (NOT input order).
 *       3. `{ kind: "done", source: "llm"|"fallback"|"mixed", warning? }` exactly once.
 *       Errors emit `{ kind: "error", code, message }` and end the stream.
 *
 * Behaviour:
 *   - Without `OPENAI_API_KEY`, the route emits a deterministic
 *     `<l3> Co-Pilot` stub for every row as `source: "fallback"`.
 *   - Streaming mode never 500s mid-stream — fatal errors are encoded as
 *     `{ kind: "error" }` events so the client renders "Connection
 *     interrupted" instead of a hung spinner.
 *   - The orchestrator (`curationPipelineV6.ts`) is the only intended
 *     caller; the route accepts arbitrary clients but expects the
 *     pipeline's payload shape.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  buildL3InitiativeId,
  curateL3InitiativesPerRow,
  fallbackL3Initiatives,
  isLLMConfigured,
  type CurateL3LLMRowInput,
  type CurateL3LLMRowOutcome,
} from "@/lib/assess/curateL3InitiativesLLM";
import type { TowerId } from "@/data/assess/types";
import { TOWER_READINESS_MAX_DIGEST_CHARS } from "@/lib/assess/towerReadinessIntake";
import {
  CURATE_L3_STREAM_CONTENT_TYPE,
  encodeL3StreamEvent,
  type CurateL3InitiativePayload,
  type CurateL3InitiativesStreamEvent,
  type CurateL3OverallSource,
  type CurateL3RowSource,
} from "@/lib/assess/curateL3InitiativesStreamProtocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 50;
const MAX_CHILD_L4S_PER_ROW = 30;
const MAX_L5S_PER_L4 = 30;
const MAX_FEEDBACK_CHARS = 600;

type Body = {
  towerId?: unknown;
  rows?: unknown;
  towerIntakeDigest?: unknown;
};

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
    if (streaming) return streamEmpty();
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

  const rows: CurateL3LLMRowInput[] = body.rows.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const rowId = typeof r.rowId === "string" ? r.rowId : "";
    const l1 = typeof r.l1 === "string" ? r.l1 : "";
    const l2 = typeof r.l2 === "string" ? r.l2 : "";
    const l3 = typeof r.l3 === "string" ? r.l3 : "";
    const childL4sRaw = Array.isArray(r.childL4s) ? r.childL4s : [];
    const childL4s = (childL4sRaw as unknown[])
      .slice(0, MAX_CHILD_L4S_PER_ROW)
      .map((c) => {
        const cr = (c ?? {}) as Record<string, unknown>;
        return {
          id: typeof cr.id === "string" ? cr.id : "",
          name: typeof cr.name === "string" ? cr.name : "",
          l5Activities: Array.isArray(cr.l5Activities)
            ? (cr.l5Activities as unknown[])
                .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
                .slice(0, MAX_L5S_PER_L4)
                .map((s) => s.trim())
            : [],
        };
      })
      .filter((c) => c.id && c.name);
    const fbRaw = typeof r.feedback === "string" ? r.feedback.trim() : "";
    const feedback = fbRaw ? fbRaw.slice(0, MAX_FEEDBACK_CHARS) : undefined;
    return {
      rowId,
      l1,
      l2,
      l3,
      childL4s,
      ...(feedback ? { feedback } : {}),
    };
  });

  const badRow = rows.findIndex((r) => !r.rowId || !r.l3.trim());
  if (badRow >= 0) {
    const msg = `rows[${badRow}] missing rowId or l3`;
    return streaming
      ? streamErrorResponse("bad_request", msg, 400)
      : NextResponse.json({ error: msg }, { status: 400 });
  }

  const digestRaw =
    typeof body.towerIntakeDigest === "string" ? body.towerIntakeDigest.trim() : "";
  const towerIntakeDigest = digestRaw
    ? digestRaw.slice(0, TOWER_READINESS_MAX_DIGEST_CHARS)
    : undefined;

  if (streaming) {
    return runStreamingCuration(req, towerId, rows, towerIntakeDigest);
  }
  return runJsonCuration(towerId, rows, towerIntakeDigest);
}

// ===========================================================================
//   JSON path — back-compat for callers that don't opt into NDJSON.
// ===========================================================================

async function runJsonCuration(
  towerId: TowerId,
  rows: CurateL3LLMRowInput[],
  towerIntakeDigest: string | undefined,
): Promise<Response> {
  const llmConfigured = isLLMConfigured();
  let warning: string | undefined;
  let outcomes: CurateL3LLMRowOutcome[] = [];
  if (llmConfigured) {
    try {
      outcomes = await curateL3InitiativesPerRow(towerId, rows, {
        towerIntakeDigest,
      });
    } catch (e) {
      warning =
        "AI curation unavailable; used deterministic stub for every L3. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
      outcomes = [];
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; used deterministic stub for every L3." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  let llmRowCount = 0;
  let fallbackRowCount = 0;
  const responseRows = rows.map((input) => {
    const outcome = outcomes.find((o) => o.rowId === input.rowId);
    if (outcome && outcome.ok) {
      llmRowCount += 1;
      return {
        rowId: input.rowId,
        l3Initiatives: stampInitiativeIds(towerId, input.rowId, outcome.initiatives),
      };
    }
    fallbackRowCount += 1;
    return {
      rowId: input.rowId,
      l3Initiatives: fallbackL3Initiatives(towerId, {
        id: input.rowId,
        l3: input.l3,
        childL4RowIds: input.childL4s.map((c) => c.id),
      }),
    };
  });

  return NextResponse.json(
    {
      ok: true,
      source: computeOverallSource(llmRowCount, fallbackRowCount),
      rows: responseRows,
      warning,
    },
    { status: 200 },
  );
}

// ===========================================================================
//   Streaming path — emits per-row events as they complete.
// ===========================================================================

function runStreamingCuration(
  req: Request,
  towerId: TowerId,
  rows: CurateL3LLMRowInput[],
  towerIntakeDigest: string | undefined,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: CurateL3InitiativesStreamEvent) => {
        try {
          controller.enqueue(encodeL3StreamEvent(ev));
        } catch {
          // Client aborted; downstream writes will throw and we'll close.
        }
      };

      send({ kind: "started", totalRows: rows.length });

      let llmRowCount = 0;
      let fallbackRowCount = 0;
      let towerWarning: string | undefined;

      const llmConfigured = isLLMConfigured();
      if (!llmConfigured) {
        towerWarning =
          "OPENAI_API_KEY not set on this deployment; used deterministic stub for every L3." +
          ` [env=${describeRuntimeEnv()}]`;
        for (const input of rows) {
          if (req.signal.aborted) break;
          const fallback = fallbackL3Initiatives(towerId, {
            id: input.rowId,
            l3: input.l3,
            childL4RowIds: input.childL4s.map((c) => c.id),
          });
          fallbackRowCount += 1;
          send({
            kind: "row",
            rowId: input.rowId,
            l3Initiatives: fallback,
            source: "fallback",
          });
        }
      } else {
        try {
          await curateL3InitiativesPerRow(towerId, rows, {
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
                  l3Initiatives: stampInitiativeIds(
                    towerId,
                    outcome.rowId,
                    outcome.initiatives,
                  ),
                  source: "llm",
                });
                return;
              }
              fallbackRowCount += 1;
              send({
                kind: "row",
                rowId: outcome.rowId,
                l3Initiatives: fallbackL3Initiatives(towerId, {
                  id: input.rowId,
                  l3: input.l3,
                  childL4RowIds: input.childL4s.map((c) => c.id),
                }),
                source: "fallback",
                warning:
                  "AI curation failed for this L3; used deterministic stub. " +
                  outcome.error.slice(0, 240),
              });
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown LLM error";
          towerWarning =
            "AI curation orchestration failed mid-batch; used deterministic stub for remaining L3s. " +
            message +
            ` [env=${describeRuntimeEnv()}]`;
          // Heuristic: any row that hasn't been emitted yet falls back.
          const emittedIds = new Set<string>();
          // Re-walk rows; any whose id wasn't emitted gets a fallback.
          // We approximate by tracking llm + fallback counts; if their
          // sum is < rows.length, the tail rows are unemitted.
          const emittedCount = llmRowCount + fallbackRowCount;
          if (emittedCount < rows.length) {
            for (const input of rows) {
              if (req.signal.aborted) break;
              if (emittedIds.has(input.rowId)) continue;
              const fallback = fallbackL3Initiatives(towerId, {
                id: input.rowId,
                l3: input.l3,
                childL4RowIds: input.childL4s.map((c) => c.id),
              });
              fallbackRowCount += 1;
              send({
                kind: "row",
                rowId: input.rowId,
                l3Initiatives: fallback,
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
      // Client aborted — `curateL3InitiativesPerRow` honors `req.signal`
      // so in-flight OpenAI calls cancel. No state to unwind here.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": CURATE_L3_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

// ===========================================================================
//   Helpers
// ===========================================================================

/**
 * Re-derive each initiative's stable id with the explicit towerId. The
 * LLM module's parser uses an empty-tower-id placeholder because it
 * doesn't know which tower it's running in; the route stamps the
 * canonical id here so client and server agree on the wire format.
 */
function stampInitiativeIds(
  towerId: TowerId,
  rowId: string,
  payloads: CurateL3InitiativePayload[],
): CurateL3InitiativePayload[] {
  return payloads.map((p) => ({
    ...p,
    id: buildL3InitiativeId(towerId, rowId, p.solutionName),
  }));
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

function streamErrorResponse(
  code: "unauthorized" | "bad_request" | "payload_too_large" | "internal",
  message: string,
  status: number,
): Response {
  const ev: CurateL3InitiativesStreamEvent = { kind: "error", code, message };
  const body = JSON.stringify(ev) + "\n";
  return new Response(body, {
    status,
    headers: {
      "Content-Type": CURATE_L3_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function streamEmpty(): Response {
  const events: CurateL3InitiativesStreamEvent[] = [
    { kind: "started", totalRows: 0 },
    { kind: "done", source: "fallback" },
  ];
  const body = events.map((ev) => JSON.stringify(ev) + "\n").join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": CURATE_L3_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// Suppress unused suppression — `CurateL3RowSource` is exported only for
// downstream consumers; the route uses the literal "llm"/"fallback".
export type { CurateL3RowSource };
