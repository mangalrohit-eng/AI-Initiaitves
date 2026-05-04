/**
 * Cross-Tower AI Plan v3 — server-only LLM workflow.
 *
 * Architecture:
 *
 *   1) `generateCrossTowerPlan()` is the public entry point. It receives the
 *      pre-grouped L4 cohorts + assumptions and returns the full plan
 *      (`CrossTowerAiPlanLLM`) plus per-cohort + synthesis status.
 *   2) Per-cohort fan-out runs in parallel — one OpenAI call per L4 cohort
 *      authoring a single `AIProjectLLM`. One repair retry on validation
 *      failure, then a deterministic stub if the cohort can't ship clean.
 *   3) After cohorts complete, a single program-synthesis call authors the
 *      executive summary, roadmap narrative, dependsOn graph, and risks.
 *
 * Determinism enforcement runs server-side — the validators reject any
 * string field with `$`, `%`, or digit clusters of length 2+, and reject any
 * id that doesn't echo from the supplied cohort.
 */

import {
  buildSystemPrompt,
  buildProjectPromptForL4,
  buildProgramSynthesisPrompt,
  PROMPT_VERSION,
  ALLOWED_VENDORS,
  ALLOWED_BRANDS,
  ALLOWED_PEOPLE,
  HEDGE_PHRASES,
  type ProgramSynthesisProject,
} from "@/lib/llm/prompts/crossTowerAiPlan.v3";
import type {
  AIProjectLLM,
  AIProjectBriefLLM,
  AgentLLM,
  AgentOrchestrationLLM,
  CrossTowerAiPlanLLM,
  DigitalCoreLensLLM,
  EffortDriversLLM,
  L4Cohort,
  PerInitiativeRationale,
  PlatformRequirementLLM,
  ProgramRiskLLM,
  ProgramSynthesisLLM,
  RoadmapNarrativeLLM,
  RoleStateLLM,
  ToolStateLLM,
  WorkLensLLM,
  WorkStateLLM,
  WorkStepLLM,
  WorkbenchLensLLM,
  WorkforceLensLLM,
  AIProjectDependency,
} from "@/lib/cross-tower/aiProjects";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import { hashAssumptions } from "@/lib/cross-tower/assumptions";
import { resolveOpenAiBaseUrl } from "@/lib/llm/openaiBase";
import {
  getCachedProject,
  getCachedSynthesis,
  putCachedProject,
  putCachedSynthesis,
} from "@/lib/llm/crossTowerPlanCache";

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 6_000;
const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

type ReasoningEffort = "minimal" | "low" | "medium" | "high";

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

class ValidationError extends CrossTowerPlanLLMError {
  reasons: string[];
  rawText: string;
  constructor(reasons: string[], rawText: string) {
    super(`LLM output failed validation: ${reasons.join("; ")}`, undefined, true);
    this.name = "ValidationError";
    this.reasons = reasons;
    this.rawText = rawText;
  }
}

export { ValidationError };

export type CohortStatus =
  | { l4RowId: string; status: "ok" | "cache" }
  | { l4RowId: string; status: "stub"; reason: string };

export type SynthesisStatus = "ok" | "cache" | "stub";

export type GenerateCrossTowerPlanOptions = {
  cohorts: L4Cohort[];
  assumptions: CrossTowerAssumptions;
  inputHash: string;
  modelOverride?: string;
  forceRegenerate?: boolean;
  retryCohortIds?: string[];
  /** Tower AI readiness digest(s) for program synthesis narrative only. */
  synthesisIntakeDigest?: string;
};

export type GenerateCrossTowerPlanResult = {
  plan: CrossTowerAiPlanLLM;
  cohortStatus: CohortStatus[];
  synthesisStatus: SynthesisStatus;
  modelId: string;
  promptVersion: string;
  totalLatencyMs: number;
  warnings: string[];
};

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function intakeDigestFingerprint(digest: string | undefined): string {
  if (!digest?.trim()) return "none";
  let h = 5381;
  const s = digest;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function resolveModelId(override?: string): string {
  return (
    override?.trim() ||
    process.env.CROSS_TOWER_PLAN_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function resolveTemperature(): number {
  const env = process.env.CROSS_TOWER_PLAN_TEMPERATURE?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n)) return n;
  }
  return DEFAULT_TEMPERATURE;
}

function resolveTimeoutMs(): number {
  const env = process.env.CROSS_TOWER_PLAN_TIMEOUT_MS?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_TIMEOUT_MS;
}

function resolveMaxTokens(): number {
  const env = process.env.CROSS_TOWER_PLAN_MAX_TOKENS?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_MAX_TOKENS;
}

function resolveReasoningEffort(): ReasoningEffort {
  const raw = process.env.CROSS_TOWER_PLAN_REASONING_EFFORT?.trim().toLowerCase();
  if (raw === "minimal" || raw === "low" || raw === "medium" || raw === "high") {
    return raw;
  }
  return DEFAULT_REASONING_EFFORT;
}

function shouldUseResponsesApi(model: string): boolean {
  if (process.env.CROSS_TOWER_PLAN_USE_CHAT_COMPLETIONS === "1") return false;
  const m = model.toLowerCase();
  return (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4")
  );
}

// ===========================================================================
//   Top-level orchestration
// ===========================================================================

