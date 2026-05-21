/**
 * POST /api/assess/enrich-initiatives-from-upload
 *
 * Enriches a USER-SUPPLIED list of AI Solutions (uploaded via CSV/XLSX
 * in Step 4) into full `L3Initiative` card payloads. The LLM here does
 * NOT propose new solutions — it only polishes each user-supplied row:
 *
 *   - solutionName preserved verbatim (passthrough validator)
 *   - tagline + aiRationale generated in Versant voice
 *   - feasibility + iconKey + primaryVendor stamped
 *   - L3 auto-matched from the tower roster when the upload row had no L3
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     l3Roster: [{ rowId, l1, l2, l3, childL4Names?: string[] }, ...],
 *     uploads: [{
 *       uploadRowId: string,             // client-stable id for stream reconciliation
 *       solutionName: string,            // required
 *       solutionDescription: string,     // required
 *       tech?: string,                   // optional — user-supplied vendor
 *       preMatchedL3RowId?: string,      // optional — when client matched by name
 *       l3Hint?: string,                 // optional — raw L3 cell when no exact match
 *     }, ...],
 *     towerIntakeDigest?: string,
 *     intakeFields?, intakeImportedAt?,  // for the post-LLM intakeStatus validator
 *   }
 *
 * Returns:
 *   - JSON (default) when `Accept` does NOT include `application/x-ndjson`.
 *   - NDJSON stream when `Accept: application/x-ndjson` is sent.
 *
 * Always falls back to a deterministic passthrough payload per row when
 * the LLM is unavailable or a per-row call fails — the user's text
 * survives verbatim and the gallery card never goes blank.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  enrichUploadedInitiativesPerRow,
  fallbackEnrichedInitiative,
  isLLMConfigured,
  type EnrichUploadRowInput,
  type L3RosterEntry,
} from "@/lib/assess/enrichUploadedInitiativesLLM";
import { buildL3InitiativeId } from "@/lib/assess/curateL3InitiativesLLM";
import type { IntakeContextForValidator } from "@/lib/assess/curateL3InitiativesLLM";
import type { TowerId } from "@/data/assess/types";
import {
  TOWER_READINESS_MAX_DIGEST_CHARS,
  TOWER_READINESS_MAX_FIELD_CHARS,
} from "@/lib/assess/towerReadinessIntake";
import {
  encodeEnrichUploadStreamEvent,
  ENRICH_UPLOAD_STREAM_CONTENT_TYPE,
  type CurateL3InitiativePayload,
  type CurateL3OverallSource,
  type EnrichUploadStreamEvent,
} from "@/lib/assess/curateL3InitiativesStreamProtocol";
import { buildPendingFallbackRows } from "@/lib/assess/enrichUploadFallbackDrain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOADS_PER_REQUEST = 50;
const MAX_ROSTER_ENTRIES = 200;
const MAX_NAME_CHARS = 240;
const MAX_DESCRIPTION_CHARS = 1200;
const MAX_TECH_CHARS = 80;
const MAX_HINT_CHARS = 200;
const MAX_CHILD_L4_NAMES_PER_ROSTER = 10;

type Body = {
  towerId?: unknown;
  uploads?: unknown;
  l3Roster?: unknown;
  towerIntakeDigest?: unknown;
  intakeFields?: unknown;
  intakeImportedAt?: unknown;
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

  const towerId =
    typeof body.towerId === "string" ? (body.towerId as TowerId) : null;
  if (!towerId) {
    return streaming
      ? streamErrorResponse("bad_request", "Missing towerId", 400)
      : NextResponse.json({ error: "Missing towerId" }, { status: 400 });
  }

  if (!Array.isArray(body.uploads)) {
    return streaming
      ? streamErrorResponse("bad_request", "Missing uploads[]", 400)
      : NextResponse.json({ error: "Missing uploads[]" }, { status: 400 });
  }
  if (body.uploads.length === 0) {
    if (streaming) return streamEmpty();
    return NextResponse.json(
      { ok: true, source: "fallback" as const, rows: [] },
      { status: 200 },
    );
  }
  if (body.uploads.length > MAX_UPLOADS_PER_REQUEST) {
    const msg = `Too many uploads (${body.uploads.length}); max ${MAX_UPLOADS_PER_REQUEST} per request.`;
    return streaming
      ? streamErrorResponse("payload_too_large", msg, 413)
      : NextResponse.json({ error: msg }, { status: 413 });
  }

  const l3Roster = parseRoster(body.l3Roster);
  if (l3Roster.length === 0) {
    const msg = "Missing l3Roster[] — at least one L3 row is required to attach uploads.";
    return streaming
      ? streamErrorResponse("bad_request", msg, 400)
      : NextResponse.json({ error: msg }, { status: 400 });
  }

  const uploads = parseUploads(body.uploads);
  const badIdx = uploads.findIndex(
    (u) => !u.uploadRowId.trim() || !u.solutionName.trim(),
  );
  if (badIdx >= 0) {
    const msg = `uploads[${badIdx}] missing uploadRowId or solutionName`;
    return streaming
      ? streamErrorResponse("bad_request", msg, 400)
      : NextResponse.json({ error: msg }, { status: 400 });
  }

  const digestRaw =
    typeof body.towerIntakeDigest === "string"
      ? body.towerIntakeDigest.trim()
      : "";
  const towerIntakeDigest = digestRaw
    ? digestRaw.slice(0, TOWER_READINESS_MAX_DIGEST_CHARS)
    : undefined;
  const intakeContext = parseIntakeContext(body.intakeFields, body.intakeImportedAt);

  if (streaming) {
    return runStreamingEnrichment(
      req,
      towerId,
      uploads,
      l3Roster,
      towerIntakeDigest,
      intakeContext,
    );
  }
  return runJsonEnrichment(
    towerId,
    uploads,
    l3Roster,
    towerIntakeDigest,
    intakeContext,
  );
}

// ===========================================================================
//   Input coercion
// ===========================================================================

function parseRoster(raw: unknown): L3RosterEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .slice(0, MAX_ROSTER_ENTRIES)
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const childRaw = Array.isArray(o.childL4Names) ? o.childL4Names : [];
      return {
        rowId: typeof o.rowId === "string" ? o.rowId.trim() : "",
        l1: typeof o.l1 === "string" ? o.l1.trim().slice(0, 120) : "",
        l2: typeof o.l2 === "string" ? o.l2.trim().slice(0, 200) : "",
        l3: typeof o.l3 === "string" ? o.l3.trim().slice(0, 200) : "",
        childL4Names: (childRaw as unknown[])
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, MAX_CHILD_L4_NAMES_PER_ROSTER)
          .map((s) => s.trim().slice(0, 160)),
      };
    })
    .filter((r) => r.rowId.length > 0 && r.l3.length > 0);
}

function parseUploads(raw: unknown[]): EnrichUploadRowInput[] {
  return raw.map((u) => {
    const o = (u ?? {}) as Record<string, unknown>;
    return {
      uploadRowId:
        typeof o.uploadRowId === "string" ? o.uploadRowId.trim() : "",
      solutionName:
        typeof o.solutionName === "string"
          ? o.solutionName.trim().slice(0, MAX_NAME_CHARS)
          : "",
      solutionDescription:
        typeof o.solutionDescription === "string"
          ? o.solutionDescription.trim().slice(0, MAX_DESCRIPTION_CHARS)
          : "",
      tech:
        typeof o.tech === "string"
          ? o.tech.trim().slice(0, MAX_TECH_CHARS)
          : "",
      preMatchedL3RowId:
        typeof o.preMatchedL3RowId === "string" && o.preMatchedL3RowId.trim()
          ? o.preMatchedL3RowId.trim()
          : undefined,
      l3Hint:
        typeof o.l3Hint === "string" && o.l3Hint.trim()
          ? o.l3Hint.trim().slice(0, MAX_HINT_CHARS)
          : undefined,
    };
  });
}

function parseIntakeContext(
  rawFields: unknown,
  rawImportedAt: unknown,
): IntakeContextForValidator | undefined {
  if (!rawFields || typeof rawFields !== "object") return undefined;
  const importedAt =
    typeof rawImportedAt === "string" && rawImportedAt.trim()
      ? rawImportedAt.trim()
      : "";
  if (!importedAt) return undefined;
  const f = rawFields as Record<string, unknown>;
  const cap = (raw: unknown): string => {
    if (typeof raw !== "string") return "";
    const t = raw.trim();
    return t.length > TOWER_READINESS_MAX_FIELD_CHARS
      ? t.slice(0, TOWER_READINESS_MAX_FIELD_CHARS)
      : t;
  };
  const currentAiTools = cap(f.currentAiTools);
  const experimentsLearnings = cap(f.experimentsLearnings);
  const readyNow = cap(f.readyNow);
  const noGoAreas = cap(f.noGoAreas);
  if (!currentAiTools && !experimentsLearnings && !readyNow && !noGoAreas) {
    return undefined;
  }
  return {
    fields: { currentAiTools, experimentsLearnings, readyNow, noGoAreas },
    importedAt,
  };
}

// ===========================================================================
//   JSON path
// ===========================================================================

async function runJsonEnrichment(
  towerId: TowerId,
  uploads: EnrichUploadRowInput[],
  roster: L3RosterEntry[],
  towerIntakeDigest: string | undefined,
  intake: IntakeContextForValidator | undefined,
): Promise<Response> {
  const llmConfigured = isLLMConfigured();
  let warning: string | undefined;
  let llmRowCount = 0;
  let fallbackRowCount = 0;

  const responseRows: Array<{
    uploadRowId: string;
    matchedRowId: string;
    l3MatchRationale?: string;
    payload: CurateL3InitiativePayload;
    source: "llm" | "fallback";
  }> = [];

  if (llmConfigured) {
    try {
      const outcomes = await enrichUploadedInitiativesPerRow(
        towerId,
        uploads,
        roster,
        { towerIntakeDigest, intake },
      );
      for (const input of uploads) {
        const outcome = outcomes.find((o) => o.uploadRowId === input.uploadRowId);
        if (outcome && outcome.ok) {
          llmRowCount += 1;
          responseRows.push({
            uploadRowId: outcome.uploadRowId,
            matchedRowId: outcome.matchedRowId,
            ...(outcome.l3MatchRationale
              ? { l3MatchRationale: outcome.l3MatchRationale }
              : {}),
            payload: stampInitiativeId(
              towerId,
              outcome.matchedRowId,
              outcome.payload,
            ),
            source: "llm",
          });
        } else {
          fallbackRowCount += 1;
          responseRows.push(buildFallbackRow(towerId, input, roster));
        }
      }
    } catch (e) {
      warning =
        "AI enrichment unavailable; user-supplied text passed through verbatim for every row. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
      for (const input of uploads) {
        fallbackRowCount += 1;
        responseRows.push(buildFallbackRow(towerId, input, roster));
      }
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; user-supplied text passed through verbatim for every row." +
      ` [env=${describeRuntimeEnv()}]`;
    for (const input of uploads) {
      fallbackRowCount += 1;
      responseRows.push(buildFallbackRow(towerId, input, roster));
    }
  }

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
//   Streaming path
// ===========================================================================

function runStreamingEnrichment(
  req: Request,
  towerId: TowerId,
  uploads: EnrichUploadRowInput[],
  roster: L3RosterEntry[],
  towerIntakeDigest: string | undefined,
  intake: IntakeContextForValidator | undefined,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: EnrichUploadStreamEvent) => {
        try {
          controller.enqueue(encodeEnrichUploadStreamEvent(ev));
        } catch {
          // Client aborted; downstream writes will throw and we'll close.
        }
      };

      send({ kind: "started", totalUploads: uploads.length });

      // Belt-and-suspenders accounting: every row event emitted to the
      // client is also tracked by `uploadRowId`. After the LLM step
      // returns — whether it resolved, threw, or exited silently because
      // the request signal aborted mid-batch — we drain any input rows
      // whose id never made it onto the wire, emitting deterministic
      // fallback rows for them. This is the single safety net that
      // prevents server-side silent drops (was: a positional
      // `uploads.slice(emittedCount)` in the catch block that re-emitted
      // the LAST N inputs regardless of which ones actually emitted —
      // wrong with bounded-concurrency out-of-order completion).
      const emittedRowIds = new Set<string>();
      const sendRowEvent = (
        ev: EnrichUploadStreamEvent & { kind: "row" },
      ): void => {
        send(ev);
        emittedRowIds.add(ev.uploadRowId);
      };

      let llmRowCount = 0;
      let fallbackRowCount = 0;
      let towerWarning: string | undefined;

      const llmConfigured = isLLMConfigured();
      if (!llmConfigured) {
        towerWarning =
          "OPENAI_API_KEY not set on this deployment; user-supplied text passed through verbatim for every row." +
          ` [env=${describeRuntimeEnv()}]`;
        for (const input of uploads) {
          if (req.signal.aborted) break;
          const row = buildFallbackRow(towerId, input, roster);
          fallbackRowCount += 1;
          sendRowEvent({
            kind: "row",
            uploadRowId: row.uploadRowId,
            matchedRowId: row.matchedRowId,
            payload: row.payload,
            source: "fallback",
          });
        }
      } else {
        try {
          await enrichUploadedInitiativesPerRow(towerId, uploads, roster, {
            towerIntakeDigest,
            intake,
            signal: req.signal,
            onRowComplete: (outcome) => {
              const input = uploads.find(
                (u) => u.uploadRowId === outcome.uploadRowId,
              );
              if (!input) return;
              if (outcome.ok) {
                llmRowCount += 1;
                sendRowEvent({
                  kind: "row",
                  uploadRowId: outcome.uploadRowId,
                  matchedRowId: outcome.matchedRowId,
                  ...(outcome.l3MatchRationale
                    ? { l3MatchRationale: outcome.l3MatchRationale }
                    : {}),
                  payload: stampInitiativeId(
                    towerId,
                    outcome.matchedRowId,
                    outcome.payload,
                  ),
                  source: "llm",
                });
                return;
              }
              fallbackRowCount += 1;
              const fb = buildFallbackRow(towerId, input, roster);
              sendRowEvent({
                kind: "row",
                uploadRowId: fb.uploadRowId,
                matchedRowId: fb.matchedRowId,
                payload: fb.payload,
                source: "fallback",
                warning:
                  "LLM enrichment failed for this row; user-supplied text passed through. " +
                  outcome.error.slice(0, 240),
              });
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown LLM error";
          towerWarning =
            "Enrichment orchestration failed mid-batch; user-supplied text passed through for remaining rows. " +
            message +
            ` [env=${describeRuntimeEnv()}]`;
          // No positional slice here — the post-await drain below uses
          // the by-uploadRowId set difference, which is correct for
          // bounded-concurrency out-of-order completion.
        }
      }

      // Drain any uploads whose row event never went out. Covers:
      //   - LLM function threw mid-batch (catch above set towerWarning,
      //     but already-pending workers may have left rows unemitted in
      //     non-positional gaps).
      //   - LLM function returned cleanly after `signal.aborted` flipped
      //     to true mid-loop and workers exited silently without
      //     claiming the remaining indices (the silent-drop path that
      //     the previous catch-only handler couldn't see).
      //   - Any future per-row exception path in `onRowComplete` that
      //     might short-circuit before the row event ships.
      if (!req.signal.aborted) {
        const pending = buildPendingFallbackRows(
          towerId,
          uploads,
          roster,
          emittedRowIds,
        );
        for (const fb of pending) {
          if (req.signal.aborted) break;
          fallbackRowCount += 1;
          sendRowEvent({
            kind: "row",
            uploadRowId: fb.uploadRowId,
            matchedRowId: fb.matchedRowId,
            payload: fb.payload,
            source: "fallback",
            warning:
              "LLM enrichment did not emit this row; user-supplied text passed through verbatim.",
          });
        }
        if (pending.length > 0 && !towerWarning) {
          // Record the silent-drop drain in the done event so the client
          // (and any future log-scraper) sees "we patched N missing rows".
          towerWarning =
            `LLM enrichment exited without emitting ${pending.length} row(s); ` +
            "user-supplied text passed through verbatim for the missing rows.";
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
      // Client aborted — `enrichUploadedInitiativesPerRow` honors req.signal.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": ENRICH_UPLOAD_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

// ===========================================================================
//   Helpers
// ===========================================================================

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

function buildFallbackRow(
  towerId: TowerId,
  input: EnrichUploadRowInput,
  roster: L3RosterEntry[],
): {
  uploadRowId: string;
  matchedRowId: string;
  payload: CurateL3InitiativePayload;
  source: "fallback";
} {
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
  const ev: EnrichUploadStreamEvent = { kind: "error", code, message };
  const body = JSON.stringify(ev) + "\n";
  return new Response(body, {
    status,
    headers: {
      "Content-Type": ENRICH_UPLOAD_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function streamEmpty(): Response {
  const events: EnrichUploadStreamEvent[] = [
    { kind: "started", totalUploads: 0 },
    { kind: "done", source: "fallback" },
  ];
  const body = events.map((ev) => JSON.stringify(ev) + "\n").join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": ENRICH_UPLOAD_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
