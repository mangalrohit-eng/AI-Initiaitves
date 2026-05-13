/**
 * Server-only OpenAI helper: full `Process` JSON for the lazy LLM brief route.
 * Caches on `L4Item.generatedProcess` (the alias retained on the V5 row that
 * actually points at an L5 Activity record). See `curate-brief` API route for
 * fallback.
 *
 * 5-layer context: under `AssessProgramV5` the AI initiative attaches at L5
 * Activity (formerly L4). The `l4Name` / `l4Id` fields on `CurateBriefLLMInput`
 * are kept verbatim for back-compat but semantically describe the **L5
 * Activity** being briefed. The new optional `l4` field carries the parent
 * **L4 Activity Group** so the LLM has both rungs of context.
 */

import type {
  Agent,
  AgentFlow,
  AgentOrchestration,
  DigitalCoreLens,
  ImpactTier,
  PlatformRequirement,
  Process,
  RoleState,
  SolutionBrief,
  SolutionBuildAgent,
  SolutionBuyOption,
  SolutionReferenceArchitecture,
  SolutionSourcingApproach,
  ToolState,
  WorkforceLens,
  WorkLens,
  WorkState,
  WorkStep,
} from "@/data/types";
import type { GeneratedBrief, TowerId } from "@/data/assess/types";

/**
 * Prompt version stamp for the curate-brief LLM call. Bumped whenever the
 * system prompt's JSON contract changes in a way that older caches won't
 * carry — e.g. the addition of `solutionBrief` (this version). The detail
 * page reads `GeneratedProcessCache.inference.promptVersion` and offers
 * a "regenerate for the new layout" hint without erasing existing caches.
 *
 *   2026-05-solution-brief — added top-level `solutionBrief` (Build/Buy
 *                            verdict, named buy options, plain-language
 *                            reference architecture, build agents).
 */
export const CURATE_BRIEF_PROMPT_VERSION = "2026-05-solution-brief";
import { digitalCore, orchestration, role, tool, workState } from "@/data/helpers";
import { TOWER_READINESS_MAX_DIGEST_CHARS } from "@/lib/assess/towerReadinessIntake";
import {
  ALLOWED_VENDORS,
  TOWER_CONTEXT,
  VersantLLMError,
  buildAllowListsBlock,
  buildLLMRequest,
  buildTowerContextBlock,
  buildVersantPreamble,
  buildVoiceRulesBlock,
  getInferenceMeta,
  isLLMConfigured as kitIsLLMConfigured,
  resolveModelId,
  shouldUseResponsesApi as kitShouldUseResponsesApi,
} from "@/lib/llm/prompts/versantPromptKit";

/** Default OpenAI wait for initiative brief (`/api/assess/curate-brief`). GPT-5.5 + Responses often exceeds 120s. */
const DEFAULT_TIMEOUT_MS = 240_000;
/** Floor / ceiling so env typos do not hang forever or exceed `curate-brief` route `maxDuration` (300s). */
const CURATE_BRIEF_TIMEOUT_MIN_MS = 30_000;
const CURATE_BRIEF_TIMEOUT_MAX_MS = 290_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;
const VENDOR_TBD = "TBD — subject to discovery";

/**
 * @deprecated Use `TOWER_CONTEXT` from `@/lib/llm/prompts/versantPromptKit`
 * (richer paragraphs that already reconcile this hint with the Step-1/2/4
 * tower context). Re-exported here verbatim from the kit so the existing
 * `curateBriefLLM.ts` barrel re-export keeps compiling for back-compat.
 */
export const TOWER_BRAND_HINT: Record<TowerId, string> = TOWER_CONTEXT;

export type CurateBriefLLMInput = {
  towerId: TowerId;
  /** L2 Job Grouping (5-layer map). */
  l2: string;
  /** L3 Job Family (5-layer map). */
  l3: string;
  /**
   * L4 Activity Group — parent of the L5 Activity being briefed. Optional
   * for back-compat with legacy V4 callers; when absent the LLM relies on
   * the L3 / L4 (= V4 leaf) labels alone.
   */
  l4?: string;
  /**
   * Display label for the leaf being briefed. Under V5 this is the **L5
   * Activity** name; field name preserved for wire-format back-compat.
   */
  l4Name: string;
  /**
   * Stable id for the leaf being briefed (V5: L5 Activity id) — used for
   * synthetic `Process.id`.
   */
  l4Id: string;
  aiRationale: string;
  agentOneLine?: string;
  primaryVendor?: string;
  /** Tower AI readiness questionnaire digest (optional). */
  towerIntakeDigest?: string;
};

export type CurateBriefLLMOptions = {
  model?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  /**
   * Only used with GPT-5 family on the Responses API. Defaults to `"medium"`.
   * The legacy env var `OPENAI_CURATE_BRIEF_REASONING_EFFORT` is no longer
   * read — pass it as an option if you need to override.
   */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
};

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

/**
 * Exposed for `/api/assess/curate-brief` and the LLM-brief page footer.
 * Routes through the kit so every Versant module reports the same
 * (model, mode, reasoningEffort) triple.
 */
export function getCurateBriefInferenceMeta(
  options: CurateBriefLLMOptions = {},
): { model: string; mode: "responses" | "chat" } {
  const meta = getInferenceMeta(options.model, mapBriefReasoningEffort(resolveReasoningEffort(options)));
  return { model: meta.model, mode: meta.mode };
}

function resolveTimeoutMsFromEnv(): number | null {
  const raw = process.env.CURATE_BRIEF_TIMEOUT_MS?.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(CURATE_BRIEF_TIMEOUT_MAX_MS, Math.max(CURATE_BRIEF_TIMEOUT_MIN_MS, n));
}

function resolveTimeoutMs(options: CurateBriefLLMOptions): number {
  if (options.timeoutMs != null) return options.timeoutMs;
  return resolveTimeoutMsFromEnv() ?? DEFAULT_TIMEOUT_MS;
}

function resolveMaxOutputTokens(options: CurateBriefLLMOptions): number {
  if (options.maxOutputTokens != null) return options.maxOutputTokens;
  return DEFAULT_MAX_OUTPUT_TOKENS;
}