export async function generateCrossTowerPlan(
  options: GenerateCrossTowerPlanOptions,
): Promise<GenerateCrossTowerPlanResult> {
  const startedAt = Date.now();
  const modelId = resolveModelId(options.modelOverride);
  const assumptionsHash = hashAssumptions(options.assumptions);
  const cohortStatus: CohortStatus[] = [];
  const warnings: string[] = [];
  const projects: AIProjectLLM[] = [];
  const stubbedCohortNames: string[] = [];
  const retrySet = new Set(options.retryCohortIds ?? []);

  // Per-cohort fan-out — parallel.
  const projectPromises = options.cohorts.map(async (cohort) => {
    const cacheKey = {
      cohortInputHash: cohortInputHash(cohort, options.inputHash),
      assumptionsHash,
      modelId,
      promptVersion: PROMPT_VERSION,
    } as const;
    const bypassCache = options.forceRegenerate || retrySet.has(cohort.l4RowId);
    if (!bypassCache) {
      const cached = getCachedProject(cacheKey);
      if (cached) {
        return {
          cohort,
          status: { l4RowId: cohort.l4RowId, status: "cache" } as CohortStatus,
          project: cached.project,
        };
      }
    }
    try {
      const project = await authorProjectWithRetry(cohort, options.assumptions, modelId);
      putCachedProject(cacheKey, {
        project,
        modelId,
        promptVersion: PROMPT_VERSION,
        latencyMs: 0,
      });
      return {
        cohort,
        status: { l4RowId: cohort.l4RowId, status: "ok" } as CohortStatus,
        project,
      };
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Unknown error";
      warnings.push(
        `Cohort "${cohort.l4Name}" fell back to deterministic stub: ${reason}`,
      );
      return {
        cohort,
        status: {
          l4RowId: cohort.l4RowId,
          status: "stub",
          reason,
        } as CohortStatus,
        project: null,
      };
    }
  });

  const projectResults = await Promise.all(projectPromises);
  for (const r of projectResults) {
    cohortStatus.push(r.status);
    if (r.project) {
      projects.push(r.project);
    } else {
      stubbedCohortNames.push(r.cohort.l4Name);
    }
  }

  // Synthesis — single call.
  let synthesis: ProgramSynthesisLLM | null = null;
  let synthesisStatus: SynthesisStatus = "stub";

  if (projects.length > 0) {
    const synthesisInputProjects: ProgramSynthesisProject[] = projects.map(
      (p) => ({
        id: p.id,
        name: p.name,
        parentL4ActivityGroupName: p.parentL4ActivityGroupName,
        primaryTowerName: cohortNameById(options.cohorts, p.parentL4ActivityGroupId).towerName,
        narrative: p.narrative,
        valueBucket: p.valueBucket,
        effortBucket: p.effortBucket,
        effortDrivers: p.effortDrivers,
      }),
    );
    const projectsDigest = projectsDigestFor(projects);
    const timingHash = hashTimingContext(options.assumptions);
    const intakeDigestHash = intakeDigestFingerprint(options.synthesisIntakeDigest);
    const cacheKey = {
      projectsDigest,
      timingHash,
      assumptionsHash,
      intakeDigestHash,
      modelId,
      promptVersion: PROMPT_VERSION,
    } as const;
    if (!options.forceRegenerate) {
      const cached = getCachedSynthesis(cacheKey);
      if (cached) {
        synthesis = cached.synthesis;
        synthesisStatus = "cache";
      }
    }
    if (!synthesis) {
      try {
        synthesis = await authorSynthesisWithRetry({
          projects: synthesisInputProjects,
          stubbedCohortNames,
          assumptions: options.assumptions,
          modelId,
          authoredProjectIds: new Set(projects.map((p) => p.id)),
          synthesisIntakeDigest: options.synthesisIntakeDigest,
        });
        putCachedSynthesis(cacheKey, {
          synthesis,
          modelId,
          promptVersion: PROMPT_VERSION,
          latencyMs: 0,
        });
        synthesisStatus = "ok";
      } catch (e) {
        const reason = e instanceof Error ? e.message : "Unknown error";
        warnings.push(`Program synthesis fell back to stub: ${reason}`);
        synthesis = null;
        synthesisStatus = "stub";
      }
    }
  }

  return {
    plan: { projects, synthesis },
    cohortStatus,
    synthesisStatus,
    modelId,
    promptVersion: PROMPT_VERSION,
    totalLatencyMs: Date.now() - startedAt,
    warnings,
  };
}

// ---------------------------------------------------------------------------
//   Per-cohort author-with-repair-retry
// ---------------------------------------------------------------------------

async function authorProjectWithRetry(
  cohort: L4Cohort,
  assumptions: CrossTowerAssumptions,
  modelId: string,
): Promise<AIProjectLLM> {
  let lastReasons: string[] | null = null;
  let lastRaw: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = buildProjectPromptForL4({ cohort, assumptions });
    const repair =
      attempt === 1 && lastReasons && lastRaw
        ? { reasons: lastReasons, previousOutput: lastRaw }
        : undefined;
    const raw = await callOpenAi({
      modelId,
      systemPrompt: buildSystemPrompt(),
      userPrompt,
      repair,
    });
    try {
      return validateProject(raw, cohort);
    } catch (e) {
      if (e instanceof ValidationError) {
        lastReasons = e.reasons;
        lastRaw = e.rawText;
        continue;
      }
      throw e;
    }
  }
  throw new ValidationError(
    lastReasons ?? ["validation failed twice"],
    lastRaw ?? "",
  );
}

async function authorSynthesisWithRetry(args: {
  projects: ProgramSynthesisProject[];
  stubbedCohortNames: string[];
  assumptions: CrossTowerAssumptions;
  modelId: string;
  authoredProjectIds: Set<string>;
  synthesisIntakeDigest?: string;
}): Promise<ProgramSynthesisLLM> {
  let lastReasons: string[] | null = null;
  let lastRaw: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = buildProgramSynthesisPrompt({
      projects: args.projects,
      stubbedCohortNames: args.stubbedCohortNames,
      assumptions: args.assumptions,
      synthesisIntakeDigest: args.synthesisIntakeDigest,
    });
    const repair =
      attempt === 1 && lastReasons && lastRaw
        ? { reasons: lastReasons, previousOutput: lastRaw }
        : undefined;
    const raw = await callOpenAi({
      modelId: args.modelId,
      systemPrompt: buildSystemPrompt(),
      userPrompt,
      repair,
    });
    try {
      return validateProgramSynthesis(raw, args.authoredProjectIds);
    } catch (e) {
      if (e instanceof ValidationError) {
        lastReasons = e.reasons;
        lastRaw = e.rawText;
        continue;
      }
      throw e;
    }
  }
  throw new ValidationError(
    lastReasons ?? ["validation failed twice"],
    lastRaw ?? "",
  );
}

