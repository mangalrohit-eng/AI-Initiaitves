/**
 * Newline-delimited JSON event protocol for the Ask Forge streaming route.
 *
 * Format: each event is a single JSON object, terminated by `\n`.
 * Reader is forgiving — empty lines are skipped, malformed lines throw a
 * descriptive error so the client can surface "Connection interrupted".
 */

import type { AskStreamEvent } from "./types";

/** Encode one event as a UTF-8 byte chunk for `ReadableStream.enqueue`. */
export function encodeEvent(ev: AskStreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(ev) + "\n");
}

/**
 * Async iterator over a `Response.body` ReadableStream.
 * Yields one decoded event per yielded value. Any malformed line throws
 * — callers wrap in try/catch and emit a synthetic `error` event.
 */
export async function* decodeEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AskStreamEvent, void, void> {
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
        if (line) {
          yield parseLine(line);
        }
        nlIdx = buffer.indexOf("\n");
      }
    }

    // Flush trailing line if the server didn't end with a newline.
    const tail = buffer.trim();
    if (tail) yield parseLine(tail);
  } finally {
    reader.releaseLock();
  }
}

function parseLine(line: string): AskStreamEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (e) {
    throw new Error(`Ask stream: malformed event line — ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
    throw new Error("Ask stream: event missing `kind` field");
  }
  return parsed as AskStreamEvent;
}