/**
 * Brief authoring keeps a wider reasoning-effort vocabulary than the kit's
 * canonical `minimal | low | medium | high` because a few callers wired the
 * `none` and `xhigh` values into env-var docs. We collapse them at the
 * boundary so the kit's `buildLLMRequest` receives a value it accepts.
 */
function resolveReasoningEffort(
  options: CurateBriefLLMOptions,
): "none" | "minimal" | "low" | "medium" | "high" | "xhigh" {
  if (options.reasoningEffort) return options.reasoningEffort;
  return "medium";
}

function mapBriefReasoningEffort(
  raw: "none" | "minimal" | "low" | "medium" | "high" | "xhigh",
): "minimal" | "low" | "medium" | "high" {
  if (raw === "none") return "minimal";
  if (raw === "xhigh") return "high";
  return raw;
}

export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function asStr(v: unknown, max = 2000): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pickImpact(v: unknown): ImpactTier {
  if (v === "High" || v === "Medium" || v === "Low") return v;
  return "Medium";
}

function pickComplexity(v: unknown): "Low" | "Medium" | "High" {
  if (v === "Low" || v === "Medium" || v === "High") return v;
  return "Medium";
}

function pickAgentType(v: unknown): Agent["type"] {
  const t = asStr(v, 40);
  const u = t as Agent["type"];
  if (["Orchestrator", "Specialist", "Monitor", "Router", "Executor"].includes(u)) return u;
  return "Specialist";
}

function pickPattern(v: unknown): AgentOrchestration["pattern"] {
  const t = asStr(v, 40);
  const p = t as AgentOrchestration["pattern"];
  if (
    ["Sequential", "Parallel", "Hub-and-Spoke", "Pipeline", "Hierarchical"].includes(p)
  ) {
    return p;
  }
  return "Hub-and-Spoke";
}

function pickPlatformPriority(v: unknown): PlatformRequirement["priority"] {
  if (v === "Critical" || v === "Important" || v === "Nice-to-have") return v;
  return "Important";
}

function normSteps(raw: unknown): WorkStep[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkStep[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const step = typeof o.step === "number" && o.step > 0 ? o.step : out.length + 1;
    const action = asStr(o.action, 400) || "TBD — subject to discovery";
    const owner = asStr(o.owner, 200) || "TBD — subject to discovery";
    const duration = asStr(o.duration, 80) || "TBD";
    const isManual = o.isManual === false ? false : true;
    out.push({ step, action, owner, duration, isManual });
    if (out.length >= 20) break;
  }
  return out;
}

function normWorkState(raw: unknown, fallback: WorkState): WorkState {
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const o = raw as Record<string, unknown>;
  const steps = normSteps(o.steps);
  return {
    description:
      asStr(o.description, 800) || fallback.description,
    steps: steps.length >= 2 ? steps : fallback.steps,
    avgCycleTime: asStr(o.avgCycleTime, 120) || fallback.avgCycleTime,
    touchpoints: typeof o.touchpoints === "number" && o.touchpoints >= 0 ? o.touchpoints : fallback.touchpoints,
    errorRate: asStr(o.errorRate, 80) || fallback.errorRate,
  };
}

function normWorkLens(raw: unknown, sk: WorkLens): WorkLens {
  if (!raw || typeof raw !== "object") return sk;
  const o = raw as Record<string, unknown>;
  return {
    pre: normWorkState(o.pre, sk.pre),
    post: normWorkState(o.post, sk.post),
    keyShifts: ensureStrArray(o.keyShifts, sk.keyShifts, 8),
  };
}

function ensureStrArray(raw: unknown, fallback: string[], max: number): string[] {
  if (!Array.isArray(raw)) return fallback;
  const xs = raw
    .map((x) => asStr(x, 300))
    .filter(Boolean);
  if (xs.length === 0) return fallback;
  return xs.slice(0, max);
}

function normRoleState(raw: unknown, idx: number): RoleState {
  if (!raw || typeof raw !== "object") {
    return role("Role TBD", "TBD — subject to discovery", ["TBD — subject to discovery"], ["TBD — subject to discovery"], { work: 100 });
  }
  const o = raw as Record<string, unknown>;
  let timeAllocation: Record<string, number> = {};
  if (o.timeAllocation && typeof o.timeAllocation === "object" && o.timeAllocation !== null) {
    for (const [k, n] of Object.entries(o.timeAllocation as Record<string, unknown>)) {
      if (typeof n === "number" && n >= 0) timeAllocation[k] = n;
    }
  }
  if (Object.keys(timeAllocation).length === 0) {
    timeAllocation = { primary: 100 };
  }
  return {
    role: asStr(o.role, 200) || `Role ${idx + 1}`,
    headcount: asStr(o.headcount, 80) || "TBD — subject to discovery",
    primaryActivities: ensureStrArray(
      o.primaryActivities,
      ["TBD — subject to discovery"],
      10,
    ),
    skillsRequired: ensureStrArray(o.skillsRequired, ["TBD — subject to discovery"], 10),
    timeAllocation,
  };
}

function normWorkforce(raw: unknown, sk: WorkforceLens): WorkforceLens {
  if (!raw || typeof raw !== "object") {
    return sk;
  }
  const o = raw as Record<string, unknown>;
  const preArr = Array.isArray(o.pre) ? o.pre.map((x, i) => normRoleState(x, i)) : sk.pre;
  const postArr = Array.isArray(o.post) ? o.post.map((x, i) => normRoleState(x, i)) : sk.post;
  return {
    pre: preArr.length > 0 ? preArr : sk.pre,
    post: postArr.length > 0 ? postArr : sk.post,
    keyShifts: ensureStrArray(o.keyShifts, sk.keyShifts, 10),
    workforceImpactTier:
      o.workforceImpactTier === undefined
        ? sk.workforceImpactTier
        : pickImpact(o.workforceImpactTier),
    workforceImpactSummary:
      asStr(o.workforceImpactSummary, 500) || sk.workforceImpactSummary,
  };
}

function normToolList(raw: unknown, fallback: ToolState[]): ToolState[] {
  if (!Array.isArray(raw)) return fallback;
  const out: ToolState[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    out.push({
      tool: asStr(o.tool, 200) || "TBD — subject to discovery",
      category: asStr(o.category, 80) || "TBD",
      usage: asStr(o.usage, 200) || "TBD — subject to discovery",
    });
    if (out.length >= 20) break;
  }
  return out.length > 0 ? out : fallback;
}

