/**
 * Server-only OpenAI helper for Step-5 offshore-lane classification.
 *
 * Mirrors the inferDefaultsLLM pattern: single batched call (one request, N
 * row classifications back), Chat Completions JSON mode, hard timeout, throws
 * `LLMError` on any failure so the caller can substitute a deterministic
 * fallback. Caller is the `/api/offshore-plan/classify` route.
 */
import {
  PROMPT_VERSION,
  buildOffshoreSystemPrompt,
  buildOffshoreUserPrompt,
  type LLMOffshoreClassifyContext,
  type LLMOffshoreLane,
  type LLMOffshoreRowInput,
  type LLMOffshoreRowResult,
} from "@/lib/llm/prompts/offshorePlan.v1";

export type InferOffshoreLLMOptions = {
  /** Override (`OPENAI_OFFSHORE_PLAN_MODEL` then `OPENAI_MODEL`; default `gpt-4o-mini`). */
  model?: string;
  /** Abort timeout in ms per chunk (default 45_000). */
  timeoutMs?: number;
  /**
   * Rows per OpenAI call. We chunk + run in parallel to stay under the
   * Vercel function timeout AND keep individual prompts small enough that
   * the LLM responds in seconds, not minutes. Default 30 → ~5-6 parallel
   * calls for a 150-row Versant program.
   */
  chunkSize?: number;
  /**
   * Cap on parallel in-flight calls. Default 6 — high enough to amortize
   * latency for the typical Versant batch (~150 rows / 30 per chunk =
   * 5 chunks), low enough to avoid OpenAI rate limits.
   */
  maxConcurrency?: number;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_CHUNK_SIZE = 30;
const DEFAULT_MAX_CONCURRENCY = 6;
const VALID_LANES = new Set<LLMOffshoreLane>([
  "GccEligible",
  "GccWithOverlay",
  "OnshoreRetained",
]);

export class OffshoreLLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OffshoreLLMError";
  }
}

export function isOffshoreLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function resolveOffshoreModel(options: InferOffshoreLLMOptions = {}): string {
  return (
    options.model ??
    process.env.OPENAI_OFFSHORE_PLAN_MODEL?.trim() ??
    process.env.OPENAI_MODEL?.trim() ??
    DEFAULT_MODEL
  );
}

export type InferOffshoreClassifyResult = {
  rows: LLMOffshoreRowResult[];
  modelId: string;
  promptVersion: string;
  latencyMs: number;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
};

/**
 * Classify a batch of non-carved-out L3 rows. Carved-out rows must be
 * filtered out by the caller — this function does not know about strict
 * carve-outs. Returns lane + justification per row.
 *
 * Internally chunks the input into smaller batches and runs them in
 * parallel (bounded by `maxConcurrency`). Each chunk is its own OpenAI
 * call with its own timeout, so a single slow chunk doesn't block the
 * others. The whole call throws `OffshoreLLMError` on any failure (no
 * key, all-chunks failed, etc.); partial-chunk failures throw too —
 * the caller substitutes a deterministic heuristic fallback.
 */
