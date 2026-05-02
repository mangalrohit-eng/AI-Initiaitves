/**
 * POST /api/ask
 *
 * Body:
 *   {
 *     messages: AskRequestMessage[],   // last N turns; current user prompt is the last entry
 *     programDigest: ProgramDigest,    // built client-side from getAssessProgram()
 *     clientMode: boolean              // true → modeled $ stripped from output
 *   }
 *
 * Response: a streaming `application/x-ndjson` body of `AskStreamEvent`
 * lines (one JSON object per `\n`-delimited line). See
 * `src/lib/ask/streamProtocol.ts` and `src/lib/ask/types.ts`.
 *
 * Behavior:
 *   - Auth: same `forge_session` cookie as other /api routes.
 *   - Stages emit immediately (`received`, `reading_workshop`, `cross_ref`,
 *     `compiling`, `drafting`) so the ThinkingIndicator never sits static.
 *   - Calls OpenAI via `generateAskAnswer`. On success, emits a single
 *     `blocks` event followed by `citations`, `followUps`, `meta`, `done`.
 *   - On any failure, emits a structured `error` event with a recoverable
 *     code (`rate_limit`, `api_key_missing`, etc.). The route always
 *     responds 200 — error info travels in the stream.
 */

import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import { encodeEvent } from "@/lib/ask/streamProtocol";
import {
  AskLLMError,
  generateAskAnswer,
  isAskLLMConfigured,
  resolveAskModel,
} from "@/lib/ask/askLLM";
import type {
  AskErrorCode,
  AskRequestBody,
  AskRequestMessage,
  AskStage,
  AskStreamEvent,
  ProgramDigest,
} from "@/lib/ask/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_MESSAGE_LEN = 4_000;
const MAX_MESSAGES = 12;

type Body = Partial<AskRequestBody>;

export async function POST(req: Request): Promise<Response> {
  if (!(await isAuthed())) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages must contain at least one entry" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (messages[messages.length - 1].role !== "user") {
    return new Response(
      JSON.stringify({ error: "the last message must be from the user" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const programDigest = sanitizeDigest(body.programDigest);
  if (!programDigest) {
    return new Response(JSON.stringify({ error: "programDigest is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const clientMode = body.clientMode === true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: AskStreamEvent) => {
        try {
          controller.enqueue(encodeEvent(ev));
        } catch {
          // Stream may have been closed by the client (abort) — ignore.
        }
      };
      const stagesTimer = startStageRotator(send);

      try {
        send({ kind: "stage", stage: "received", label: "Received question" });

        if (!isAskLLMConfigured()) {
          stagesTimer.stop();
          send({
            kind: "error",
            code: "api_key_missing",
            message:
              "OPENAI_API_KEY is not configured on this deployment. Ask Forge is read-only without it.",
          });
          send({ kind: "done" });
          controller.close();
          return;
        }

        const startedAt = Date.now();
        send({
          kind: "stage",
          stage: "reading_workshop",
          label: programDigest.hasWorkshopData
            ? `Reading ${programDigest.totals.l4RowCount.toLocaleString()} workshop rows…`
            : "Reading authored content (workshop empty)…",
        });

        // Tiny yield so the first stage events flush before the LLM call.
        await new Promise((r) => setTimeout(r, 30));

        send({
          kind: "stage",
          stage: "cross_ref",
          label: `Cross-referencing ${programDigest.totals.towerCount} tower briefs…`,
        });

        const result = await generateAskAnswer({
          messages,
          programDigest,
          clientMode,
          signal: req.signal,
        });

        stagesTimer.stop();

        send({ kind: "blocks", blocks: result.response.blocks });
        send({ kind: "citations", citations: result.response.citations });
        send({ kind: "followUps", followUps: result.response.followUps });
        send({
          kind: "meta",
          modelId: result.modelId,
          latencyMs: Date.now() - startedAt,
        });
        send({ kind: "done" });
        controller.close();
      } catch (err) {
        stagesTimer.stop();
        const code: AskErrorCode =
          err instanceof AskLLMError
            ? err.code
            : err instanceof Error && err.name === "AbortError"
              ? "timeout"
              : "unknown";
        const message =
          err instanceof Error ? err.message : "Unknown error generating answer";
        // Log metadata only — never the prompt/answer body.
        // eslint-disable-next-line no-console
        console.warn(
          `[forge.ask] error code=${code} model=${resolveAskModel()} message=${message.slice(0, 200)}`,
        );
        send({ kind: "error", code, message });
        send({ kind: "done" });
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // Client abort — `generateAskAnswer` honors `req.signal` so the OpenAI
      // call is cancelled. Nothing else to clean up here.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ===== helpers ===== */

function sanitizeMessages(raw: unknown): AskRequestMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AskRequestMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const mm = m as Record<string, unknown>;
    const role = mm.role;
    const content = typeof mm.content === "string" ? mm.content.trim() : "";
    if (!content) continue;
    if (content.length > MAX_MESSAGE_LEN) continue;
    if (role === "user" || role === "assistant") {
      out.push({ role, content });
    }
    if (out.length >= MAX_MESSAGES) break;
  }
  return out.length > 0 ? out : null;
}

function sanitizeDigest(raw: unknown): ProgramDigest | null {
  if (!raw || typeof raw !== "object") return null;
  // We trust the client-built digest's shape since it's pure data we
  // serialize back into the prompt — but we hard-cap a few sizes to keep
  // tokens bounded.
  const d = raw as Partial<ProgramDigest> & Record<string, unknown>;
  if (typeof d.hasWorkshopData !== "boolean") return null;
  if (!d.totals || typeof d.totals !== "object") return null;
  if (!Array.isArray(d.perTower)) return null;
  if (!d.topAggregates || typeof d.topAggregates !== "object") return null;
  if (typeof d.clientModeRedacted !== "boolean") return null;
  return d as ProgramDigest;
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

/**
 * Rotates a "drafting" stage label every ~1.2s while the LLM call is in
 * flight. Keeps the ThinkingIndicator alive without faking progress.
 */
function startStageRotator(send: (ev: AskStreamEvent) => void): { stop: () => void } {
  const labels: { stage: AskStage; label: string }[] = [
    { stage: "compiling", label: "Compiling rankings…" },
    { stage: "drafting", label: "Drafting answer…" },
    { stage: "drafting", label: "Resolving citations…" },
    { stage: "validating", label: "Validating output…" },
  ];
  let i = 0;
  const ms = 1_400;
  // First rotation kicks in after a short warmup so the early `stage` events
  // (received / reading_workshop / cross_ref) are visible.
  let active = true;
  const id = setInterval(() => {
    if (!active) return;
    const lbl = labels[i % labels.length];
    i++;
    send({ kind: "stage", stage: lbl.stage, label: lbl.label });
  }, ms);
  // Trigger the first compiling label after ~1s.
  const kickoffId = setTimeout(() => {
    if (!active) return;
    send({ kind: "stage", stage: "compiling", label: "Compiling rankings…" });
  }, 1_000);
  return {
    stop: () => {
      active = false;
      clearInterval(id);
      clearTimeout(kickoffId);
    },
  };
}