function normWorkbench(raw: unknown, sk: { pre: ToolState[]; post: ToolState[]; keyShifts: string[] }): { pre: ToolState[]; post: ToolState[]; keyShifts: string[] } {
  if (!raw || typeof raw !== "object") {
    return sk;
  }
  const o = raw as Record<string, unknown>;
  return {
    pre: normToolList(o.pre, sk.pre),
    post: normToolList(o.post, sk.post),
    keyShifts: ensureStrArray(o.keyShifts, sk.keyShifts, 12),
  };
}

function normPlatform(raw: unknown, idx: number): PlatformRequirement {
  if (!raw || typeof raw !== "object") {
    return {
      platform: `Platform ${idx + 1}`,
      purpose: "TBD — subject to discovery",
      priority: "Important",
      examples: ["TBD — subject to discovery"],
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    platform: asStr(o.platform, 120) || "TBD — subject to discovery",
    purpose: asStr(o.purpose, 240) || "TBD — subject to discovery",
    priority: pickPlatformPriority(o.priority),
    examples: ensureStrArray(
      o.examples,
      ["TBD — subject to discovery"],
      6,
    ),
  };
}

function normDigitalCore(raw: unknown, sk: DigitalCoreLens, towerId: TowerId): DigitalCoreLens {
  if (!raw || typeof raw !== "object") {
    return sk;
  }
  const o = raw as Record<string, unknown>;
  const rps = Array.isArray(o.requiredPlatforms)
    ? o.requiredPlatforms.map((p, i) => normPlatform(p, i))
    : sk.requiredPlatforms;
  return {
    requiredPlatforms: rps.length > 0 ? rps : sk.requiredPlatforms,
    dataRequirements: ensureStrArray(
      o.dataRequirements,
      sk.dataRequirements,
      20,
    ),
    integrations: ensureStrArray(o.integrations, sk.integrations, 20),
    securityConsiderations: ensureStrArray(
      o.securityConsiderations,
      sk.securityConsiderations,
      20,
    ),
    estimatedBuildEffort:
      asStr(o.estimatedBuildEffort, 120) ||
      sk.estimatedBuildEffort ||
      `3-6 months — ${towerId} integration pattern — TBD — subject to discovery`,
  };
}

function normAgent(
  raw: unknown,
  idx: number,
  l4Id: string,
  fallbackName: string,
  fallbackId: string,
): Agent {
  if (!raw || typeof raw !== "object") {
    return {
      id: fallbackId,
      name: fallbackName,
      role: "TBD — subject to discovery",
      type: "Specialist",
      inputs: ["L4 context"],
      outputs: ["TBD — subject to discovery"],
      llmRequired: true,
      toolsUsed: [VENDOR_TBD],
    };
  }
  const o = raw as Record<string, unknown>;
  const id = asStr(o.id, 80) || `llm-${l4Id}-a${idx + 1}`;
  return {
    id,
    name: asStr(o.name, 120) || fallbackName,
    role: asStr(o.role, 400) || "Executes the workflow and surfaces exceptions.",
    type: pickAgentType(o.type),
    inputs: ensureStrArray(o.inputs, ["Tower + L4 context"], 8),
    outputs: ensureStrArray(o.outputs, ["TBD — subject to discovery"], 8),
    llmRequired: o.llmRequired === false ? false : true,
    toolsUsed: ensureStrArray(o.toolsUsed, [VENDOR_TBD], 8),
  };
}

function collectAgentIds(agents: Agent[]): Set<string> {
  return new Set(agents.map((a) => a.id));
}

function normFlow(raw: unknown, validIds: Set<string>, a0: string, a1: string): AgentFlow[] {
  const defaultEdge = (): AgentFlow[] =>
    a0 === a1
      ? []
      : [{ from: a0, to: a1, dataPassed: "work items", trigger: "On intake" }];

  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultEdge();
  }
  const out: AgentFlow[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const from = asStr(o.from, 80) || a0;
    const to = asStr(o.to, 80) || a1;
    if (from === to) continue;
    if (!validIds.has(from) || !validIds.has(to)) continue;
    out.push({
      from,
      to,
      dataPassed: asStr(o.dataPassed, 120) || "data",
      trigger: asStr(o.trigger, 80) || "TBD",
    });
    if (out.length >= 20) break;
  }
  return out.length > 0
    ? out
    : defaultEdge();
}

function normOrchestration(
  raw: unknown,
  agents: Agent[],
): AgentOrchestration {
  const a0 = agents[0]?.id ?? "orchestrator";
  const a1 = agents[1]?.id ?? agents[0]?.id ?? "specialist";
  const ids = collectAgentIds(agents);
  if (!raw || typeof raw !== "object") {
    return orchestration("Hub-and-Spoke", "Agents route work across the L4 with human review for exceptions.", normFlow([], ids, a0, a1));
  }
  const o = raw as Record<string, unknown>;
  return {
    pattern: pickPattern(o.pattern),
    description:
      asStr(o.description, 400) || "L4-scoped multi-agent handoff with human-in-the-loop review.",
    flow: normFlow(o.flow, ids, a0, a1),
  };
}

function buildSkeletonWork(
  l3: string,
  l4: string,
  preNarr: string,
  postNarr: string,
): WorkLens {
  return {
    pre: workState(
      preNarr,
      [
        [l3, "Ops", "1-2d", true],
        [l4, "SMEs", "varies", true],
      ],
      "TBD — subject to discovery",
      3,
      "TBD — subject to discovery",
    ),
    post: workState(
      postNarr,
      [
        ["Exception intake + triage", "TBD — subject to discovery", "same day", true],
        ["Agent execution + quality checks", "Primary Agent", "TBD", false],
      ],
      "TBD — subject to discovery",
      2,
      "TBD — subject to discovery",
    ),
    keyShifts: [
      "SMEs shift to exception handling and sign-off from routine execution",
    ],
  };
}

/**
 * Deterministic `Process` when the LLM fails or the API is unconfigured.
 */
