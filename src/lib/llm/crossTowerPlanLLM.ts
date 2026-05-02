/**
 * Cross-Tower AI Plan — server-only OpenAI call + strict output validation.
 *
 * Mirrors the structure of `lib/assess/curateInitiativesLLM.ts`:
 *   - Chat Completions JSON mode (`response_format: { type: "json_object" }`).
 *   - AbortController-based timeout.
 *   - All env reads are server-only; never exported to the client.
 *   - Provider-agnostic against any OpenAI-compatible API. `OPENAI_BASE_URL`
 *     overrides the default endpoint when set (Azure / proxy use cases).
 *
 * Determinism enforcement runs server-side after the model responds:
 *   - String fields are scanned for `$`, `%`, or digit clusters of length ≥2.
 *     Violations cause rejection; the route handler may issue ONE structured
 *     repair retry before falling through to deterministic-only mode.
 *   - `initiativeId` / `riskId` references are checked against the input
 *     allow-lists. Hallucinated ids cause rejection.
 *   - Phase membership is locked: the LLM cannot move an initiative across
 *     P1/P2/P3 — it can only rank within the deterministic phase.
 */

import {
  buildSystemPrompt,
  buildUserPrompt,
  PROMPT_VERSION,
  PROGRAM_RISK_CATALOG,
  type BuildPromptInput,
  type CrossTowerAiPlanLLM,
  type LLMArchitectureNarrative,
  type LLMKeyInitiative,
  type LLMRiskMitigation,
  type LLMRoadmapPhase,
  type LLMRoadmapPhases,
} from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import { resolveOpenAiBaseUrl } from "@/lib/llm/openaiBase";
import type { Tier } from "@/lib/priority";

const DEFAULT_MODEL = "gpt-5.5";
// GPT-5 family Responses API calls with reasoning effort can take 60-90s
// for a constrained-schema task this size. Match the curate-brief default.
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_TEMPERATURE = 0.2;
// Reasoning models charge reasoning tokens against the output budget. 12k
// leaves headroom for ~3-4k visible JSON output even at "medium" effort.
const DEFAULT_MAX_TOKENS = 12_000;
// Default reasoning effort. The cross-tower plan is constrained-schema
// authorship, not deep research — "low" produces high-quality output in
// roughly half the wall time of "medium".
const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

export class CrossTowerPlanLLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retriable = false,
  ) {
    super(message);
    this.name = "CrossTowerPlanLLMError";
  }
}

export type CrossTowerPlanLLMOptions = {
  /** Model id override (request-scoped). */
  model?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Hard timeout for the network call. */
  timeoutMs?: number;
  /** Output token budget. */
  maxOutputTokens?: number;
  /**
   * Optional repair instructions. When set, the call is treated as a
   * structured-repair retry — the system prompt is unchanged but the user
   * prompt prepends the repair guidance + previous output for the model to
   * fix.
   */
  repair?: { previousOutput: string; reasons: string[] };
};

export type CrossTowerPlanLLMResult = {
  plan: CrossTowerAiPlanLLM;
  modelId: string;
  promptVersion: string;
  latencyMs: number;
  /** OpenAI usage block when present. */
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
};

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Resolve the model id. Order: option override → env → DEFAULT_MODEL. */
export function resolveModelId(override?: string): string {
  return (
    override?.trim() ||
    process.env.CROSS_TOWER_PLAN_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function resolveTemperature(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override)) return override;
  const env = process.env.CROSS_TOWER_PLAN_TEMPERATURE?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n)) return n;
  }
  return DEFAULT_TEMPERATURE;
}

function resolveTimeoutMs(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override)) return override;
  const env = process.env.CROSS_TOWER_PLAN_TIMEOUT_MS?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_TIMEOUT_MS;
}

function resolveMaxTokens(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override)) return override;
  const env = process.env.CROSS_TOWER_PLAN_MAX_TOKENS?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_MAX_TOKENS;
}

/**
 * GPT-5 family detection. The Responses API is the supported surface for
 * GPT-5/5.5 and uses `max_output_tokens` + `reasoning.effort`; Chat
 * Completions on these models rejects `max_tokens` and `temperature`.
 *
 * Mirrors the precedent in `lib/assess/curateBriefProcessLLM.ts`. Set
 * `CROSS_TOWER_PLAN_USE_CHAT_COMPLETIONS=1` to override (debugging only).
 */