export async function inferOffshoreClassifyWithLLM(
  rows: LLMOffshoreRowInput[],
  ctx: LLMOffshoreClassifyContext,
  options: InferOffshoreLLMOptions = {},
): Promise<InferOffshoreClassifyResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OffshoreLLMError("OPENAI_API_KEY not set");

  const model = resolveOffshoreModel(options);
  if (!rows.length) {
    return {
      rows: [],
      modelId: model,
      promptVersion: PROMPT_VERSION,
      latencyMs: 0,
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chunkSize = Math.max(
    1,
    Math.min(100, options.chunkSize ?? DEFAULT_CHUNK_SIZE),
  );
  const maxConcurrency = Math.max(
    1,
    Math.min(12, options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY),
  );

  const chunks: LLMOffshoreRowInput[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }

  const startedAt = Date.now();
  const out: LLMOffshoreRowResult[] = [];
  const tokens = { prompt: 0, completion: 0, total: 0 };

  // Bounded-concurrency pool. Walks chunks in order; each "lane" pulls
  // the next chunk index off the queue.
  let nextIndex = 0;
  const errors: { chunk: number; err: unknown }[] = [];
  const lanes = Array.from({ length: Math.min(maxConcurrency, chunks.length) }).map(
    async () => {
      while (true) {
        const idx = nextIndex++;
        if (idx >= chunks.length) return;
        const chunk = chunks[idx]!;
        try {
          const part = await callOpenAIChunk(chunk, ctx, {
            apiKey,
            model,
            timeoutMs,
          });
          out.push(...part.rows);
          if (part.tokenUsage) {
            tokens.prompt += part.tokenUsage.prompt ?? 0;
            tokens.completion += part.tokenUsage.completion ?? 0;
            tokens.total += part.tokenUsage.total ?? 0;
          }
        } catch (e) {
          errors.push({ chunk: idx, err: e });
        }
      }
    },
  );
  await Promise.all(lanes);

  if (errors.length > 0) {
    // Surface the first error with chunk context so the route's warning
    // message tells the operator which chunk failed first.
    const first = errors[0]!;
    const reason =
      first.err instanceof Error ? first.err.message : String(first.err);
    throw new OffshoreLLMError(
      `${errors.length}/${chunks.length} chunk(s) failed; first failure (chunk ${first.chunk}): ${reason}`,
      first.err,
    );
  }

  // Verify every requested row is accounted for. Order doesn't matter —
  // the caller maps by rowId.
  if (out.length !== rows.length) {
    throw new OffshoreLLMError(
      `Combined response length ${out.length} ≠ requested ${rows.length}`,
    );
  }
  const seen = new Set(out.map((r) => r.rowId));
  for (const r of rows) {
    if (!seen.has(r.rowId)) {
      throw new OffshoreLLMError(`Missing rowId in combined response: ${r.rowId}`);
    }
  }

  return {
    rows: out,
    modelId: model,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - startedAt,
    tokenUsage: tokens.total > 0 ? tokens : undefined,
  };
}

/**
 * Single-chunk OpenAI call. Each chunk is independent — its own timeout,
 * its own response, its own validation. Throws `OffshoreLLMError` on any
 * failure so the chunk-pool loop can record it.
 */
async function callOpenAIChunk(
  rows: LLMOffshoreRowInput[],
  ctx: LLMOffshoreClassifyContext,
  args: { apiKey: string; model: string; timeoutMs: number },
): Promise<{
  rows: LLMOffshoreRowResult[];
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildOffshoreSystemPrompt(ctx) },
          { role: "user", content: buildOffshoreUserPrompt(rows) },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string })?.name === "AbortError") {
      throw new OffshoreLLMError(
        `OpenAI call timed out after ${args.timeoutMs}ms`,
        e,
      );
    }
    throw new OffshoreLLMError("OpenAI network error", e);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OffshoreLLMError(
      `OpenAI ${res.status}: ${text.slice(0, 400) || res.statusText}`,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    throw new OffshoreLLMError("OpenAI returned non-JSON body", e);
  }
  const content =
    (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
      ?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new OffshoreLLMError("OpenAI returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new OffshoreLLMError("OpenAI content was not valid JSON", e);
  }
  const items = (parsed as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) {
    throw new OffshoreLLMError("OpenAI JSON missing `items` array");
  }
  if (items.length !== rows.length) {
    throw new OffshoreLLMError(
      `OpenAI returned ${items.length} items for ${rows.length} chunk rows`,
    );
  }

  const wantById = new Map(rows.map((r) => [r.rowId, r]));
  const seen = new Set<string>();
  const out: LLMOffshoreRowResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as Record<string, unknown> | undefined;
    if (!raw) {
      throw new OffshoreLLMError(`Chunk item ${i} is missing`);
    }
    const rowId =
      typeof raw.rowId === "string" && raw.rowId.trim() && wantById.has(raw.rowId)
        ? raw.rowId
        : rows[i]!.rowId;
    if (seen.has(rowId)) {
      throw new OffshoreLLMError(`Duplicate rowId in chunk response: ${rowId}`);
    }
    seen.add(rowId);
    const lane = String(raw.lane ?? "") as LLMOffshoreLane;
    if (!VALID_LANES.has(lane)) {
      throw new OffshoreLLMError(
        `Invalid lane "${raw.lane}" for rowId=${rowId}`,
      );
    }
    const justification =
      typeof raw.justification === "string" && raw.justification.trim()
        ? raw.justification.trim()
        : "";
    if (!justification) {
      throw new OffshoreLLMError(`Empty justification for rowId=${rowId}`);
    }
    out.push({ rowId, lane, justification });
  }

  const tokenUsage = (body as {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  })?.usage;
  return {
    rows: out,
    tokenUsage: tokenUsage
      ? {
          prompt: tokenUsage.prompt_tokens,
          completion: tokenUsage.completion_tokens,
          total: tokenUsage.total_tokens,
        }
      : undefined,
  };
}

/**
 * Heuristic fallback. Mirrors the selector's `classifyRow` heuristic so the
 * page renders something useful even when the LLM is unreachable. The
 * caller writes a generic justification per row.
 *
 * INVARIANT (matches selectOffshorePlan.classifyRow): the heuristic NEVER
 * returns EditorialCarveOut. The carve-out lane is reachable only via an
 * explicit user/seeded `offshoreStrictCarveOut` flag — which the route
 * filters out before this function is called. Tower defaults of
 * `EditorialCarveOut` are remapped to `OnshoreRetained` (still
 * conservative, but no longer pins editorial / production rows to zero
 * movable HC when the user has explicitly removed all carve-outs).
 */
export function buildOffshoreHeuristicFallback(
  rows: LLMOffshoreRowInput[],
  towerDefaults: Record<string, LLMOffshoreLane | "EditorialCarveOut">,
): LLMOffshoreRowResult[] {
  return rows.map((r) => {
    const rawDefault = towerDefaults[r.towerId] ?? "OnshoreRetained";
    const towerDefault: LLMOffshoreLane =
      rawDefault === "EditorialCarveOut"
        ? "OnshoreRetained"
        : (rawDefault as LLMOffshoreLane);
    const dial = r.dialPct ?? -1;
    let lane: LLMOffshoreLane;
    if (dial >= 50) lane = "GccEligible";
    else if (dial >= 25) lane = "GccWithOverlay";
    else if (dial >= 0 && dial < 15) lane = "OnshoreRetained";
    else lane = towerDefault;
    const justification = `Heuristic fallback — Step-2 dial ${dial >= 0 ? `${dial}%` : "unset"} mapped to ${lane}. Click Regenerate when LLM is available for a Versant-specific rationale.`;
    return { rowId: r.rowId, lane, justification };
  });
}
