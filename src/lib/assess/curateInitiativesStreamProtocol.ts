/**
 * Newline-delimited JSON event protocol for the Step 4 AI initiative
 * curation streaming endpoint (`/api/assess/curate-initiatives`).
 *
 * Format mirrors the Ask Forge stream (`@/lib/ask/streamProtocol`) — each
 * event is a single JSON object, terminated by `\n`. Empty lines are
 * skipped; malformed lines throw a descriptive error so the client can
 * surface "Connection interrupted" without wedging the UI.
 *
 * Why streaming: a tower's curation involves up to ~30 L4 Activity
 * Groups, each scored by one LLM call (post-PR2 fan-out). A lockstep
 * JSON response means the user stares at one spinner for ~30-90s. The
 * stream emits one `row` event per L4 as soon as it lands, so the
 * Step 4 view can re-render rows progressively and the user sees
 * meaningful motion within the first 5-10s.
 */

import type { CuratedL4 } from "@/lib/assess/assessClientApi";

/** Per-row source flag — propagated to the client so the Step 4 toolbar
 *  can show "n / m AI-curated · k fallback" while the stream is in flight. */
export type CurateRowSource = "llm" | "fallback";

/** Final source flag for the whole tower. `mixed` when at least one row
 *  fell back deterministically while at least one row succeeded via LLM. */
export type CurateOverallSource = "llm" | "fallback" | "mixed";

export type CurateInitiativesStreamEvent =
  | {
      kind: "started";
      /** Number of input rows the server is about to score. UI uses this
       *  to set up a progress bar and "n of m" countdown. */
      totalRows: number;
      /** Total L5 Activities about to be scored. Surfaced for telemetry. */
      totalL5s: number;
    }
  | {
      kind: "row";
      rowId: string;
      l5Items: CuratedL4[];
      /** "llm" when the row came from the OpenAI call; "fallback" when
       *  the deterministic composer ran (per-row failure or no API key). */
      source: CurateRowSource;
      /** Per-row warning string (truncated server-side) — set when the
       *  LLM call for this row failed and the composer ran instead, so
       *  the UI can flag "1 row used deterministic fallback". */
      warning?: string;
    }
  | {
      kind: "done";
      source: CurateOverallSource;
      /** Tower-level warning (e.g. "OPENAI_API_KEY not set") — distinct
       *  from per-row warnings; surfaces once at end of stream. */
      warning?: string;
    }
  | {
      kind: "error";
      /** Fatal error code — clients should stop reading after this event. */
      code:
        | "unauthorized"
        | "bad_request"
        | "payload_too_large"
        | "internal";
      message: string;
    };

/** Encode one event as a UTF-8 byte chunk for `ReadableStream.enqueue`. */
export function encodeStreamEvent(
  ev: CurateInitiativesStreamEvent,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(ev) + "\n");
}

/**
 * Async iterator over a `Response.body` ReadableStream. Yields one
 * decoded event per yielded value. Any malformed line throws —
 * callers wrap in try/catch and emit a synthetic `error` event so the
 * UI surfaces "Connection interrupted".
 */
export async function* decodeStreamEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<CurateInitiativesStreamEvent, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx = buffer.indexOf("\n");
      while (nlIdx !== -1) {
        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (line) yield parseLine(line);
        nlIdx = buffer.indexOf("\n");
      }
    }
    const tail = buffer.trim();
    if (tail) yield parseLine(tail);
  } finally {
    reader.releaseLock();
  }
}

function parseLine(line: string): CurateInitiativesStreamEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (e) {
    throw new Error(
      `Curate-initiatives stream: malformed event line — ${(e as Error).message}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
    throw new Error("Curate-initiatives stream: event missing `kind` field");
  }
  return parsed as CurateInitiativesStreamEvent;
}

/** MIME type the route emits and the client requests. */
export const CURATE_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";