// ---------------------------------------------------------------------------
//   OpenAI call (Responses API for GPT-5 family, Chat Completions otherwise)
// ---------------------------------------------------------------------------

async function callOpenAi(args: {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  repair?: { reasons: string[]; previousOutput: string };
}): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new CrossTowerPlanLLMError("OPENAI_API_KEY not set");

  let userPrompt = args.userPrompt;
  if (args.repair) {
    userPrompt = [
      "REPAIR REQUEST — your previous output failed validation. Reasons:",
      ...args.repair.reasons.map((r) => `  - ${r}`),
      "",
      "Previous output (for reference, fix it):",
      args.repair.previousOutput,
      "",
      "Now return a corrected JSON object that satisfies all rules. The original task input follows:",
      "",
      userPrompt,
    ].join("\n");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolveTimeoutMs());
  const useResponses = shouldUseResponsesApi(args.modelId);

  let res: Response;
  try {
    if (useResponses) {
      res = await fetch(`${resolveOpenAiBaseUrl()}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: args.modelId,
          instructions: args.systemPrompt,
          input: `Return a single JSON object exactly per the instructions.\n\n${userPrompt}`,
          reasoning: { effort: resolveReasoningEffort() },
          max_output_tokens: resolveMaxTokens(),
          text: {
            format: { type: "json_object" },
            verbosity: "medium",
          },
        }),
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
          model: args.modelId,
          temperature: resolveTemperature(),
          max_completion_tokens: resolveMaxTokens(),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: args.systemPrompt },
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
        `OpenAI call timed out after ${resolveTimeoutMs()}ms`,
        e,
        true,
      );
    }
    throw new CrossTowerPlanLLMError("OpenAI network error", e, true);
  }
  clearTimeout(timer);

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

  let content: string | null = null;
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
  } else {
    content =
      (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
        ?.message?.content ?? null;
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new CrossTowerPlanLLMError("OpenAI returned empty content");
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new CrossTowerPlanLLMError("OpenAI content was not valid JSON", e);
  }
}

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
      if (
        part.type === "output_text" &&
        typeof part.text === "string" &&
        part.text.trim()
      ) {
        return part.text;
      }
    }
  }
  return null;
}

// ===========================================================================
//   Validators — the determinism + schema boundary
// ===========================================================================

const FORBIDDEN_NUMERIC_RE = /[\$%]|\d{2,}/;

function containsForbiddenNumeric(s: string): boolean {
  const stripped = s.replace(/\bP[123]\b/g, "");
  return FORBIDDEN_NUMERIC_RE.test(stripped);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asInt(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  return fallback;
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

const VENDOR_ALLOW_LOWER = new Set(
  ALLOWED_VENDORS.map((v) => v.toLowerCase()),
);

function isAllowedVendor(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed === "TBD — subject to discovery") return true;
  // Compound stacks like "BlackLine + Workiva" — every part must be allow-listed.
  const parts = trimmed.split(/\s*\+\s*/);
  return parts.every((p) => {
    const lower = p.trim().toLowerCase();
    if (lower === "llm") return true;
    return VENDOR_ALLOW_LOWER.has(lower);
  });
}

const NAME_BAD_PATTERNS = [
  /^automate /i,
  /^automating /i,
  /^improve /i,
  /^enhance /i,
];

function isProjectName(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (containsForbiddenNumeric(trimmed)) return false;
  if (wordCount(trimmed) > 8) return false;
  for (const re of NAME_BAD_PATTERNS) if (re.test(trimmed)) return false;
  return true;
}

function checkHedgePhrases(s: string, field: string, reasons: string[]): void {
  const lower = s.toLowerCase();
  for (const bad of HEDGE_PHRASES) {
    if (lower.includes(bad)) {
      reasons.push(`${field} contains forbidden hedge phrase: "${bad}"`);
      return;
    }
  }
}

// ---- Project validator -----------------------------------------------------

export function validateProject(
  raw: unknown,
  cohort: L4Cohort,
): AIProjectLLM {
  const reasons: string[] = [];
  const rawText = JSON.stringify(raw).slice(0, 1500);
  const r = (raw ?? {}) as Record<string, unknown>;

  // Basic ids -------------------------------------------------------------
  const expectedId = `proj-${cohort.l4RowId}`;
  const id = asString(r.id).trim();
  if (id !== expectedId) {
    reasons.push(
      `id must equal "${expectedId}", got "${id}"`,
    );
  }
  const parentL4ActivityGroupId = asString(r.parentL4ActivityGroupId).trim();
  if (parentL4ActivityGroupId !== cohort.l4RowId) {
    reasons.push(
      `parentL4ActivityGroupId must equal "${cohort.l4RowId}", got "${parentL4ActivityGroupId}"`,
    );
  }
  const parentL4ActivityGroupName = asString(r.parentL4ActivityGroupName).trim();
  if (parentL4ActivityGroupName !== cohort.l4Name) {
    reasons.push(
      `parentL4ActivityGroupName must equal "${cohort.l4Name}"`,
    );
  }
  const primaryTowerId = asString(r.primaryTowerId).trim();
  if (primaryTowerId !== cohort.towerId) {
    reasons.push(`primaryTowerId must equal "${cohort.towerId}"`);
  }

  // Name ------------------------------------------------------------------
  const name = asString(r.name).trim();
  if (!name) reasons.push("name missing");
  else if (!isProjectName(name))
    reasons.push(`name "${name}" must be ≤8 words, no numerics, not start with Automate/Improve/Enhance`);

  // Narrative -------------------------------------------------------------
  const narrative = asString(r.narrative).trim();
  if (!narrative) reasons.push("narrative missing");
  else {
    if (containsForbiddenNumeric(narrative))
      reasons.push("narrative contains forbidden numeric tokens");
    if (wordCount(narrative) > 70)
      reasons.push("narrative exceeds word cap (≤55 + 15 headroom)");
    checkHedgePhrases(narrative, "narrative", reasons);
  }

  // Constituents ----------------------------------------------------------
  const cohortIds = new Set(cohort.l5Initiatives.map((i) => i.id));
  const constituentInitiativeIds = asStringArray(r.constituentInitiativeIds);
  for (const cid of constituentInitiativeIds) {
    if (!cohortIds.has(cid))
      reasons.push(`constituentInitiativeIds contains foreign id "${cid}"`);
  }
  for (const expected of cohort.l5Initiatives) {
    if (!constituentInitiativeIds.includes(expected.id))
      reasons.push(`constituentInitiativeIds missing cohort id "${expected.id}"`);
  }

  // Per-initiative rationales --------------------------------------------
  const perRaw = Array.isArray(r.perInitiativeRationale)
    ? r.perInitiativeRationale
    : [];
  const perInitiativeRationale: PerInitiativeRationale[] = [];
  const perSeen = new Set<string>();
  for (let i = 0; i < perRaw.length; i++) {
    const p = (perRaw[i] ?? {}) as Record<string, unknown>;
    const initiativeId = asString(p.initiativeId).trim();
    const rationale = asString(p.rationale).trim();
    if (!cohortIds.has(initiativeId)) {
      reasons.push(`perInitiativeRationale[${i}] foreign id "${initiativeId}"`);
      continue;
    }
    if (perSeen.has(initiativeId)) {
      reasons.push(`perInitiativeRationale[${i}] duplicate id "${initiativeId}"`);
      continue;
    }
    perSeen.add(initiativeId);
    if (!rationale) {
      reasons.push(`perInitiativeRationale[${i}].rationale missing`);
      continue;
    }
    if (containsForbiddenNumeric(rationale)) {
      reasons.push(
        `perInitiativeRationale[${i}].rationale contains forbidden numeric tokens`,
      );
      continue;
    }
    if (wordCount(rationale) > 30)
      reasons.push(`perInitiativeRationale[${i}].rationale exceeds word cap`);
    perInitiativeRationale.push({ initiativeId, rationale });
  }
  for (const expected of cohort.l5Initiatives) {
    if (!perSeen.has(expected.id))
      reasons.push(`perInitiativeRationale missing cohort id "${expected.id}"`);
  }

  // Brief -----------------------------------------------------------------
  const brief = validateBrief(r.brief, reasons);

  // Value / Effort --------------------------------------------------------
  const valueBucket = (r.valueBucket === "High" || r.valueBucket === "Low")
    ? r.valueBucket
    : null;
  if (!valueBucket) reasons.push(`valueBucket must be "High" | "Low"`);
  const valueRationale = asString(r.valueRationale).trim();
  validateRationale(valueRationale, "valueRationale", 35, reasons);

  const effortBucket = (r.effortBucket === "High" || r.effortBucket === "Low")
    ? r.effortBucket
    : null;
  if (!effortBucket) reasons.push(`effortBucket must be "High" | "Low"`);
  const effortRationale = asString(r.effortRationale).trim();
  validateRationale(effortRationale, "effortRationale", 35, reasons);

  const effortDrivers = validateEffortDrivers(r.effortDrivers, brief, reasons);

  // Soft coherence — high effort claim with very lean drivers, or low effort
  // claim with maxed drivers, surface as a reason but DO NOT block. We push
  // them last so we can decide later if we want to break.
  // (Currently breaking — repair retry should usually fix it.)
  if (
    effortBucket === "Low" &&
    effortDrivers &&
    (effortDrivers.integrationCount >= 5 ||
      effortDrivers.agentCount >= 6 ||
      effortDrivers.complexity === "High")
  ) {
    reasons.push(
      "effortBucket=Low contradicts brief signals (≥5 integrations OR ≥6 agents OR complexity=High)",
    );
  }
  if (
    effortBucket === "High" &&
    effortDrivers &&
    effortDrivers.integrationCount <= 2 &&
    effortDrivers.agentCount <= 3 &&
    effortDrivers.complexity === "Low"
  ) {
    reasons.push(
      "effortBucket=High contradicts brief signals (≤2 integrations, ≤3 agents, complexity=Low)",
    );
  }

  if (reasons.length > 0) {
    throw new ValidationError(reasons, rawText);
  }

  return {
    id,
    name,
    narrative,
    parentL4ActivityGroupId,
    parentL4ActivityGroupName,
    primaryTowerId: primaryTowerId as AIProjectLLM["primaryTowerId"],
    constituentInitiativeIds,
    perInitiativeRationale,
    brief,
    valueBucket: valueBucket as AIProjectLLM["valueBucket"],
    valueRationale,
    effortBucket: effortBucket as AIProjectLLM["effortBucket"],
    effortRationale,
    effortDrivers: effortDrivers as EffortDriversLLM,
  };
}

function validateRationale(
  s: string,
  field: string,
  maxWords: number,
  reasons: string[],
): void {
  if (!s) {
    reasons.push(`${field} missing`);
    return;
  }
  if (containsForbiddenNumeric(s))
    reasons.push(`${field} contains forbidden numeric tokens`);
  if (wordCount(s) > maxWords) reasons.push(`${field} exceeds word cap`);
  checkHedgePhrases(s, field, reasons);
}

function validateBrief(
  raw: unknown,
  reasons: string[],
): AIProjectBriefLLM {
  const r = (raw ?? {}) as Record<string, unknown>;

  const framing = asString(r.framing).trim();
  if (!framing) reasons.push("brief.framing missing");
  else {
    if (containsForbiddenNumeric(framing))
      reasons.push("brief.framing contains forbidden numeric tokens");
    if (wordCount(framing) > 32) reasons.push("brief.framing exceeds word cap");
    checkHedgePhrases(framing, "brief.framing", reasons);
  }

  const currentPainPointsRaw = asStringArray(r.currentPainPoints);
  const currentPainPoints: string[] = [];
  for (let i = 0; i < currentPainPointsRaw.length; i++) {
    const p = currentPainPointsRaw[i].trim();
    if (!p) continue;
    if (containsForbiddenNumeric(p)) {
      reasons.push(`brief.currentPainPoints[${i}] contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(p) > 20)
      reasons.push(`brief.currentPainPoints[${i}] exceeds word cap`);
    currentPainPoints.push(p);
  }
  if (currentPainPoints.length < 2)
    reasons.push("brief.currentPainPoints must have at least 2 entries");

  const work = validateWorkLens(r.work, reasons);
  const workforce = validateWorkforceLens(r.workforce, reasons);
  const workbench = validateWorkbenchLens(r.workbench, reasons);
  const digitalCore = validateDigitalCore(r.digitalCore, reasons);
  const agents = validateAgents(r.agents, reasons);
  const agentOrchestration = validateOrchestration(r.agentOrchestration, reasons);

  return {
    framing,
    currentPainPoints,
    work,
    workforce,
    workbench,
    digitalCore,
    agents,
    agentOrchestration,
  };
}