function shouldUseResponsesApi(model: string): boolean {
  if (process.env.CROSS_TOWER_PLAN_USE_CHAT_COMPLETIONS === "1") return false;
  const m = model.toLowerCase();
  return m.startsWith("gpt-5") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4");
}

type ReasoningEffort = "minimal" | "low" | "medium" | "high";

function resolveReasoningEffort(): ReasoningEffort {
  const raw = process.env.CROSS_TOWER_PLAN_REASONING_EFFORT?.trim().toLowerCase();
  if (raw === "minimal" || raw === "low" || raw === "medium" || raw === "high") {
    return raw;
  }
  return DEFAULT_REASONING_EFFORT;
}

/**
 * Pull the textual JSON content out of a Responses API body.
 * Tolerates both the convenience `output_text` field and the structured
 * `output[].content[]` array.
 */
function extractResponsesOutputText(body: unknown): string | null {
  const b = body as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (typeof b.output_text === "string" && b.output_text.trim()) {
    return b.output_text;
  }
  for (const item of b.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }
  return null;
}

/**
 * Build the cross-tower plan via OpenAI. Throws `CrossTowerPlanLLMError` on
 * any failure — caller owns the deterministic fallback contract.
 *
 * Branches by model family:
 *   - GPT-5 family (default `gpt-5.5`) → Responses API, `reasoning.effort`,
 *     `max_output_tokens`, no `temperature`.
 *   - Other models → Chat Completions, `max_completion_tokens`, with
 *     `temperature`. Uses `max_completion_tokens` (the forward-compat name)
 *     so the same path also works on newer Chat Completions models.
 */
export async function generateCrossTowerPlan(
  prompt: BuildPromptInput,
  options: CrossTowerPlanLLMOptions = {},
): Promise<CrossTowerPlanLLMResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new CrossTowerPlanLLMError("OPENAI_API_KEY not set");
  }

  const modelId = resolveModelId(options.model);
  const temperature = resolveTemperature(options.temperature);
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);
  const maxOutputTokens = resolveMaxTokens(options.maxOutputTokens);

  const systemPrompt = buildSystemPrompt();
  let userPrompt = buildUserPrompt(prompt);
  if (options.repair) {
    userPrompt = [
      "REPAIR REQUEST — your previous output failed validation. Reasons:",
      ...options.repair.reasons.map((r) => `  - ${r}`),
      "",
      "Previous output (for reference, fix it):",
      options.repair.previousOutput,
      "",
      "Now return a corrected JSON object that satisfies all rules. The original task input follows:",
      "",
      userPrompt,
    ].join("\n");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const useResponses = shouldUseResponsesApi(modelId);

  let res: Response;
  try {
    if (useResponses) {
      // Responses API requires the word "json" somewhere in the input when
      // using text.format type "json_object" — both prompts already include
      // explicit JSON instructions, but we also prefix the user input.
      const responsesPayload = {
        model: modelId,
        instructions: systemPrompt,
        input: `Return a single JSON object exactly per the instructions.\n\n${userPrompt}`,
        reasoning: { effort: resolveReasoningEffort() },
        max_output_tokens: maxOutputTokens,
        text: {
          format: { type: "json_object" },
          verbosity: "medium",
        },
      };
      res = await fetch(`${resolveOpenAiBaseUrl()}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(responsesPayload),
        signal: controller.signal,
      });
    } else {
      res = await fetch(`${resolveOpenAiBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature,
          // `max_completion_tokens` is the forward-compat name across both
          // legacy and current Chat Completions models. Older models that
          // only knew `max_tokens` still accept this; newer reasoning
          // models (which reject `max_tokens`) require it.
          max_completion_tokens: maxOutputTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    }
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string })?.name === "AbortError") {
      throw new CrossTowerPlanLLMError(
        `OpenAI call timed out after ${timeoutMs}ms`,
        e,
        true,
      );
    }
    throw new CrossTowerPlanLLMError("OpenAI network error", e, true);
  }
  clearTimeout(timer);
  const latencyMs = Date.now() - startedAt;

  // Read body text once — both branches need it for error reporting and
  // structured parsing.
  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    const retriable = res.status === 429 || res.status >= 500;
    throw new CrossTowerPlanLLMError(
      `OpenAI ${res.status}: ${rawText.slice(0, 400) || res.statusText}`,
      undefined,
      retriable,
    );
  }

  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    throw new CrossTowerPlanLLMError("OpenAI returned non-JSON body", e);
  }

  // Pull JSON content out of the right shape per branch.
  let content: string | null;
  let usage:
    | { prompt?: number; completion?: number; total?: number }
    | undefined;

  if (useResponses) {
    const status = (body as { status?: string; error?: { message?: string } })
      .status;
    if (status === "failed" || status === "cancelled") {
      const err = (body as { error?: { message?: string } }).error?.message;
      throw new CrossTowerPlanLLMError(
        `OpenAI Responses status ${status}${err ? `: ${err}` : ""}`,
      );
    }
    content = extractResponsesOutputText(body);
    const u = (body as {
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    }).usage;
    if (u) {
      usage = {
        prompt: u.input_tokens,
        completion: u.output_tokens,
        total: u.total_tokens,
      };
    }
  } else {
    content = (
      body as { choices?: { message?: { content?: string } }[] }
    )?.choices?.[0]?.message?.content ?? null;
    const u = (body as {
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }).usage;
    if (u) {
      usage = {
        prompt: u.prompt_tokens,
        completion: u.completion_tokens,
        total: u.total_tokens,
      };
    }
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new CrossTowerPlanLLMError("OpenAI returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new CrossTowerPlanLLMError("OpenAI content was not valid JSON", e);
  }

  // Validate (and sanitize) against the determinism boundary + schema.
  const validated = validatePlan(parsed, prompt);

  return {
    plan: validated,
    modelId,
    promptVersion: PROMPT_VERSION,
    latencyMs,
    tokenUsage: usage,
  };
}