export function buildFallbackProcess(input: CurateBriefLLMInput): Process {
  const pid = `llm-${input.l4Id.replace(/[^a-zA-Z0-9-_]/g, "-")}`.slice(0, 120);
  const l3n = input.l3;
  const l4n = input.l4Name;
  const preNarr = `${l3n} → ${l4n} runs manually today across ${String(input.towerId).replace(/-/g, " ")}. Cycle time, error rate, and headcount cost — TBD — subject to discovery.`;
  const oneLine = input.agentOneLine?.trim();
  const postNarr = oneLine
    ? `${oneLine} It automates the routine work; humans review edge cases. Indicative cycle-time and quality lift — TBD — subject to discovery.`
    : "A primary agent automates the routine work; humans review edge cases. Indicative metrics — TBD — subject to discovery.";

  const a0: Agent = {
    id: `${pid}-p1`,
    name: "Primary Agent",
    role: input.agentOneLine?.trim() || "End-to-end execution and exception surfacing for this L4.",
    type: "Executor",
    inputs: ["L4 + tower context"],
    outputs: ["Structured output + exception queue"],
    llmRequired: true,
    toolsUsed: [input.primaryVendor?.trim() || VENDOR_TBD],
  };
  const a1: Agent = {
    id: `${pid}-p2`,
    name: "Triage & QA Agent",
    role: "Pre-flight checks, confidence scoring, and handoff to humans when risk is high.",
    type: "Monitor",
    inputs: ["agent outputs"],
    outputs: ["QA summary"],
    llmRequired: true,
    toolsUsed: [VENDOR_TBD],
  };

  const skWork = buildSkeletonWork(l3n, l4n, preNarr, postNarr);
  const workforce: WorkforceLens = {
    pre: [role("Operators / SMEs", "TBD — subject to discovery", ["Run the process", "ad-hoc fixes"], ["judgment", "spreadsheets"], { execution: 60, "ad-hoc": 40 })],
    post: [
      role("Operators / reviewers", "TBD — subject to discovery", ["exceptions", "sign-off"], ["oversight", "governance"], { review: 55, signoff: 45 }),
    ],
    keyShifts: ["SMEs move from rote work to review and design"],
    workforceImpactTier: "Medium",
    workforceImpactSummary:
      "Qualitative reinvestment in oversight — quantitative sizing TBD in discovery; no new financial figures invented.",
  };
  const wb: { pre: ToolState[]; post: ToolState[]; keyShifts: string[] } = {
    pre: [
      tool("Legacy spreadsheets + email", "Ad hoc", "Manual handoffs"),
      tool("NBCU shared service tools where applicable", "TBD", "As-is"),
    ],
    post: [tool(input.primaryVendor?.trim() || "TBD — subject to discovery", "TBD", "TBD — subject to discovery")],
    keyShifts: ["TBD — subject to discovery"],
  };
  const baseProcess: Process = {
    id: pid,
    name: l4n,
    description: input.aiRationale.slice(0, 500),
    isAiEligible: true,
    complexity: "Medium",
    timelineMonths: 6,
    impactTier: "Medium",
    currentPainPoints: [preNarr.slice(0, 200)],
    work: skWork,
    workforce,
    workbench: wb,
    digitalCore: digitalCore({
      requiredPlatforms: [
        { platform: "L4 data capture + audit", purpose: "Tower-scoped data for agents", priority: "Critical", examples: [VENDOR_TBD] },
      ],
      dataRequirements: ["L4 + tower context", "TBD — subject to discovery"],
      integrations: ["NBCU shared services (until TSA) — TBD", "TBD — subject to discovery"],
      securityConsiderations: [
        "Minimum necessary access; audit logs for human review",
        "TBD — subject to discovery",
      ],
      estimatedBuildEffort: "TBD — subject to discovery",
    }),
    agents: [a0, a1],
    agentOrchestration: orchestration(
      "Hub-and-Spoke",
      "Primary L4 flow with a monitoring agent for quality.",
      [
        { from: a0.id, to: a1.id, dataPassed: "candidate outputs", trigger: "Each batch" },
      ],
    ),
  };
  return { ...baseProcess, solutionBrief: deriveSolutionBriefFromProcess(baseProcess) };
}

/**
 * One-way adapter: legacy 5-field brief to a displayable (thin) `Process` so
 * older `localStorage` still renders the four-lens view without a new API call.
 */
export function legacyGeneratedBriefToProcess(
  brief: GeneratedBrief,
  input: CurateBriefLLMInput,
): Process {
  const pre = workState(
    brief.preState,
    [
      ["Manual L4 work", "SMEs", "TBD", true],
      ["Exception handling", "SMEs", "TBD", true],
    ],
    "TBD — subject to discovery",
    4,
    "TBD — subject to discovery",
  );
  const post = workState(
    brief.postState,
    [
      ["Agent execution", "Primary agent", "TBD", false],
      ["Human review", "SMEs", "TBD", true],
    ],
    "TBD — subject to discovery",
    3,
    "TBD — subject to discovery",
  );
  const aIds = brief.agentsInvolved.map(
    (a, i) => `legacy-${input.l4Id.replace(/[^a-zA-Z0-9-]/g, "-")}-a${i}`.slice(0, 80),
  );
  const agents: Agent[] = brief.agentsInvolved.map((a, i) => ({
    id: aIds[i]!,
    name: a.name,
    role: a.role,
    type: "Specialist",
    inputs: ["L4 context"],
    outputs: ["Narrated outcome"],
    llmRequired: true,
    toolsUsed: brief.toolsRequired.length ? brief.toolsRequired.slice(0, 4) : [VENDOR_TBD],
  }));
  if (agents.length < 1) {
    return buildFallbackProcess(input);
  }
  const a0 = agents[0]!;
  const a1 = agents[1] ?? a0;
  const baseProcess: Process = {
    id: `llm-${input.l4Id.replace(/[^a-zA-Z0-9-_]/g, "-")}`.slice(0, 120),
    name: input.l4Name,
    description: input.aiRationale.slice(0, 500),
    isAiEligible: true,
    complexity: "Medium",
    timelineMonths: 6,
    impactTier: "Medium",
    currentPainPoints: [brief.keyMetric, brief.preState.slice(0, 200)],
    work: {
      pre,
      post,
      keyShifts: [
        "Transition from the legacy brief to the full Process model; regenerate for deeper lenses.",
      ],
    },
    workforce: {
      pre: [
        role("SMEs / operators", "TBD — subject to discovery", ["as-is work"], ["tools in use"], { work: 100 }),
      ],
      post: [role("SMEs / reviewers", "TBD — subject to discovery", ["agent oversight"], ["oversight"], { work: 100 })],
      keyShifts: ["Oversight-first roles — sizing TBD — subject to discovery"],
      workforceImpactTier: "Medium",
      workforceImpactSummary: "Migrated from legacy one-page brief; regenerate for full team modeling.",
    },
    workbench: {
      pre: [tool("As-is stack", "TBD", "From card context")],
      post: brief.toolsRequired.map((t) => tool(t, "TBD", "From legacy brief tools list")),
      keyShifts: ["TBD — subject to discovery"],
    },
    digitalCore: digitalCore({
      requiredPlatforms: [
        { platform: "L4 + tower data layer", purpose: "Agent + UI integration", priority: "Critical", examples: [VENDOR_TBD] },
      ],
      dataRequirements: ["TBD — subject to discovery"],
      integrations: ["TBD — subject to discovery"],
      securityConsiderations: ["TBD — subject to discovery"],
      estimatedBuildEffort: "TBD — subject to discovery",
    }),
    agents,
    agentOrchestration: orchestration(
      "Hub-and-Spoke",
      "Legacy two-step narrative; regenerate for a full orchestration graph.",
      [{ from: a0.id, to: a1.id, dataPassed: "L4 work item", trigger: "Batch" }],
    ),
  };
  return { ...baseProcess, solutionBrief: deriveSolutionBriefFromProcess(baseProcess) };
}