function validateWorkLens(raw: unknown, reasons: string[]): WorkLensLLM {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pre = validateWorkState(r.pre, "brief.work.pre", reasons);
  const post = validateWorkState(r.post, "brief.work.post", reasons);
  const keyShifts = validateShortStringArray(
    r.keyShifts,
    "brief.work.keyShifts",
    { min: 3, max: 8, maxWords: 22 },
    reasons,
  );
  return { pre, post, keyShifts };
}

function validateWorkState(
  raw: unknown,
  field: string,
  reasons: string[],
): WorkStateLLM {
  const r = (raw ?? {}) as Record<string, unknown>;
  const description = asString(r.description).trim();
  if (!description) reasons.push(`${field}.description missing`);
  else {
    if (containsForbiddenNumeric(description))
      reasons.push(`${field}.description contains forbidden numeric tokens`);
    if (wordCount(description) > 55)
      reasons.push(`${field}.description exceeds word cap`);
  }
  const stepsRaw = Array.isArray(r.steps) ? r.steps : [];
  const steps: WorkStepLLM[] = [];
  for (let i = 0; i < stepsRaw.length; i++) {
    const s = (stepsRaw[i] ?? {}) as Record<string, unknown>;
    const action = asString(s.action).trim();
    const owner = asString(s.owner).trim();
    const duration = asString(s.duration).trim();
    const isManual = asBool(s.isManual, false);
    const stepNum = asInt(s.step, i + 1);
    if (!action || !owner || !duration) {
      reasons.push(`${field}.steps[${i}] missing required fields`);
      continue;
    }
    if (containsForbiddenNumeric(action) || containsForbiddenNumeric(duration)) {
      reasons.push(`${field}.steps[${i}] contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(action) > 22) {
      reasons.push(`${field}.steps[${i}].action exceeds word cap`);
      continue;
    }
    steps.push({ step: stepNum, action, owner, duration, isManual });
  }
  if (steps.length < 3) reasons.push(`${field}.steps must have at least 3 entries`);
  const avgCycleTime = asString(r.avgCycleTime).trim() || "TBD";
  const touchpointsSummary = asString(r.touchpointsSummary).trim() || "TBD";
  const errorRateSummary = asString(r.errorRateSummary).trim() || "TBD";
  if (containsForbiddenNumeric(avgCycleTime))
    reasons.push(`${field}.avgCycleTime contains forbidden numeric tokens`);
  if (containsForbiddenNumeric(touchpointsSummary))
    reasons.push(`${field}.touchpointsSummary contains forbidden numeric tokens`);
  if (containsForbiddenNumeric(errorRateSummary))
    reasons.push(`${field}.errorRateSummary contains forbidden numeric tokens`);
  return {
    description,
    steps,
    avgCycleTime,
    touchpointsSummary,
    errorRateSummary,
  };
}

function validateWorkforceLens(
  raw: unknown,
  reasons: string[],
): WorkforceLensLLM {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pre = validateRoleStateArray(r.pre, "brief.workforce.pre", reasons);
  const post = validateRoleStateArray(r.post, "brief.workforce.post", reasons);
  const keyShifts = validateShortStringArray(
    r.keyShifts,
    "brief.workforce.keyShifts",
    { min: 3, max: 8, maxWords: 22 },
    reasons,
  );
  const tier = (r.workforceImpactTier === "High" ||
    r.workforceImpactTier === "Medium" ||
    r.workforceImpactTier === "Low")
    ? r.workforceImpactTier
    : null;
  if (!tier) reasons.push("brief.workforce.workforceImpactTier missing or invalid");
  const summary = asString(r.workforceImpactSummary).trim();
  if (!summary) reasons.push("brief.workforce.workforceImpactSummary missing");
  else {
    if (containsForbiddenNumeric(summary))
      reasons.push("brief.workforce.workforceImpactSummary contains forbidden numeric tokens");
    if (wordCount(summary) > 55)
      reasons.push("brief.workforce.workforceImpactSummary exceeds word cap");
  }
  return {
    pre,
    post,
    keyShifts,
    workforceImpactTier: (tier ?? "Medium") as WorkforceLensLLM["workforceImpactTier"],
    workforceImpactSummary: summary,
  };
}

function validateRoleStateArray(
  raw: unknown,
  field: string,
  reasons: string[],
): RoleStateLLM[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: RoleStateLLM[] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = (arr[i] ?? {}) as Record<string, unknown>;
    const role = asString(r.role).trim();
    const headcountSummary = asString(r.headcountSummary).trim();
    const primaryActivities = asStringArray(r.primaryActivities)
      .map((s) => s.trim())
      .filter(Boolean);
    const skillsRequired = asStringArray(r.skillsRequired)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!role || !headcountSummary) {
      reasons.push(`${field}[${i}] missing required role/headcount fields`);
      continue;
    }
    if (containsForbiddenNumeric(headcountSummary)) {
      reasons.push(`${field}[${i}].headcountSummary contains forbidden numeric tokens`);
      continue;
    }
    for (let j = 0; j < primaryActivities.length; j++) {
      const a = primaryActivities[j];
      if (containsForbiddenNumeric(a)) {
        reasons.push(`${field}[${i}].primaryActivities[${j}] contains forbidden numeric tokens`);
      }
      if (wordCount(a) > 20) {
        reasons.push(`${field}[${i}].primaryActivities[${j}] exceeds word cap`);
      }
    }
    out.push({ role, headcountSummary, primaryActivities, skillsRequired });
  }
  if (out.length < 1) reasons.push(`${field} must have at least 1 entry`);
  return out;
}

function validateWorkbenchLens(
  raw: unknown,
  reasons: string[],
): WorkbenchLensLLM {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pre = validateToolStateArray(r.pre, "brief.workbench.pre", false, reasons);
  const post = validateToolStateArray(r.post, "brief.workbench.post", true, reasons);
  const keyShifts = validateShortStringArray(
    r.keyShifts,
    "brief.workbench.keyShifts",
    { min: 3, max: 8, maxWords: 22 },
    reasons,
  );
  return { pre, post, keyShifts };
}

function validateToolStateArray(
  raw: unknown,
  field: string,
  enforceVendorAllowList: boolean,
  reasons: string[],
): ToolStateLLM[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: ToolStateLLM[] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = (arr[i] ?? {}) as Record<string, unknown>;
    const tool = asString(r.tool).trim();
    const category = asString(r.category).trim();
    const usage = asString(r.usage).trim();
    if (!tool || !category || !usage) {
      reasons.push(`${field}[${i}] missing required fields`);
      continue;
    }
    if (containsForbiddenNumeric(usage)) {
      reasons.push(`${field}[${i}].usage contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(usage) > 18) {
      reasons.push(`${field}[${i}].usage exceeds word cap`);
      continue;
    }
    if (enforceVendorAllowList && !isAllowedVendor(tool)) {
      reasons.push(`${field}[${i}].tool "${tool}" not in ALLOWED_VENDORS`);
      continue;
    }
    out.push({ tool, category, usage });
  }
  return out;
}

function validateDigitalCore(
  raw: unknown,
  reasons: string[],
): DigitalCoreLensLLM {
  const r = (raw ?? {}) as Record<string, unknown>;
  const platsRaw = Array.isArray(r.requiredPlatforms) ? r.requiredPlatforms : [];
  const requiredPlatforms: PlatformRequirementLLM[] = [];
  for (let i = 0; i < platsRaw.length; i++) {
    const p = (platsRaw[i] ?? {}) as Record<string, unknown>;
    const platform = asString(p.platform).trim();
    const purpose = asString(p.purpose).trim();
    const priority = (p.priority === "Critical" ||
      p.priority === "Important" ||
      p.priority === "Nice-to-have")
      ? p.priority
      : "Important";
    const examplesRaw = asStringArray(p.examples).map((x) => x.trim()).filter(Boolean);
    const examples: string[] = [];
    for (const ex of examplesRaw) {
      if (!isAllowedVendor(ex)) {
        reasons.push(
          `brief.digitalCore.requiredPlatforms[${i}].examples contains non-allow-listed vendor "${ex}"`,
        );
        continue;
      }
      examples.push(ex);
    }
    if (!platform || !purpose) {
      reasons.push(`brief.digitalCore.requiredPlatforms[${i}] missing required fields`);
      continue;
    }
    if (containsForbiddenNumeric(purpose)) {
      reasons.push(
        `brief.digitalCore.requiredPlatforms[${i}].purpose contains forbidden numeric tokens`,
      );
      continue;
    }
    requiredPlatforms.push({ platform, purpose, priority, examples });
  }
  if (requiredPlatforms.length < 2)
    reasons.push("brief.digitalCore.requiredPlatforms must have at least 2 entries");

  const dataRequirements = validateShortStringArray(
    r.dataRequirements,
    "brief.digitalCore.dataRequirements",
    { min: 2, max: 8, maxWords: 22 },
    reasons,
  );
  const integrations = validateShortStringArray(
    r.integrations,
    "brief.digitalCore.integrations",
    { min: 2, max: 10, maxWords: 18 },
    reasons,
  );
  const securityConsiderations = validateShortStringArray(
    r.securityConsiderations,
    "brief.digitalCore.securityConsiderations",
    { min: 1, max: 6, maxWords: 22 },
    reasons,
  );
  const estimatedBuildEffortSummary = asString(r.estimatedBuildEffortSummary).trim();
  if (!estimatedBuildEffortSummary)
    reasons.push("brief.digitalCore.estimatedBuildEffortSummary missing");
  else if (containsForbiddenNumeric(estimatedBuildEffortSummary))
    reasons.push("brief.digitalCore.estimatedBuildEffortSummary contains forbidden numeric tokens");

  return {
    requiredPlatforms,
    dataRequirements,
    integrations,
    securityConsiderations,
    estimatedBuildEffortSummary,
  };
}

function validateAgents(raw: unknown, reasons: string[]): AgentLLM[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: AgentLLM[] = [];
  const ALLOWED_AGENT_TYPES = ["Orchestrator", "Specialist", "Monitor", "Router", "Executor"] as const;
  for (let i = 0; i < arr.length; i++) {
    const r = (arr[i] ?? {}) as Record<string, unknown>;
    const name = asString(r.name).trim();
    const role = asString(r.role).trim();
    const type = ALLOWED_AGENT_TYPES.find((t) => t === r.type) ?? null;
    const inputs = asStringArray(r.inputs).map((s) => s.trim()).filter(Boolean);
    const outputs = asStringArray(r.outputs).map((s) => s.trim()).filter(Boolean);
    const llmRequired = asBool(r.llmRequired, false);
    const toolsUsedRaw = asStringArray(r.toolsUsed).map((s) => s.trim()).filter(Boolean);
    if (!name || !role || !type) {
      reasons.push(`brief.agents[${i}] missing required name/role/type`);
      continue;
    }
    if (containsForbiddenNumeric(role)) {
      reasons.push(`brief.agents[${i}].role contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(role) > 18) {
      reasons.push(`brief.agents[${i}].role exceeds word cap`);
      continue;
    }
    const toolsUsed: string[] = [];
    for (const t of toolsUsedRaw) {
      if (!isAllowedVendor(t)) {
        reasons.push(
          `brief.agents[${i}].toolsUsed contains non-allow-listed vendor "${t}"`,
        );
        continue;
      }
      toolsUsed.push(t);
    }
    out.push({ name, role, type, inputs, outputs, llmRequired, toolsUsed });
  }
  if (out.length < 2) reasons.push("brief.agents must have at least 2 entries");
  return out;
}

function validateOrchestration(
  raw: unknown,
  reasons: string[],
): AgentOrchestrationLLM {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ALLOWED_PATTERNS = [
    "Sequential",
    "Parallel",
    "Hub-and-Spoke",
    "Pipeline",
    "Hierarchical",
  ] as const;
  const pattern = ALLOWED_PATTERNS.find((p) => p === r.pattern) ?? null;
  if (!pattern) reasons.push("brief.agentOrchestration.pattern missing or invalid");
  const description = asString(r.description).trim();
  if (!description) reasons.push("brief.agentOrchestration.description missing");
  else if (containsForbiddenNumeric(description))
    reasons.push("brief.agentOrchestration.description contains forbidden numeric tokens");
  else if (wordCount(description) > 36)
    reasons.push("brief.agentOrchestration.description exceeds word cap");
  return {
    pattern: (pattern ?? "Pipeline") as AgentOrchestrationLLM["pattern"],
    description,
  };
}

function validateEffortDrivers(
  raw: unknown,
  brief: AIProjectBriefLLM,
  reasons: string[],
): EffortDriversLLM | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const integrationCount = asInt(r.integrationCount, brief.digitalCore.integrations.length);
  const agentCount = asInt(r.agentCount, brief.agents.length);
  const platformCount = asInt(r.platformCount, brief.digitalCore.requiredPlatforms.length);
  const complexity = (r.complexity === "Low" || r.complexity === "Medium" || r.complexity === "High")
    ? r.complexity
    : null;
  const provenElsewhere = asBool(r.provenElsewhere, false);
  const provenRationale = asString(r.provenRationale).trim();
  if (integrationCount !== brief.digitalCore.integrations.length)
    reasons.push(
      `effortDrivers.integrationCount must equal brief.digitalCore.integrations.length (${brief.digitalCore.integrations.length})`,
    );
  if (agentCount !== brief.agents.length)
    reasons.push(
      `effortDrivers.agentCount must equal brief.agents.length (${brief.agents.length})`,
    );
  if (platformCount !== brief.digitalCore.requiredPlatforms.length)
    reasons.push(
      `effortDrivers.platformCount must equal brief.digitalCore.requiredPlatforms.length (${brief.digitalCore.requiredPlatforms.length})`,
    );
  if (!complexity) reasons.push(`effortDrivers.complexity must be Low|Medium|High`);
  if (!provenRationale) reasons.push(`effortDrivers.provenRationale missing`);
  else if (containsForbiddenNumeric(provenRationale))
    reasons.push(`effortDrivers.provenRationale contains forbidden numeric tokens`);
  if (provenRationale && wordCount(provenRationale) > 26)
    reasons.push(`effortDrivers.provenRationale exceeds word cap`);

  if (!complexity) return null;
  return {
    integrationCount,
    agentCount,
    platformCount,
    complexity,
    provenElsewhere,
    provenRationale,
  };
}

function validateShortStringArray(
  raw: unknown,
  field: string,
  opts: { min: number; max: number; maxWords: number },
  reasons: string[],
): string[] {
  const arr = asStringArray(raw)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    if (containsForbiddenNumeric(s)) {
      reasons.push(`${field}[${i}] contains forbidden numeric tokens`);
      continue;
    }
    if (wordCount(s) > opts.maxWords) {
      reasons.push(`${field}[${i}] exceeds word cap`);
      continue;
    }
    out.push(s);
    if (out.length >= opts.max) break;
  }
  if (out.length < opts.min)
    reasons.push(`${field} must have at least ${opts.min} entries`);
  return out;
}

// ---- Synthesis validator ---------------------------------------------------

export function validateProgramSynthesis(
  raw: unknown,
  authoredProjectIds: Set<string>,
): ProgramSynthesisLLM {
  const reasons: string[] = [];
  const rawText = JSON.stringify(raw).slice(0, 1500);
  const r = (raw ?? {}) as Record<string, unknown>;

  const executiveSummary = asString(r.executiveSummary).trim();
  if (!executiveSummary) reasons.push("executiveSummary missing");
  else {
    if (containsForbiddenNumeric(executiveSummary))
      reasons.push("executiveSummary contains forbidden numeric tokens");
    if (wordCount(executiveSummary) > 70)
      reasons.push("executiveSummary exceeds word cap");
    checkHedgePhrases(executiveSummary, "executiveSummary", reasons);
  }

  const dependsOnRaw = Array.isArray(r.dependsOn) ? r.dependsOn : [];
  const dependsOn: AIProjectDependency[] = [];
  for (let i = 0; i < dependsOnRaw.length; i++) {
    const d = (dependsOnRaw[i] ?? {}) as Record<string, unknown>;
    const projectId = asString(d.projectId).trim();
    if (!authoredProjectIds.has(projectId)) {
      reasons.push(`dependsOn[${i}].projectId unknown: "${projectId}"`);
      continue;
    }
    const ids = asStringArray(d.dependsOn).slice(0, 3);
    const filtered: string[] = [];
    for (const id of ids) {
      if (id === projectId) continue;
      if (!authoredProjectIds.has(id)) {
        reasons.push(`dependsOn[${i}].dependsOn unknown id: "${id}"`);
        continue;
      }
      filtered.push(id);
    }
    const reason = asString(d.reason).trim();
    if (!reason) {
      reasons.push(`dependsOn[${i}].reason missing`);
      continue;
    }
    if (containsForbiddenNumeric(reason))
      reasons.push(`dependsOn[${i}].reason contains forbidden numeric tokens`);
    if (wordCount(reason) > 30) reasons.push(`dependsOn[${i}].reason exceeds word cap`);
    dependsOn.push({ projectId, dependsOn: filtered, reason });
  }

  const risksRaw = Array.isArray(r.risks) ? r.risks : [];
  const risks: ProgramRiskLLM[] = [];
  for (let i = 0; i < risksRaw.length; i++) {
    const m = (risksRaw[i] ?? {}) as Record<string, unknown>;
    const title = asString(m.title).trim();
    const description = asString(m.description).trim();
    const mitigation = asString(m.mitigation).trim();
    if (!title || !description || !mitigation) {
      reasons.push(`risks[${i}] missing required fields`);
      continue;
    }
    if (containsForbiddenNumeric(title) || wordCount(title) > 10) {
      reasons.push(`risks[${i}].title invalid`);
      continue;
    }
    if (containsForbiddenNumeric(description) || wordCount(description) > 36) {
      reasons.push(`risks[${i}].description invalid`);
      continue;
    }
    if (containsForbiddenNumeric(mitigation) || wordCount(mitigation) > 36) {
      reasons.push(`risks[${i}].mitigation invalid`);
      continue;
    }
    checkHedgePhrases(description, `risks[${i}].description`, reasons);
    checkHedgePhrases(mitigation, `risks[${i}].mitigation`, reasons);
    risks.push({ title, description, mitigation });
  }
  if (risks.length < 3 || risks.length > 8)
    reasons.push("risks must have between 3 and 8 entries");

  const roadmapNarrative = validateRoadmapNarrative(r.roadmapNarrative, reasons);
  const architectureOrchestration = validateArchitectureField(
    r.architectureOrchestration,
    "architectureOrchestration",
    reasons,
  );
  const architectureVendors = validateArchitectureField(
    r.architectureVendors,
    "architectureVendors",
    reasons,
  );
  const architectureDataCore = validateArchitectureField(
    r.architectureDataCore,
    "architectureDataCore",
    reasons,
  );

  if (reasons.length > 0) {
    throw new ValidationError(reasons, rawText);
  }

  return {
    executiveSummary,
    dependsOn,
    risks,
    roadmapNarrative,
    architectureOrchestration,
    architectureVendors,
    architectureDataCore,
  };
}

function validateRoadmapNarrative(
  raw: unknown,
  reasons: string[],
): RoadmapNarrativeLLM {
  const r = (raw ?? {}) as Record<string, unknown>;
  const overall = asString(r.overall).trim();
  const ladder = asString(r.ladder).trim();
  if (!overall) reasons.push("roadmapNarrative.overall missing");
  else {
    if (containsForbiddenNumeric(overall))
      reasons.push("roadmapNarrative.overall contains forbidden numeric tokens");
    if (wordCount(overall) > 70) reasons.push("roadmapNarrative.overall exceeds word cap");
  }
  if (!ladder) reasons.push("roadmapNarrative.ladder missing");
  else {
    if (containsForbiddenNumeric(ladder))
      reasons.push("roadmapNarrative.ladder contains forbidden numeric tokens");
    if (wordCount(ladder) > 60) reasons.push("roadmapNarrative.ladder exceeds word cap");
  }
  const milestones = validateShortStringArray(
    r.milestones,
    "roadmapNarrative.milestones",
    { min: 3, max: 6, maxWords: 22 },
    reasons,
  );
  const ownerNotes = validateShortStringArray(
    r.ownerNotes,
    "roadmapNarrative.ownerNotes",
    { min: 1, max: 4, maxWords: 32 },
    reasons,
  );
  return { overall, ladder, milestones, ownerNotes };
}

function validateArchitectureField(
  raw: unknown,
  field: string,
  reasons: string[],
): string {
  const s = asString(raw).trim();
  if (!s) {
    reasons.push(`${field} missing`);
    return "";
  }
  if (containsForbiddenNumeric(s))
    reasons.push(`${field} contains forbidden numeric tokens`);
  if (wordCount(s) > 60) reasons.push(`${field} exceeds word cap`);
  checkHedgePhrases(s, field, reasons);
  return s;
}

// ===========================================================================
//   Helpers — hashing + lookups
// ===========================================================================

function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function cohortInputHash(cohort: L4Cohort, programInputHash: string): string {
  const compact = {
    p: programInputHash,
    l4: cohort.l4RowId,
    n: cohort.l4Name,
    t: cohort.towerId,
    ids: cohort.l5Initiatives.map((i) => i.id).sort(),
    names: cohort.l5Initiatives.map((i) => i.name).sort(),
  };
  return djb2(JSON.stringify(compact));
}

function projectsDigestFor(projects: AIProjectLLM[]): string {
  const compact = projects
    .map((p) => ({
      id: p.id,
      n: p.name,
      v: p.valueBucket,
      e: p.effortBucket,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return djb2(JSON.stringify(compact));
}

function hashTimingContext(a: CrossTowerAssumptions): string {
  // Used as part of the synthesis cache key — narrative changes when the
  // timing assumptions change because the prompt receives them.
  const compact = {
    s: a.programStartMonth,
    r: a.rampMonths,
    p1s: a.p1PhaseStartMonth,
    p2s: a.p2PhaseStartMonth,
    p3s: a.p3PhaseStartMonth,
    p1b: a.p1BuildMonths,
    p2b: a.p2BuildMonths,
    p3b: a.p3BuildMonths,
  };
  return djb2(JSON.stringify(compact));
}

function cohortNameById(
  cohorts: L4Cohort[],
  l4RowId: string,
): { towerName: string } {
  const c = cohorts.find((co) => co.l4RowId === l4RowId);
  return { towerName: c?.towerName ?? "Versant Forge" };
}

// ===========================================================================
//   Re-exports for the API route
// ===========================================================================

export { ALLOWED_VENDORS, ALLOWED_BRANDS, ALLOWED_PEOPLE, PROMPT_VERSION };
