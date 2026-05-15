/**
 * Server-only OpenAI helper for Step 2 offshore `gccPct` classification.
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
  type LLMOffshoreRowInput,
  type LLMOffshoreRowResult,
} from "@/lib/llm/prompts/offshorePlan.v1";
import {
  VERSANT_DEFAULT_REASONING_EFFORT,
  VersantLLMError,
  buildLLMRequest,
  isLLMConfigured as kitIsLLMConfigured,
  resolveModelId as kitResolveModelId,
} from "@/lib/llm/prompts/versantPromptKit";

export type InferOffshoreLLMOptions = {
  /**
   * Test-only model override. Production callers should let the kit resolve
   * the model from `OPENAI_MODEL` (or the default `gpt-5.5`).
   */
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

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_CHUNK_SIZE = 30;
const DEFAULT_MAX_CONCURRENCY = 6;
const MAX_REASON_CHARS = 200;

export class OffshoreLLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OffshoreLLMError";
  }
}

export function isOffshoreLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

export function resolveOffshoreModel(options: InferOffshoreLLMOptions = {}): string {
  return kitResolveModelId(options.model);
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
  if (!kitIsLLMConfigured()) {
    throw new OffshoreLLMError("OPENAI_API_KEY not set");
  }

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
            model: options.model,
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
 * Single-chunk OpenAI call. Routes through `versantPromptKit.buildLLMRequest`
 * so model selection, Chat-vs-Responses-API choice, JSON-mode, abort
 * propagation, and timeout all share the kit's implementation. Each chunk
 * is independent — its own timeout, its own response, its own validation.
 * Throws `OffshoreLLMError` on any failure so the chunk-pool loop can
 * record it.
 */
async function callOpenAIChunk(
  rows: LLMOffshoreRowInput[],
  ctx: LLMOffshoreClassifyContext,
  args: { model?: string; timeoutMs: number },
): Promise<{
  rows: LLMOffshoreRowResult[];
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
}> {
  let parsed: unknown;
  let tokenUsage:
    | { prompt?: number; completion?: number; total?: number }
    | undefined;
  try {
    const result = await buildLLMRequest({
      systemPrompt: buildOffshoreSystemPrompt(ctx),
      userPrompt: buildOffshoreUserPrompt(rows),
      model: args.model,
      reasoningEffort: VERSANT_DEFAULT_REASONING_EFFORT,
      timeoutMs: args.timeoutMs,
    });
    parsed = result.parsed;
    tokenUsage = result.tokenUsage;
  } catch (e) {
    if (e instanceof VersantLLMError) {
      throw new OffshoreLLMError(e.message, e);
    }
    throw new OffshoreLLMError(
      e instanceof Error ? e.message : "OpenAI call failed",
      e,
    );
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
    const rawPct = raw.gccPct;
    const pct =
      typeof rawPct === "number" && Number.isFinite(rawPct)
        ? Math.round(rawPct)
        : null;
    if (pct == null || pct < 0 || pct > 100) {
      throw new OffshoreLLMError(
        `Invalid gccPct "${raw.gccPct}" for rowId=${rowId}; must be integer 0-100`,
      );
    }
    const reasonRaw =
      typeof raw.reason === "string" && raw.reason.trim()
        ? raw.reason.trim()
        : "";
    if (!reasonRaw) {
      throw new OffshoreLLMError(`Empty reason for rowId=${rowId}`);
    }
    const reason = reasonRaw.slice(0, MAX_REASON_CHARS);
    out.push({ rowId, gccPct: pct, reason });
  }

  return { rows: out, tokenUsage };
}

/**
 * Heuristic fallback. Used when the LLM is unreachable so the page always
 * renders. Maps the tower-level default `gccPct` (caller-supplied) onto
 * every row, then nudges by the row's existing dial when the lead has
 * already expressed an offshore intent. The reason text is generic and
 * marks the row as awaiting LLM regeneration.
 */
export function buildOffshoreHeuristicFallback(
  rows: LLMOffshoreRowInput[],
  towerDefaults: Record<string, number>,
): LLMOffshoreRowResult[] {
  return rows.map((r) => {
    const towerDefault = clampPct(towerDefaults[r.towerId] ?? 0);
    const priorDial = r.dialPct;
    const gccPct =
      typeof priorDial === "number" && Number.isFinite(priorDial)
        ? clampPct(priorDial)
        : towerDefault;
    const reason = `Heuristic fallback — applied tower default ${towerDefault}% (dial ${priorDial ?? "unset"}%). Click Regenerate when the LLM is available for a Versant-specific rationale.`;
    return { rowId: r.rowId, gccPct, reason };
  });
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}