// ===========================================================================
//   SolutionBrief — six-section client narrative
// ===========================================================================

const SOURCING_APPROACHES: readonly SolutionSourcingApproach[] = [
  "Build",
  "Buy",
  "Discover",
];

const COVERAGE_TIERS: readonly SolutionBuyOption["coverage"][] = [
  "Strong",
  "Partial",
  "Adjacent",
];

function pickSourcingApproach(v: unknown): SolutionSourcingApproach {
  if (typeof v !== "string") return "Discover";
  const t = v.trim();
  if (SOURCING_APPROACHES.includes(t as SolutionSourcingApproach)) {
    return t as SolutionSourcingApproach;
  }
  // Tolerate common LLM phrasings.
  const lc = t.toLowerCase();
  if (lc.startsWith("build")) return "Build";
  if (lc.startsWith("buy") || lc.startsWith("purchase") || lc.includes("vendor")) {
    return "Buy";
  }
  return "Discover";
}

function pickCoverage(v: unknown): SolutionBuyOption["coverage"] {
  if (typeof v !== "string") return "Partial";
  const t = v.trim();
  if (COVERAGE_TIERS.includes(t as SolutionBuyOption["coverage"])) {
    return t as SolutionBuyOption["coverage"];
  }
  const lc = t.toLowerCase();
  if (lc.startsWith("strong") || lc.startsWith("full") || lc.startsWith("high")) {
    return "Strong";
  }
  if (lc.startsWith("adjacent") || lc.startsWith("near") || lc.startsWith("indirect")) {
    return "Adjacent";
  }
  return "Partial";
}

function normHowItWorksSteps(raw: unknown): { title: string; detail: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { title: string; detail: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const title = asStr(o.title, 200) || asStr(o.heading, 200) || asStr(o.name, 200);
    const detail =
      asStr(o.detail, 600) ||
      asStr(o.description, 600) ||
      asStr(o.body, 600) ||
      "TBD — subject to discovery";
    if (!title) continue;
    out.push({ title, detail });
    if (out.length >= 8) break;
  }
  return out;
}

function normBuyOptions(raw: unknown): SolutionBuyOption[] {
  if (!Array.isArray(raw)) return [];
  const out: SolutionBuyOption[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const vendor = asStr(o.vendor, 200) || asStr(o.name, 200);
    if (!vendor) continue;
    const fit =
      asStr(o.fit, 600) ||
      asStr(o.fitNote, 600) ||
      asStr(o.note, 600) ||
      "TBD — subject to discovery";
    out.push({ vendor, fit, coverage: pickCoverage(o.coverage) });
    if (out.length >= 6) break;
  }
  return out;
}

function normRefArch(
  raw: unknown,
  fallback: SolutionReferenceArchitecture,
): SolutionReferenceArchitecture {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const aiLayerRaw = o.aiLayer;
  let aiLayer = fallback.aiLayer;
  if (aiLayerRaw && typeof aiLayerRaw === "object") {
    const a = aiLayerRaw as Record<string, unknown>;
    aiLayer = {
      components: ensureStrArray(a.components, fallback.aiLayer.components, 8),
      description:
        asStr(a.description, 600) || fallback.aiLayer.description,
    };
  }
  return {
    sourceSystems: ensureStrArray(
      o.sourceSystems,
      fallback.sourceSystems,
      10,
    ),
    aiLayer,
    targetSystems: ensureStrArray(
      o.targetSystems,
      fallback.targetSystems,
      10,
    ),
    users: ensureStrArray(o.users, fallback.users, 10),
    dataFlowSummary:
      asStr(o.dataFlowSummary, 800) ||
      asStr(o.summary, 800) ||
      fallback.dataFlowSummary,
  };
}

function normBuildAgents(
  raw: unknown,
  fallback: SolutionBuildAgent[],
): SolutionBuildAgent[] {
  if (!Array.isArray(raw)) return fallback;
  const out: SolutionBuildAgent[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const name = asStr(o.name, 200);
    if (!name) continue;
    out.push({
      name,
      role: asStr(o.role, 600) || "TBD — subject to discovery",
      llmRequired: o.llmRequired === false ? false : true,
    });
    if (out.length >= 8) break;
  }
  return out.length > 0 ? out : fallback;
}

/**
 * Compose a deterministic `SolutionBrief` from the rest of a `Process`.
 * Used when the LLM omits the field, when the cache predates the
 * solution-brief upgrade, or as the seed inside `normSolutionBrief`.
 *
 * Read-only — never mutates the input.
 */