// ===========================================================================
//   Validation — determinism + schema
// ===========================================================================

/**
 * Forbidden tokens in any free-text field. Numerics belong to the deterministic
 * engine. We allow standalone single digits (e.g. "P1") and the literal
 * tier strings P1/P2/P3 — nothing else.
 *
 * Pattern detects:
 *   - any '$' or '%' character
 *   - any cluster of two or more consecutive digits
 *
 * Exception list lifted before the regex test:
 *   - The literal tier tokens "P1" / "P2" / "P3" (alone, with word
 *     boundaries) are stripped out so they don't trigger the digit-cluster
 *     check. We only care about *embedded* numerics like "$2.43B" or "12 weeks".
 */
const FORBIDDEN_NUMERIC_RE = /[\$%]|\d{2,}/;

function containsForbiddenNumeric(s: string): boolean {
  // Permit the bare phase labels — they're qualitative, not numeric.
  const stripped = s.replace(/\bP[123]\b/g, "");
  return FORBIDDEN_NUMERIC_RE.test(stripped);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

class ValidationError extends CrossTowerPlanLLMError {
  constructor(reasons: string[], rawText: string) {
    super(`LLM output failed validation: ${reasons.join("; ")}`, undefined, true);
    this.name = "ValidationError";
    this.reasons = reasons;
    this.rawText = rawText;
  }
  reasons: string[];
  rawText: string;
}

/**
 * Strict server-side validator. Produces a normalized `CrossTowerAiPlanLLM`
 * object the client can render directly. Any failure throws a
 * `ValidationError` with the list of reasons — the caller can use this list
 * to mount a structured-repair retry.
 */
export function validatePlan(
  raw: unknown,
  input: BuildPromptInput,
): CrossTowerAiPlanLLM {
  const reasons: string[] = [];
  const rawText = JSON.stringify(raw).slice(0, 1200);
  const r = (raw ?? {}) as Record<string, unknown>;

  // Build allow-set for initiativeId.
  const allowedInitiativeIds = new Set(input.initiatives.map((i) => i.id));
  const allowedRiskIds = new Set(PROGRAM_RISK_CATALOG.map((x) => x.id));

  // ---- executiveSummary ----
  const executiveSummary = asString(r.executiveSummary).trim();
  if (!executiveSummary) {
    reasons.push("executiveSummary is missing or empty");
  } else if (containsForbiddenNumeric(executiveSummary)) {
    reasons.push("executiveSummary contains forbidden numeric tokens");
  } else if (wordCount(executiveSummary) > 80) {
    // Soft cap (allowed up to ~55 words; 80 leaves headroom for tokenization
    // edge cases without permitting page-long paragraphs).
    reasons.push("executiveSummary exceeds word cap");
  }

  // ---- keyInitiatives ----
  const keyInitiativesRaw = Array.isArray(r.keyInitiatives) ? r.keyInitiatives : [];
  const keyInitiatives: LLMKeyInitiative[] = [];
  for (let i = 0; i < keyInitiativesRaw.length; i++) {
    const k = (keyInitiativesRaw[i] ?? {}) as Record<string, unknown>;
    const initiativeId = asString(k.initiativeId).trim();
    if (!allowedInitiativeIds.has(initiativeId)) {
      reasons.push(`keyInitiatives[${i}].initiativeId not in allow-list: "${initiativeId}"`);
      continue;
    }
    const ranking = typeof k.ranking === "number" && Number.isFinite(k.ranking)
      ? Math.max(1, Math.floor(k.ranking))
      : i + 1;
    const why = asString(k.why).trim();
    if (!why) {
      reasons.push(`keyInitiatives[${i}].why missing`);
      continue;
    }
    if (containsForbiddenNumeric(why)) {
      reasons.push(`keyInitiatives[${i}].why contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(why) > 60) {
      reasons.push(`keyInitiatives[${i}].why exceeds word cap`);
      continue;
    }
    const dependsOnRaw = asStringArray(k.dependsOn).slice(0, 4);
    const dependsOn: string[] = [];
    for (const d of dependsOnRaw) {
      const dt = d.trim();
      if (!dt) continue;
      if (dt === initiativeId) continue; // self-dep filtered.
      if (!allowedInitiativeIds.has(dt)) {
        reasons.push(`keyInitiatives[${i}].dependsOn unknown id: "${dt}"`);
        continue;
      }
      dependsOn.push(dt);
    }
    keyInitiatives.push({ initiativeId, ranking, why, dependsOn });
  }
  if (keyInitiatives.length === 0) {
    reasons.push("keyInitiatives is empty after filtering");
  }

  // Verify phase membership — LLM cannot move ids across phases. We don't
  // assert ranking here because ranking is just a sort hint within a tier,
  // but we reject if an initiativeId in the LLM list belongs to a different
  // tier than the deterministic engine assigned.
  for (const k of keyInitiatives) {
    const expected = input.phaseMembership[k.initiativeId];
    // Only enforce when both sides have a tier. If deterministic side is
    // null, the LLM rank for this id is ignored downstream.
    if (expected === null || expected === undefined) continue;
    // (Phase movement isn't expressed in the LLM payload — phases are
    // owned by the deterministic engine. So this check is a no-op for
    // ranking. Kept here as documentation of the trust boundary.)
    void expected;
  }

  // ---- roadmapPhases ----
  const rp = (r.roadmapPhases ?? {}) as Record<string, unknown>;
  const roadmapPhases: LLMRoadmapPhases = {
    p1: validateRoadmapPhase(rp.p1, "p1", reasons),
    p2: validateRoadmapPhase(rp.p2, "p2", reasons),
    p3: validateRoadmapPhase(rp.p3, "p3", reasons),
  };

  // ---- architectureNarrative ----
  const an = (r.architectureNarrative ?? {}) as Record<string, unknown>;
  const architectureNarrative: LLMArchitectureNarrative = {
    orchestrationCommentary: validateNarrativeField(
      an.orchestrationCommentary,
      "architectureNarrative.orchestrationCommentary",
      45,
      reasons,
    ),
    vendorStackCommentary: validateNarrativeField(
      an.vendorStackCommentary,
      "architectureNarrative.vendorStackCommentary",
      45,
      reasons,
    ),
    dataCoreCommentary: validateNarrativeField(
      an.dataCoreCommentary,
      "architectureNarrative.dataCoreCommentary",
      45,
      reasons,
    ),
  };

  // ---- riskMitigations ----
  const rmRaw = Array.isArray(r.riskMitigations) ? r.riskMitigations : [];
  const seenRisks = new Set<string>();
  const riskMitigations: LLMRiskMitigation[] = [];
  for (let i = 0; i < rmRaw.length; i++) {
    const m = (rmRaw[i] ?? {}) as Record<string, unknown>;
    const riskId = asString(m.riskId).trim();
    if (!allowedRiskIds.has(riskId)) {
      reasons.push(`riskMitigations[${i}].riskId not in catalog: "${riskId}"`);
      continue;
    }
    if (seenRisks.has(riskId)) continue;
    const mitigation = asString(m.mitigation).trim();
    if (!mitigation) {
      reasons.push(`riskMitigations[${i}].mitigation missing`);
      continue;
    }
    if (containsForbiddenNumeric(mitigation)) {
      reasons.push(`riskMitigations[${i}].mitigation contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(mitigation) > 50) {
      reasons.push(`riskMitigations[${i}].mitigation exceeds word cap`);
      continue;
    }
    seenRisks.add(riskId);
    riskMitigations.push({ riskId, mitigation });
  }

  if (reasons.length > 0) {
    throw new ValidationError(reasons, rawText);
  }

  return {
    executiveSummary,
    keyInitiatives,
    roadmapPhases,
    architectureNarrative,
    riskMitigations,
  };
}

function validateRoadmapPhase(
  raw: unknown,
  field: string,
  reasons: string[],
): LLMRoadmapPhase {
  const r = (raw ?? {}) as Record<string, unknown>;
  const narrative = asString(r.narrative).trim();
  if (!narrative) reasons.push(`${field}.narrative missing`);
  else if (containsForbiddenNumeric(narrative))
    reasons.push(`${field}.narrative contains forbidden numeric tokens`);
  else if (wordCount(narrative) > 80)
    reasons.push(`${field}.narrative exceeds word cap`);

  const milestonesRaw = asStringArray(r.milestones);
  const milestones: string[] = [];
  for (let i = 0; i < milestonesRaw.length; i++) {
    const m = milestonesRaw[i].trim();
    if (!m) continue;
    if (containsForbiddenNumeric(m)) {
      reasons.push(`${field}.milestones[${i}] contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(m) > 30) {
      reasons.push(`${field}.milestones[${i}] exceeds word cap`);
      continue;
    }
    milestones.push(m);
  }
  if (milestones.length === 0) {
    reasons.push(`${field}.milestones empty after filtering`);
  }

  const ownerNotesRaw = asStringArray(r.ownerNotes);
  const ownerNotes: string[] = [];
  for (let i = 0; i < ownerNotesRaw.length; i++) {
    const n = ownerNotesRaw[i].trim();
    if (!n) continue;
    if (containsForbiddenNumeric(n)) {
      reasons.push(`${field}.ownerNotes[${i}] contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(n) > 35) {
      reasons.push(`${field}.ownerNotes[${i}] exceeds word cap`);
      continue;
    }
    ownerNotes.push(n);
  }
  if (ownerNotes.length === 0) {
    reasons.push(`${field}.ownerNotes empty after filtering`);
  }

  return { narrative, milestones, ownerNotes };
}

function validateNarrativeField(
  raw: unknown,
  field: string,
  maxWords: number,
  reasons: string[],
): string {
  const s = asString(raw).trim();
  if (!s) {
    reasons.push(`${field} missing`);
    return "";
  }
  if (containsForbiddenNumeric(s)) {
    reasons.push(`${field} contains forbidden numeric tokens`);
    return "";
  }
  if (wordCount(s) > Math.ceil(maxWords * 1.4)) {
    // Soft cap with 40% headroom for tokenization variance.
    reasons.push(`${field} exceeds word cap`);
    return "";
  }
  // Phase memory: also reject obvious hedge phrases.
  const lower = s.toLowerCase();
  for (const bad of HEDGE_PHRASES) {
    if (lower.includes(bad)) {
      reasons.push(`${field} contains forbidden hedge phrase: "${bad}"`);
      return "";
    }
  }
  return s;
}

const HEDGE_PHRASES = [
  "potentially",
  "could possibly",
  "may help to",
  "leverage ai",
  "harness the power of ai",
  "transformative impact",
];

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

// Re-export validator's reasons type for the route handler.
export type { Tier };
export { ValidationError };