export function deriveSolutionBriefFromProcess(p: Process): SolutionBrief {
  const capabilities = (p.work?.keyShifts ?? [])
    .filter((s) => s.trim().length > 0)
    .slice(0, 6);
  const headline =
    p.work?.post?.description?.trim() ||
    p.description?.trim() ||
    "TBD — subject to discovery";

  const steps = (p.work?.post?.steps ?? []).slice(0, 6).map((s) => ({
    title: s.action || `Step ${s.step}`,
    detail: `${s.owner ? `${s.owner} · ` : ""}${s.duration ? `${s.duration} · ` : ""}${
      s.isManual ? "human-led" : "automated"
    }`,
  }));

  // Heuristic verdict: if any post-state vendor is named (and not TBD), Buy
  // is the leaning; if the platforms / agents look custom-heavy, Build;
  // otherwise Discover.
  const postVendors = (p.workbench?.post ?? [])
    .map((t) => t.tool?.trim() ?? "")
    .filter((s) => s.length > 0 && !/^TBD/i.test(s));
  const platformExamples = (p.digitalCore?.requiredPlatforms ?? [])
    .flatMap((rp) => rp.examples ?? [])
    .filter((s) => s && !/^TBD/i.test(s));
  const namedVendors = Array.from(new Set([...postVendors, ...platformExamples]));
  const approach: SolutionSourcingApproach =
    namedVendors.length >= 2
      ? "Buy"
      : namedVendors.length === 1
        ? "Buy"
        : "Discover";

  const buyOptions: SolutionBuyOption[] = namedVendors.slice(0, 4).map((v, i) => ({
    vendor: v,
    fit:
      i === 0
        ? "Anchor of the recommended stack — covers the routine workflow."
        : "Adjacent capability — extends coverage on a specific sub-flow.",
    coverage: i === 0 ? "Strong" : "Partial",
  }));

  const sourceSystems = (p.digitalCore?.dataRequirements ?? [])
    .filter((s) => s.trim().length > 0)
    .slice(0, 6);
  const aiComponents = (p.agents ?? []).map((a) => a.name).slice(0, 6);
  const targetSystems = (p.digitalCore?.integrations ?? [])
    .filter((s) => s.trim().length > 0)
    .slice(0, 6);
  const users = (p.workforce?.post ?? [])
    .map((r) => r.role)
    .filter((s) => s.trim().length > 0)
    .slice(0, 6);

  const buildAgents: SolutionBuildAgent[] = (p.agents ?? []).slice(0, 6).map((a) => ({
    name: a.name,
    role: a.role,
    llmRequired: a.llmRequired,
  }));

  return {
    whatItDoes: {
      headline,
      capabilities:
        capabilities.length > 0
          ? capabilities
          : ["TBD — subject to discovery"],
    },
    howItWorks: {
      steps:
        steps.length > 0
          ? steps
          : [
              {
                title: "Run today's flow",
                detail: p.work?.pre?.description ?? "TBD — subject to discovery",
              },
              {
                title: "Run with AI",
                detail: p.work?.post?.description ?? "TBD — subject to discovery",
              },
            ],
    },
    sourcing: {
      approach,
      rationale:
        approach === "Buy"
          ? `Named vendors in the recommended stack (${namedVendors.slice(0, 3).join(", ")}) cover the routine workflow; build is reserved for Versant-specific gaps.`
          : "No anchor vendor surfaced — discovery needed to confirm whether existing tools cover ≥80% of the scope or a custom build is justified.",
    },
    buyOptions,
    referenceArchitecture: {
      sourceSystems:
        sourceSystems.length > 0 ? sourceSystems : ["TBD — subject to discovery"],
      aiLayer: {
        components:
          aiComponents.length > 0
            ? aiComponents
            : ["Primary execution agent", "Quality / exception monitor"],
        description:
          p.agentOrchestration?.description ??
          "Agent layer routes work end-to-end with humans on exceptions.",
      },
      targetSystems:
        targetSystems.length > 0 ? targetSystems : ["TBD — subject to discovery"],
      users: users.length > 0 ? users : ["TBD — subject to discovery"],
      dataFlowSummary:
        p.work?.post?.description?.trim() ||
        "Data flows from source ledgers / systems through the AI layer; humans approve exceptions; results land in target systems for downstream consumers.",
    },
    buildAgents,
  };
}

/**
 * Normalize the LLM-emitted `solutionBrief` block. Falls back to the
 * derived-from-Process brief whenever a field is missing or malformed,
 * so partial responses never produce an empty section.
 */
export function normSolutionBrief(raw: unknown, p: Process): SolutionBrief {
  const fallback = deriveSolutionBriefFromProcess(p);
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;

  const wid = o.whatItDoes;
  let whatItDoes = fallback.whatItDoes;
  if (wid && typeof wid === "object") {
    const w = wid as Record<string, unknown>;
    whatItDoes = {
      headline: asStr(w.headline, 800) || fallback.whatItDoes.headline,
      capabilities: ensureStrArray(
        w.capabilities,
        fallback.whatItDoes.capabilities,
        10,
      ),
    };
  }

  const hiw = o.howItWorks;
  let howItWorks = fallback.howItWorks;
  if (hiw && typeof hiw === "object") {
    const h = hiw as Record<string, unknown>;
    const steps = normHowItWorksSteps(h.steps);
    const citations = Array.isArray(h.intakeCitations)
      ? (h.intakeCitations as unknown[])
          .map((c) => asStr(c, 400))
          .filter((s) => s.length > 0)
          .slice(0, 6)
      : [];
    howItWorks = {
      steps: steps.length > 0 ? steps : fallback.howItWorks.steps,
      ...(citations.length > 0 ? { intakeCitations: citations } : {}),
    };
  }

  const src = o.sourcing;
  let sourcing = fallback.sourcing;
  if (src && typeof src === "object") {
    const s = src as Record<string, unknown>;
    sourcing = {
      approach: pickSourcingApproach(s.approach),
      rationale:
        asStr(s.rationale, 1000) || fallback.sourcing.rationale,
    };
  }

  const buyOptions = normBuyOptions(o.buyOptions);
  const referenceArchitecture = normRefArch(
    o.referenceArchitecture,
    fallback.referenceArchitecture,
  );
  const buildAgents = normBuildAgents(o.buildAgents, fallback.buildAgents);

  return {
    whatItDoes,
    howItWorks,
    sourcing,
    buyOptions: buyOptions.length > 0 ? buyOptions : fallback.buyOptions,
    referenceArchitecture,
    buildAgents,
  };
}

/**
 * Merges LLM JSON (possibly partial) onto the deterministic fallback shape.
 */
export function normalizeLlmProcess(rawRoot: unknown, input: CurateBriefLLMInput): Process {
  const sk = buildFallbackProcess(input);
  let root: Record<string, unknown> | null = null;
  if (rawRoot && typeof rawRoot === "object" && "process" in (rawRoot as object)) {
    const inner = (rawRoot as { process: unknown }).process;
    if (inner && typeof inner === "object") root = inner as Record<string, unknown>;
  } else if (rawRoot && typeof rawRoot === "object") {
    root = rawRoot as Record<string, unknown>;
  }
  if (!root) return sk;

  const id = asStr(root.id, 200) || sk.id;
  const name = asStr(root.name, 200) || sk.name;
  const desc = asStr(root.description, 2000) || sk.description;
  const work = normWorkLens(root.work, sk.work);
  const workforce = normWorkforce(root.workforce, sk.workforce);
  const workbench = normWorkbench(root.workbench, sk.workbench);
  const digital = normDigitalCore(root.digitalCore, sk.digitalCore, input.towerId);
  const agentArr = Array.isArray(root.agents) ? root.agents : [];
  const normAgents: Agent[] = agentArr
    .map((g, i) => normAgent(g, i, input.l4Id, i === 0 ? "Primary Agent" : `Agent ${i + 1}`, `llm-${input.l4Id.replace(/[^a-zA-Z0-9-]/g, "-")}-a${i + 1}`));
  const agents = normAgents.length > 0 ? normAgents : sk.agents;
  const baseProcess: Process = {
    id: id.slice(0, 200),
    name: name,
    description: desc,
    isAiEligible: root.isAiEligible === false ? false : true,
    complexity: pickComplexity(root.complexity),
    timelineMonths:
      typeof root.timelineMonths === "number" && root.timelineMonths >= 1 && root.timelineMonths <= 60
        ? root.timelineMonths
        : sk.timelineMonths,
    impactTier:
      root.impactTier === undefined ? sk.impactTier : pickImpact(root.impactTier),
    currentPainPoints: ensureStrArray(root.currentPainPoints, sk.currentPainPoints, 12).slice(0, 20),
    work,
    workforce,
    workbench,
    digitalCore: digital,
    agents: agents as Agent[],
    agentOrchestration: normOrchestration(root.agentOrchestration, agents as Agent[]),
  };
  return {
    ...baseProcess,
    solutionBrief: normSolutionBrief(root.solutionBrief, baseProcess),
  };
}

function buildSystemPrompt(towerId: TowerId, towerIntakeDigest?: string): string {
  const digest = towerIntakeDigest?.trim()
    ? towerIntakeDigest.trim().slice(0, TOWER_READINESS_MAX_DIGEST_CHARS)
    : "";
  const digestBlock = digest
    ? [
        "",
        "===========================================================================",
        "TOWER LEAD QUESTIONNAIRE (authoritative for this tower when it conflicts)",
        "===========================================================================",
        digest,
      ].join("\n")
    : "";
  return [
    "You are a senior Versant operating partner. Output ONE JSON object only (the root fields of a 'Process' initiative). Every string must be Versant-specific. Declarative voice. No emojis. No hedging.",
    "",
    "Hierarchy context (5-layer Versant capability map):",
    "  L1 Function > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity.",
    "  The brief you author IS the deep-dive for ONE L5 Activity (the 'leaf' in the user prompt). Anchor the work, workforce, workbench, and digital-core lenses in that L5 Activity, with the L4 Activity Group as immediate parent context.",
    "",
    buildVersantPreamble({ grain: "program" }),
    "",
    buildTowerContextBlock(towerId),
    "",
    "CONTENT POLICY (strict):",
    "  - Do not state dollar amounts, revenue, or Versant-specific financial figures unless they appear verbatim in the user prompt. Use 'TBD — subject to discovery' for unknowns.",
    "  - Do not present operational numbers (days, %, error rates, touchpoint counts) as facts about **this** client. If you use numbers in work.pre / work.post (avgCycleTime, errorRate, step durations, touchpoints), prefix or suffix so they read as **illustrative / industry-typical**, not a Versant forecast — e.g. 'Indicative: …' or 'Example range (not client-specific)'.",
    "  - **Headcount** may be described in **qualitative** terms (role mix, 'analyst-heavy', shift to review) and the RoleState.headcount field may use 'TBD — subject to discovery' or narrative labels. Do **not** claim measured FTE reduction, net headcount cut, or quantified workforce savings for Versant — workforceImpactSummary stays qualitative; timeAllocation is about time-in-role, not FTE counts.",
    "",
    buildVoiceRulesBlock(),
    "",
    buildAllowListsBlock({ includePeople: true, includeVendors: true }),
    "",
    `Vendor names in workbench tools, digitalCore.requiredPlatforms.examples, and agents.toolsUsed MUST come from the ALLOWED VENDORS list above (case-insensitive). Compound stacks separate with " + ". When no allow-list vendor fits, return the exact string "${VENDOR_TBD}".`,
    "",
    "The JSON must fully satisfy this TypeScript-style shape: Process { id, name, description, isAiEligible, complexity, timelineMonths, impactTier, currentPainPoints[], work{ pre: WorkState, post: WorkState, keyShifts[] }, work.pre/post have: description, steps[WorkStep], avgCycleTime, touchpoints, errorRate }. WorkStep: step number, action, owner, duration, isManual. workforce{ pre, post: RoleState[], keyShifts, workforceImpactTier, workforceImpactSummary } RoleState: role, headcount, primaryActivities, skillsRequired, timeAllocation: { string: number summing to ~100 }. workbench, digitalCore with requiredPlatforms[{platform,purpose,priority,examples}]. agents: Agent[] min 1 — each: id, name, role, type: Orchestrator|Specialist|Monitor|Router|Executor, inputs, outputs, llmRequired, toolsUsed. agentOrchestration: pattern, description, flow: {from,to,dataPassed,trigger}[] where from/to are agent id strings that exist in agents.",
    "",
    "ALSO author a top-level `solutionBrief` field — the client-facing six-section narrative the AI Solution detail page renders as its primary view. Required keys (every one is mandatory; do not omit, do not return empty arrays):",
    "  whatItDoes: { headline: 1-2 plain-English sentences naming the AI Solution and the outcome it delivers; capabilities: 3-6 declarative bullets, each one named capability (verb-led)).",
    "  howItWorks: { steps: 3-6 ordered objects with { title (3-7 words, action-first), detail (1-2 sentences explaining how it runs end-to-end) }; intakeCitations?: 0-3 short pull-quotes lifted verbatim from the TOWER LEAD QUESTIONNAIRE block when one was used to ground a step. Omit the array entirely if the questionnaire was not present or not used. }.",
    "  sourcing: { approach: \"Build\" | \"Buy\" | \"Discover\"; rationale: 2-4 sentences explaining the verdict in Versant terms. RULES: choose Buy when ALLOWED VENDORS cover ≥80% of the capabilities; Build when the data, brand voice, or competitive moat justifies a custom stack; Discover when neither is clear. The verdict MUST reconcile with workbench.post vendors and digitalCore.estimatedBuildEffort. }.",
    "  buyOptions: array of { vendor (MUST be from the ALLOWED VENDORS list above), fit (1-2 sentences explaining what the vendor covers and where it falls short), coverage: \"Strong\" | \"Partial\" | \"Adjacent\" }. Provide 2-4 options when sourcing.approach is \"Buy\"; provide 0-2 adjacent options when \"Build\" or \"Discover\". Coverage tiers: Strong = ≥80% of scope, Partial = 40-79%, Adjacent = related but doesn't directly cover scope.",
    "  referenceArchitecture: { sourceSystems: 3-6 plain-English source system names (e.g. \"Workday Financials\", \"News rundown system (iNEWS)\"); aiLayer: { components: 2-5 short labels for the AI layer (e.g. \"Reconciliation agent\", \"Variance narrative drafter\"); description: 1-2 sentences naming what the AI layer does }; targetSystems: 3-6 destination system names (e.g. \"BlackLine close workspace\", \"Auditor portal\"); users: 2-5 role labels (e.g. \"Controllers\", \"CFO team\", \"Auditors\"); dataFlowSummary: 2-4 sentence plain-English narrative of how data moves end-to-end }. KEEP IT JARGON-LIGHT — name the system in plain English, then put a product / vendor name in parentheses once if it helps (e.g. \"News rundown system (iNEWS)\"). NEVER lead with raw acronyms.",
    "  buildAgents: array of { name (matches one of the agents in `agents[]` above), role (1-2 sentences, what this agent does in client-friendly language), llmRequired (boolean) }. Provide 2-5 agents when sourcing.approach is \"Build\" or \"Discover\". Empty array when sourcing.approach is \"Buy\" — Buy means Versant doesn't develop net-new agents.",
    "",
    `Total allowed vendors: ${ALLOWED_VENDORS.length}.`,
    "",
    "Return strict JSON. No keys outside the documented Process + solutionBrief fields. No markdown fences.",
  ].join("\n") + digestBlock;
}

function buildUserPrompt(input: CurateBriefLLMInput): string {
  // Versant capability maps are 5 layers:
  //   L1 Function > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity
  // The leaf being briefed is the **L5 Activity** (carried on the `l4Name` /
  // `l4Id` fields for wire back-compat). When the optional `l4` Activity
  // Group context is supplied, surface it explicitly so the model anchors
  // the brief in the right rung of the hierarchy.
  const digest = input.towerIntakeDigest?.trim()
    ? truncate(
        input.towerIntakeDigest.trim().slice(0, TOWER_READINESS_MAX_DIGEST_CHARS),
        8_000,
      )
    : "";
  const hasL4 = typeof input.l4 === "string" && input.l4.trim().length > 0;
  const leafLabel = hasL4 ? "L5 Activity" : "leaf";
  return [
    digest
      ? `Tower questionnaire context (see system prompt):\n${digest}\n`
      : "",
    `Author a complete Process for this ${leafLabel}. Operational metrics in work states must be labeled indicative / not client-specific if numeric.`,
    `Stable id: ${input.l4Id} (set Process.id to something stable like "llm-${input.l4Id}" or a slug derived from the name).`,
    `L2 Job Grouping: ${truncate(input.l2)}`,
    `L3 Job Family: ${truncate(input.l3)}`,
    hasL4 ? `L4 Activity Group: ${truncate(input.l4 as string, 200)}` : "",
    `${hasL4 ? "L5 Activity" : "L4"} name (the leaf being briefed): ${truncate(input.l4Name, 200)}`,
    `Card rationale: ${truncate(input.aiRationale, 400)}`,
    input.agentOneLine ? `Agent one-liner: ${truncate(input.agentOneLine, 280)}` : "",
    input.primaryVendor ? `Primary vendor: ${input.primaryVendor}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * OpenAI call — returns a normalized `Process` or throws `LLMError`.
 * Routes through `versantPromptKit.buildLLMRequest` so model selection,
 * Chat-vs-Responses-API choice, JSON-mode, abort propagation, and timeout
 * all share the kit's implementation. Per-route env overrides (model,
 * Chat-vs-Responses, reasoning effort) have been retired — every Versant
 * call uses the same model.
 */
export async function curateBriefWithLLM(
  input: CurateBriefLLMInput,
  options: CurateBriefLLMOptions = {},
): Promise<Process> {
  if (!kitIsLLMConfigured()) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  const timeoutMs = resolveTimeoutMs(options);
  const maxOut = resolveMaxOutputTokens(options);
  const reasoningEffort = mapBriefReasoningEffort(resolveReasoningEffort(options));
  // Surface the model resolution in case future callers want to log; the
  // actual fetch is delegated to the kit.
  void resolveModelId(options.model);
  void kitShouldUseResponsesApi(resolveModelId(options.model));
  let parsed: unknown;
  try {
    const result = await buildLLMRequest({
      systemPrompt: buildSystemPrompt(input.towerId, input.towerIntakeDigest),
      userPrompt: buildUserPrompt(input),
      model: options.model,
      reasoningEffort,
      timeoutMs,
      maxOutputTokens: maxOut,
      verbosity: "medium",
    });
    parsed = result.parsed;
  } catch (e) {
    if (e instanceof VersantLLMError) {
      throw new LLMError(e.message, e);
    }
    if (e instanceof LLMError) throw e;
    throw new LLMError(
      e instanceof Error ? e.message : "OpenAI call failed",
      e,
    );
  }
  return normalizeLlmProcess(parsed, input);
}

export { LLMError };
